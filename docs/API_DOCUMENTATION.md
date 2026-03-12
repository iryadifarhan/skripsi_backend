# Clinic Reservation & Queue Management API Documentation

Base URL: `http://localhost:8000/api`

## Authentication Model

- Session-based authentication via Laravel Sanctum (`auth:sanctum`) with SPA cookies.
- For SPA clients, call `GET /sanctum/csrf-cookie` before login/register.
- Use headers:
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Origin` and `Referer` from frontend domain

## Role Access

- `patient`: patient-only endpoints (`authorize:patient`)
- `admin`: clinic-admin endpoints (`authorize:admin`)
- `doctor`: currently no dedicated reservation write endpoints

---

## 1) Authentication Endpoints

### POST `/register`
Function: register a new patient account.

Input:
- `name` (string, required, max 255)
- `username` (string, required, max 50, `alpha_dash`, unique)
- `email` (string, required, email, unique)
- `phone_number` (string, optional, max 30, unique)
- `password` (string, required, confirmed)
- `password_confirmation` (string, required)

Success response (`201`):
```json
{
  "message": "Registration successful.",
  "user": {
    "id": 1,
    "name": "Patient One",
    "username": "patient_one",
    "email": "patient@example.com",
    "phone_number": "+628111111111",
    "role": "patient",
    "profile_picture": "patient_1"
  }
}
```

---

### POST `/login`
Function: login user with email/password.

Input:
- `email` (string, required, email)
- `password` (string, required)
- `remember` (boolean, optional)

Success response (`200`):
```json
{
  "message": "Login successful.",
  "user": {
    "id": 1,
    "name": "Patient One",
    "role": "patient"
  }
}
```

Common error (`422`): invalid credentials.

---

### POST `/forgot-password`
Function: send reset password link.

Input:
- `email` (string, required, email)

Success response (`200`):
```json
{
  "message": "We have emailed your password reset link."
}
```

---

### POST `/reset-password`
Function: reset password using token.

Input:
- `token` (string, required)
- `email` (string, required, email)
- `password` (string, required, confirmed)
- `password_confirmation` (string, required)

Success response (`200`):
```json
{
  "message": "Your password has been reset."
}
```

---

### GET `/user`
Auth: `auth:sanctum`

Function: get current authenticated user.

Success response (`200`):
```json
{
  "user": {
    "id": 1,
    "name": "Patient One",
    "role": "patient"
  }
}
```

---

### POST `/logout`
Auth: `auth:sanctum`

Function: logout current session.

Success response (`200`):
```json
{
  "message": "Logout successful."
}
```

---

## 2) Profile Endpoints

### GET `/profile`
Auth: `auth:sanctum`

Function: get current user profile.

Success response (`200`):
```json
{
  "message": "Profile retrieval successful.",
  "user": {
    "id": 1,
    "name": "Patient One",
    "username": "patient_one",
    "email": "patient@example.com",
    "phone_number": "+628111111111",
    "role": "patient",
    "profile_picture": "patient_1"
  }
}
```

---

### PATCH `/profile`
Auth: `auth:sanctum`

Function: update general profile fields.

Input (at least one field required):
- `name` (string, optional, max 255)
- `username` (string, optional, max 50, unique, `alpha_dash`)
- `email` (string, optional, email, unique)
- `phone_number` (string/null, optional, max 30, unique)

Success response (`200`):
```json
{
  "message": "Profile update successful.",
  "user": {
    "id": 1,
    "name": "Updated Name",
    "username": "updated_username",
    "email": "updated@example.com",
    "phone_number": "+628111111113"
  }
}
```

---

### PATCH `/profile/password`
Auth: `auth:sanctum`

Function: change password.

Input:
- `current_password` (string, required, must match current password)
- `password` (string, required, confirmed, different from current)
- `password_confirmation` (string, required)

Success response (`200`):
```json
{
  "message": "Password update successful."
}
```

---

### GET `/profile/picture-options`
Auth: `auth:sanctum`

Function: return allowed predefined profile pictures based on user role.

Success response (`200`):
```json
{
  "role": "patient",
  "profile_pictures": ["patient_1", "patient_2", "patient_3", "patient_4"],
  "selected_profile_picture": "patient_1"
}
```

---

### PATCH `/profile/picture`
Auth: `auth:sanctum`

Function: update profile picture with predefined ID only (no upload).

Input:
- `profile_picture` (string, required, must be in role-allowed list)

Success response (`200`):
```json
{
  "message": "Profile picture update successful.",
  "user": {
    "id": 1,
    "profile_picture": "patient_3"
  }
}
```

---

## 3) Admin User Management Endpoints

Auth: `auth:sanctum` + `authorize:admin`

### POST `/admin/user/create`
Function: create user from admin panel.

Input:
- `name` (string, required)
- `username` (string, required, unique)
- `email` (string, required, unique)
- `phone_number` (string, optional, unique)
- `password` (string, required, confirmed)
- `password_confirmation` (string, required)
- `role` (string, required, one of: `patient`, `doctor`, `admin`)

Success response (`201`):
```json
{
  "message": "User creation successful.",
  "user": {
    "id": 10,
    "role": "doctor"
  }
}
```

---

### GET `/admin/user/{usernameOrEmail}`
Function: fetch user detail by username or email.

Success response (`200`):
```json
{
  "message": "User retrieval successful.",
  "user": {
    "id": 10,
    "username": "doctor_one",
    "email": "doctor@example.com"
  }
}
```

Not found (`404`): `{"message":"User not found."}`

---

### PATCH `/admin/user/{usernameOrEmail}`
Function: update user (name, username, email, phone number, role).

Input:
- `name` (string, required)
- `username` (string, required, unique except self)
- `email` (string, required, unique except self)
- `phone_number` (string/null, optional, unique except self)
- `role` (string, required, one of: `patient`, `doctor`, `admin`)

Success response (`200`):
```json
{
  "message": "User update successful.",
  "user": {
    "id": 10,
    "role": "admin"
  }
}
```

---

## 4) Patient Reservation (Time-Window Scheduling)

Auth: `auth:sanctum` + `authorize:patient`

### Flow Summary
1. Choose clinic: `GET /reservations/booking/clinics`
2. Choose doctor by clinic: `GET /reservations/booking/doctors`
3. Choose doctor practice schedule by date: `GET /reservations/booking/schedules`
4. Choose available time window + slots: `GET /reservations/booking/windows`
5. Reserve: `POST /reservations`

System behavior:
- Practice schedule (ex: `09:00-15:00`) is split by `window_minutes` (ex: 60).
- Each window has `max_patients_per_window` capacity (ex: 4).
- New booking is assigned to first empty slot (`window_slot_number`).

---

### GET `/reservations/booking/clinics`
Function: list available clinics for booking.

Success response (`200`):
```json
{
  "message": "Clinic retrieval successful.",
  "clinics": [
    {
      "id": 1,
      "name": "clinic-a",
      "address": "Address clinic-a",
      "phone_number": "081234567890",
      "email": "clinic-a@example.test"
    }
  ]
}
```

---

### GET `/reservations/booking/doctors?clinic_id={id}`
Function: list doctors assigned to selected clinic.

Query params:
- `clinic_id` (integer, required)

Success response (`200`):
```json
{
  "message": "Doctor retrieval successful.",
  "doctors": [
    {
      "id": 2,
      "name": "Doctor One",
      "username": "doctor_one",
      "email": "doctor@example.com",
      "phone_number": "+628111111115"
    }
  ]
}
```

---

### GET `/reservations/booking/schedules?clinic_id={id}&doctor_id={id}&reservation_date=YYYY-MM-DD`
Function: list active doctor schedule(s) on the selected date.

Query params:
- `clinic_id` (integer, required)
- `doctor_id` (integer, required)
- `reservation_date` (date, required, `>= today`)

Success response (`200`):
```json
{
  "message": "Practice schedule retrieval successful.",
  "schedules": [
    {
      "id": 5,
      "clinic_id": 1,
      "doctor_id": 2,
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "12:00:00",
      "window_minutes": 60,
      "max_patients_per_window": 4,
      "is_active": true
    }
  ]
}
```

Note: `day_of_week` follows Carbon (`0 = Sunday ... 6 = Saturday`).

---

### GET `/reservations/booking/windows?doctor_clinic_schedule_id={id}&reservation_date=YYYY-MM-DD`
Function: return generated windows with booking capacity for chosen schedule/date.

Query params:
- `doctor_clinic_schedule_id` (integer, required)
- `reservation_date` (date, required, `>= today`)

Success response (`200`):
```json
{
  "message": "Available windows retrieval successful.",
  "schedule": {
    "id": 5,
    "clinic_id": 1,
    "doctor_id": 2,
    "day_of_week": 1,
    "start_time": "09:00:00",
    "end_time": "12:00:00",
    "window_minutes": 60,
    "max_patients_per_window": 4
  },
  "windows": [
    {
      "window_start_time": "09:00:00",
      "window_end_time": "10:00:00",
      "max_slots": 4,
      "booked_slots": 1,
      "available_slots": 3,
      "slot_numbers_available": [2, 3, 4],
      "is_available": true
    }
  ]
}
```

---

### POST `/reservations`
Function: create reservation at selected schedule/date/window with automatic slot assignment.

Input:
- `doctor_clinic_schedule_id` (integer, required)
- `reservation_date` (date, required, `>= today`)
- `window_start_time` (string, required, format `H:i`, ex: `09:00`)
- `complaint` (string, optional, max 1000)

Success response (`201`):
```json
{
  "message": "Reservation creation successful.",
  "reservation": {
    "id": 100,
    "reservation_number": "RSV-20260308-000123",
    "patient_id": 10,
    "clinic_id": 1,
    "doctor_id": 2,
    "doctor_clinic_schedule_id": 5,
    "reservation_date": "2026-03-09",
    "reservation_time": "09:00:00",
    "window_start_time": "09:00:00",
    "window_end_time": "10:00:00",
    "window_slot_number": 2,
    "status": "pending",
    "complaint": "Flu symptoms"
  }
}
```

Common validation failures (`422`):
- date does not match schedule day
- selected window not part of schedule
- selected window full
- patient already has active reservation in same clinic/date

---

### GET `/reservations`
Function: list current patient reservations.

Query params:
- `status` (optional, one of: `pending`, `approved`, `rejected`, `cancelled`, `completed`)

Success response (`200`):
```json
{
  "message": "Reservation retrieval successful.",
  "reservations": []
}
```

---

### PATCH `/reservations/{reservation}/cancel`
Function: cancel own active reservation (`pending`/`approved`).

Input:
- `cancellation_reason` (string, optional, max 1000)

Success response (`200`):
```json
{
  "message": "Reservation cancellation successful.",
  "reservation": {
    "id": 100,
    "status": "cancelled",
    "cancellation_reason": "Recovered"
  }
}
```

Forbidden (`403`): reservation belongs to another patient.

---

## 5) Clinic Admin Reservation Management

Auth: `auth:sanctum` + `authorize:admin`

### GET `/admin/reservations`
Function: list reservations for admin's own clinic only.

Query params:
- `status` (optional, reservation status)
- `reservation_date` (optional, date filter)

Success response (`200`):
```json
{
  "message": "Reservation retrieval successful.",
  "reservations": []
}
```

---

### GET `/admin/reservations/{reservation}`
Function: get one reservation detail (must belong to admin clinic).

Success response (`200`):
```json
{
  "message": "Reservation retrieval successful.",
  "reservation": {
    "id": 100,
    "status": "pending"
  }
}
```

---

### PATCH `/admin/reservations/{reservation}`
Function: update reservation status/notes for own clinic reservation.

Input (at least one required):
- `status` (optional, one of: `pending`, `approved`, `rejected`, `cancelled`, `completed`)
- `admin_notes` (optional, string/null, max 1000)
- `cancellation_reason` (optional, string/null, max 1000)

Rules:
- Terminal statuses (`cancelled`, `completed`) cannot be changed to other statuses.
- If changing status to `cancelled`, `cancellation_reason` is required.
- On status change, system sets `handled_by_admin_id` and `handled_at`.

Success response (`200`):
```json
{
  "message": "Reservation update successful.",
  "reservation": {
    "id": 100,
    "status": "approved",
    "admin_notes": "Approved by clinic admin",
    "handled_by_admin_id": 3
  }
}
```

Forbidden (`403`): reservation does not belong to admin clinic.

---

## Common Error Response Pattern

Validation error (`422`):
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": ["validation message"]
  }
}
```

Unauthorized (`401`):
```json
{
  "message": "Unauthorized, you are not authenticated."
}
```

Forbidden (`403`):
```json
{
  "message": "Forbidden, you are not authorized."
}
```
