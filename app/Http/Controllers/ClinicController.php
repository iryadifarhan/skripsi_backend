<?php

namespace App\Http\Controllers;

use App\Models\Clinic;
use App\Models\ClinicOperatingHour;
use App\Models\DoctorClinicSchedule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ClinicController extends Controller
{
    public function index()
    {
        $clinics = Clinic::query()
            ->select(['id', 'name', 'address', 'phone_number', 'email'])
            ->with(['operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'message' => 'Clinic retrieval successful.',
            'clinics' => $clinics,
        ]);
    }

    public function show($clinicId)
    {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        return response()->json(
            $clinic->load([
                'doctors:id,name,username,email,phone_number',
                'operatingHours:id,clinic_id,day_of_week,open_time,close_time,is_closed',
            ])
        );
    }

    public function create(Request $request) {
        $request->validate([
            'name' => 'required|string|max:255|unique:clinics,name',
            'address' => 'required|string|max:255',
            'phone_number' => 'required|string|max:20|unique:clinics,phone_number',
            'email' => 'required|email|max:255|unique:clinics,email',
            'operating_hours' => 'nullable|array',
            'operating_hours.*.day_of_week' => 'required|integer|min:0|max:6',
            'operating_hours.*.open_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.close_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.is_closed' => 'nullable|boolean',
        ]);

        $clinic = Clinic::create([
            'name' => $request->name,
            'address' => $request->address,
            'phone_number' => $request->phone_number,
            'email' => $request->email,
        ]);

        $this->syncOperatingHours($clinic, $request->input('operating_hours'), true);

        return response()->json([
            'message' => 'Clinic created successfully.',
        ], 201);
    }

    public function update(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $request->validate([
            'name' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'phone_number' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255|unique:clinics,email,' . $clinicId,
            'operating_hours' => 'nullable|array',
            'operating_hours.*.day_of_week' => 'required|integer|min:0|max:6',
            'operating_hours.*.open_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.close_time' => 'nullable|date_format:H:i:s',
            'operating_hours.*.is_closed' => 'nullable|boolean',
        ]);

        $clinic->update($request->only(['name', 'address', 'phone_number', 'email']));
        $this->syncOperatingHours($clinic, $request->input('operating_hours'), false);

        return response()->json([
            'message' => 'Clinic updated successfully.',
        ]);
    }

    public function delete($clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $clinic->delete();

        return response()->json([
            'message' => 'Clinic deleted successfully.',
        ]);
    }

    public function assignDoctor(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }

        $request->validate([
            'doctor_id' => 'required|integer|exists:users,id',
        ]);

        if (User::where('id', $request->doctor_id)->where('role', User::ROLE_DOCTOR)->doesntExist()) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        $clinic->doctors()->attach($request->doctor_id);

        return response()->json([
            'message' => 'Doctor assigned to clinic successfully.',
        ]);
    }

    public function removeDoctor(Request $request, $clinicId) {
        if (!$clinic = Clinic::find($clinicId)) {
            return response()->json([
                'message' => 'Clinic not found.',
            ], 404);
        }
        
        $request->validate([
            'doctor_id' => 'required|integer|exists:users,id',
        ]);

        if (User::where('id', $request->doctor_id)->where('role', User::ROLE_DOCTOR)->doesntExist()) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        $clinic->doctors()->detach($request->doctor_id);

        return response()->json([
            'message' => 'Doctor removed from clinic successfully.',
        ]);
    }

    /**
     * For both admin and doctors
     */
    public function createDoctorClinicSchedule(Request $request) {
        $request->validate([
            'doctor_id' => 'required|integer|exists:users,id',
            'clinic_id' => 'required|integer|exists:clinics,id',
            'day_of_week' => 'required|integer|min:0|max:6',
            'start_time' => 'required|date_format:H:i:s',
            'end_time' => 'required|date_format:H:i:s|after:start_time',
            'window_minutes' => 'required|integer|min:1',
            'max_patients_per_window' => 'required|integer|min:1',
        ]);    

        $user = User::find($request->doctor_id);

        if ($user->role !== User::ROLE_DOCTOR) {
            return response()->json([
                'message' => 'The selected user is not a doctor.',
            ], 400);
        }

        if ($user->clinics()->where('clinic_id', $request->clinic_id)->doesntExist()) {
            return response()->json([
                'message' => 'The doctor is not assigned to the specified clinic.',
            ], 400);
        }

        if (DoctorClinicSchedule::where('doctor_id', $request->doctor_id)
            ->where('clinic_id', $request->clinic_id)
            ->where('day_of_week', $request->day_of_week)
            ->exists()) {
            return response()->json([
                'message' => 'A schedule for this doctor, clinic, and day of week already exists.',
            ], 400);
        }

        $clinicSchedule = Clinic::find($request->clinic_id)->operatingHours()->where('day_of_week', $request->day_of_week)->first();

        if ($request->start_time < $clinicSchedule->open_time || $request->end_time > $clinicSchedule->close_time) {
            return response()->json([
                'message' => 'The schedule is outside the clinic\'s operating hours.',
            ], 400);
        }

        DoctorClinicSchedule::create([
            'clinic_id' => $request->clinic_id,
            'doctor_id' => $request->doctor_id,
            'day_of_week' => $request->day_of_week,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'window_minutes' => $request->window_minutes,
            'max_patients_per_window' => $request->max_patients_per_window,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Doctor clinic schedule created successfully.',
        ], 201);
    }

    /**
     * For both admin and doctors
     */
    public function updateDoctorClinicSchedule(Request $request, DoctorClinicSchedule $schedule) {
        $request->validate([
            'start_time' => 'nullable|date_format:H:i:s',
            'end_time' => 'nullable|date_format:H:i:s|after:start_time',
            'window_minutes' => 'nullable|integer|min:1',
            'max_patients_per_window' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $clinicSchedule = $schedule->clinic->operatingHours()->where('day_of_week', $schedule->day_of_week)->first();

        if ($request->start_time < $clinicSchedule->open_time || $request->end_time > $clinicSchedule->close_time) {
            return response()->json([
                'message' => 'The schedule is outside the clinic\'s operating hours.',
            ], 400);
        }

        $schedule->update($request->only([
            'start_time',
            'end_time',
            'window_minutes',
            'max_patients_per_window',
            'is_active',
        ]));

        return response()->json([
            'message' => 'Doctor clinic schedule updated successfully.',
        ]);
    }

    private function syncOperatingHours(Clinic $clinic, ?array $operatingHours, bool $seedDefaultsOnCreate): void
    {
        if ($operatingHours === null) {
            if ($seedDefaultsOnCreate) {
                $this->seedDefaultOperatingHours($clinic);
            }
            return;
        }

        $this->validateOperatingHours($operatingHours);

        $now = now();
        $records = array_map(function (array $hour) use ($clinic, $now): array {
            $isClosed = (bool) ($hour['is_closed'] ?? false);

            return [
                'clinic_id' => $clinic->id,
                'day_of_week' => (int) $hour['day_of_week'],
                'open_time' => $isClosed ? null : ($hour['open_time'] ?? null),
                'close_time' => $isClosed ? null : ($hour['close_time'] ?? null),
                'is_closed' => $isClosed,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $operatingHours);

        ClinicOperatingHour::upsert(
            $records,
            ['clinic_id', 'day_of_week'],
            ['open_time', 'close_time', 'is_closed', 'updated_at']
        );
    }

    private function seedDefaultOperatingHours(Clinic $clinic): void
    {
        $now = now();
        $records = [];

        for ($day = 0; $day <= 6; $day++) {
            $records[] = [
                'clinic_id' => $clinic->id,
                'day_of_week' => $day,
                'open_time' => '08:00:00',
                'close_time' => '17:00:00',
                'is_closed' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        ClinicOperatingHour::insert($records);
    }

    private function validateOperatingHours(array $operatingHours): void
    {
        $errors = [];
        $days = [];

        foreach ($operatingHours as $index => $hour) {
            $day = $hour['day_of_week'] ?? null;
            $days[] = (int) $day;

            $isClosed = (bool) ($hour['is_closed'] ?? false);
            if ($isClosed) {
                continue;
            }

            $openTime = $hour['open_time'] ?? null;
            $closeTime = $hour['close_time'] ?? null;

            if (!$openTime || !$closeTime) {
                $errors["operating_hours.$index.open_time"][] = 'Open time is required when clinic is not closed.';
                $errors["operating_hours.$index.close_time"][] = 'Close time is required when clinic is not closed.';
                continue;
            }

            if (strtotime($openTime) >= strtotime($closeTime)) {
                $errors["operating_hours.$index.close_time"][] = 'Close time must be after open time.';
            }
        }

        if (count($days) !== count(array_unique($days))) {
            $errors['operating_hours'][] = 'Each day_of_week must be unique.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
