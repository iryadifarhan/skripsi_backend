<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user()?->only([
                    'id',
                    'name',
                    'username',
                    'email',
                    'role',
                    'phone_number',
                    'profile_picture',
                    'image_url',
                    'gender',
                    'date_of_birth',
                ]),
            ],
            'app' => [
                'name' => config('app.name', 'CliniQueue'),
            ],
            'flash' => [
                'status' => fn (): ?string => $request->session()->get('status'),
            ],
        ]);
    }
}
