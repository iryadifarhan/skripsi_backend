<?php

namespace Tests\Unit\Middleware;

use App\Http\Middleware\AuthorizeRole;
use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AuthorizeRoleTest extends TestCase
{
    use RefreshDatabase;

    private AuthorizeRole $middleware;

    protected function setUp(): void
    {
        parent::setUp();

        $this->middleware = new AuthorizeRole();
    }

    public function test_handle_returns_401_for_unauthenticated_request(): void
    {
        $response = $this->middleware->handle(
            $this->makeRequest(null),
            fn (Request $request) => response('ok', 200),
            User::ROLE_ADMIN
        );

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(
            ['message' => 'Unauthorized, you are not authenticated.'],
            json_decode((string) $response->getContent(), true)
        );
    }

    public function test_superadmin_bypasses_all_role_checks(): void
    {
        $superadmin = $this->makeUser(User::ROLE_SUPERADMIN);

        $response = $this->middleware->handle(
            $this->makeRequest($superadmin, ['clinic_name' => 'missing-clinic']),
            fn (Request $request) => response('passed', 200),
            User::ROLE_DOCTOR,
            'clinic-scoped'
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('passed', $response->getContent());
    }

    public function test_handle_returns_403_when_user_role_is_not_allowed(): void
    {
        $doctor = $this->makeUser(User::ROLE_DOCTOR);

        $response = $this->middleware->handle(
            $this->makeRequest($doctor),
            fn (Request $request) => response('ok', 200),
            User::ROLE_ADMIN
        );

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame(
            ['message' => 'Forbidden, you are not authorized.'],
            json_decode((string) $response->getContent(), true)
        );
    }

    public function test_handle_allows_admin_when_route_is_not_clinic_scoped(): void
    {
        $admin = $this->makeUser(User::ROLE_ADMIN);

        $response = $this->middleware->handle(
            $this->makeRequest($admin),
            fn (Request $request) => response('ok', 200),
            User::ROLE_ADMIN
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('ok', $response->getContent());
    }

    public function test_handle_allows_clinic_scoped_access_for_matching_admin(): void
    {
        $clinic = $this->makeClinic('klinik-cocok-admin');
        $admin = $this->makeUser(User::ROLE_ADMIN, $clinic->id);

        $response = $this->middleware->handle(
            $this->makeRequest($admin, ['clinic_name' => $clinic->name]),
            fn (Request $request) => response('ok', 200),
            User::ROLE_ADMIN,
            'clinic-scoped'
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('ok', $response->getContent());
    }

    public function test_handle_denies_clinic_scoped_access_for_admin_assigned_to_other_clinic(): void
    {
        $targetClinic = $this->makeClinic('klinik-target-admin');
        $otherClinic = $this->makeClinic('klinik-lain-admin');
        $admin = $this->makeUser(User::ROLE_ADMIN, $otherClinic->id);

        $this->assertAbortWithStatusAndMessage(
            fn () => $this->middleware->handle(
                $this->makeRequest($admin, ['clinic_name' => $targetClinic->name]),
                fn (Request $request) => response('ok', 200),
                User::ROLE_ADMIN,
                'clinic-scoped'
            ),
            403,
            'Forbidden, you are not authorized to this clinic.'
        );
    }

    public function test_handle_allows_clinic_scoped_access_for_matching_doctor_assignment(): void
    {
        $clinic = $this->makeClinic('klinik-cocok-dokter');
        $doctor = $this->makeUser(User::ROLE_DOCTOR);
        $doctor->clinics()->attach($clinic->id);

        $response = $this->middleware->handle(
            $this->makeRequest($doctor, ['clinic_name' => $clinic->name]),
            fn (Request $request) => response('ok', 200),
            User::ROLE_DOCTOR,
            'clinic-scoped'
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('ok', $response->getContent());
    }

    public function test_handle_denies_clinic_scoped_access_for_doctor_without_assignment(): void
    {
        $clinic = $this->makeClinic('klinik-target-dokter');
        $doctor = $this->makeUser(User::ROLE_DOCTOR);

        $this->assertAbortWithStatusAndMessage(
            fn () => $this->middleware->handle(
                $this->makeRequest($doctor, ['clinic_name' => $clinic->name]),
                fn (Request $request) => response('ok', 200),
                User::ROLE_DOCTOR,
                'clinic-scoped'
            ),
            403,
            'Forbidden, you are not authorized to this clinic.'
        );
    }

    public function test_handle_returns_422_when_clinic_name_missing_for_clinic_scoped_route(): void
    {
        $admin = $this->makeUser(User::ROLE_ADMIN);

        $this->assertAbortWithStatusAndMessage(
            fn () => $this->middleware->handle(
                $this->makeRequest($admin),
                fn (Request $request) => response('ok', 200),
                User::ROLE_ADMIN,
                'clinic-scoped'
            ),
            422,
            'clinic_name is required for clinic-scoped access.'
        );
    }

    public function test_handle_returns_404_when_clinic_name_is_not_found(): void
    {
        $admin = $this->makeUser(User::ROLE_ADMIN);

        $this->assertAbortWithStatusAndMessage(
            fn () => $this->middleware->handle(
                $this->makeRequest($admin, ['clinic_name' => 'tidak-ada']),
                fn (Request $request) => response('ok', 200),
                User::ROLE_ADMIN,
                'clinic-scoped'
            ),
            404,
            'Clinic name provided is not found at database.'
        );
    }

    private function assertAbortWithStatusAndMessage(callable $callback, int $status, string $message): void
    {
        try {
            $callback();
            $this->fail("Expected request to abort with {$status}.");
        } catch (HttpException $e) {
            $this->assertSame($status, $e->getStatusCode());
            $this->assertSame($message, $e->getMessage());
        }
    }

    private function makeRequest(?User $user, array $input = []): Request
    {
        $request = Request::create('/api/testing', 'POST', $input);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function makeUser(string $role, ?int $clinicId = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'clinic_id' => $clinicId,
        ]);
    }

    private function makeClinic(string $name): Clinic
    {
        $clinic = new Clinic();
        $clinic->name = $name;
        $clinic->address = 'Alamat '.$name;
        $clinic->phone_number = '08'.random_int(1000000000, 9999999999);
        $clinic->email = Str::slug($name).'-'.Str::lower(Str::random(6)).'@example.test';
        $clinic->save();

        return $clinic;
    }
}
