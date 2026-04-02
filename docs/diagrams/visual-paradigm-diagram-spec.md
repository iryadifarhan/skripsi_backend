# Clinic Reservation Backend Diagram Specification

This specification is derived from the current Laravel backend codebase in this repository.

Purpose:
- provide a Visual Paradigm reconstruction guide for the ERD
- provide a Visual Paradigm reconstruction guide for the class diagram
- stay aligned with the implemented backend, not a conceptual future-state design

Scope:
- included in the main ERD: operational/domain tables used by the clinic reservation system
- excluded from the main ERD: Laravel infrastructure tables such as `password_reset_tokens`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, and `personal_access_tokens`
- included in the class diagram: application-layer classes under `app/`
- excluded from the class diagram: vendor/framework internals under `vendor/`

## 1. ERD Specification

### 1.1 Main entities

#### `users`
- `id` PK
- `name` string, required
- `username` string, required, unique
- `email` string, required, unique
- `phone_number` string(30), nullable, unique
- `role` string, required, default `patient`
- `profile_picture` string(50), nullable
- `email_verified_at` timestamp, nullable
- `password` string, required
- `remember_token` string, nullable
- `clinic_id` FK -> `clinics.id`, nullable, `nullOnDelete`
- `created_at` timestamp
- `updated_at` timestamp

Notes:
- `clinic_id` is the primary clinic assignment for clinic admins.
- doctors are linked to clinics through `clinic_user`.
- patients do not require a clinic assignment.

#### `clinics`
- `id` PK
- `name` string, required, unique
- `address` string, required
- `phone_number` string, required
- `email` string, required, unique
- `created_at` timestamp
- `updated_at` timestamp

#### `clinic_user`
- `id` PK
- `clinic_id` FK -> `clinics.id`, required, `cascadeOnDelete`
- `user_id` FK -> `users.id`, required, `cascadeOnDelete`
- `created_at` timestamp
- `updated_at` timestamp

Constraints:
- unique (`clinic_id`, `user_id`)

Notes:
- application logic uses this pivot for doctor-clinic affiliation.

#### `clinic_operating_hours`
- `id` PK
- `clinic_id` FK -> `clinics.id`, required, `cascadeOnDelete`
- `day_of_week` tinyint, required
- `open_time` time, nullable
- `close_time` time, nullable
- `is_closed` boolean, required, default `false`
- `created_at` timestamp
- `updated_at` timestamp

Constraints:
- unique (`clinic_id`, `day_of_week`)

#### `doctor_clinic_schedules`
- `id` PK
- `clinic_id` FK -> `clinics.id`, required, `cascadeOnDelete`
- `doctor_id` FK -> `users.id`, required, `cascadeOnDelete`
- `day_of_week` tinyint, required
- `start_time` time, required
- `end_time` time, required
- `window_minutes` smallint unsigned, required, default `60`
- `max_patients_per_window` smallint unsigned, required, default `4`
- `is_active` boolean, required, default `true`
- `created_at` timestamp
- `updated_at` timestamp

Indexes:
- index (`clinic_id`, `doctor_id`, `day_of_week`)

Notes:
- this is the scheduling backbone for reservations.
- one doctor can have multiple schedules across clinics and weekdays.

#### `reservations`
- `id` PK
- `reservation_number` string, required, unique
- `queue_number` unsigned int, nullable
- `queue_status` string, required, default `waiting`
- `queue_order_source` string, required, default `derived`
- `queue_called_at` timestamp, nullable
- `queue_started_at` timestamp, nullable
- `queue_completed_at` timestamp, nullable
- `queue_skipped_at` timestamp, nullable
- `patient_id` FK -> `users.id`, nullable, `nullOnDelete`
- `guest_name` string, nullable
- `guest_phone_number` string(30), nullable
- `clinic_id` FK -> `clinics.id`, required, `cascadeOnDelete`
- `doctor_id` FK -> `users.id`, nullable, `nullOnDelete`
- `doctor_clinic_schedule_id` FK -> `doctor_clinic_schedules.id`, nullable, `nullOnDelete`
- `reservation_date` date, required
- `window_start_time` time, nullable
- `window_end_time` time, nullable
- `window_slot_number` unsigned smallint, nullable
- `status` string, required, default `pending`
- `complaint` text, nullable
- `admin_notes` text, nullable
- `cancellation_reason` text, nullable
- `cancelled_at` timestamp, nullable
- `handled_by_admin_id` FK -> `users.id`, nullable, `nullOnDelete`
- `handled_at` timestamp, nullable
- `created_at` timestamp
- `updated_at` timestamp

Indexes:
- index (`clinic_id`, `reservation_date`)
- index (`patient_id`, `status`)
- index (`doctor_clinic_schedule_id`, `reservation_date`, `window_start_time`) named `reservations_schedule_window_idx`

Constraints:
- unique (`doctor_clinic_schedule_id`, `reservation_date`, `queue_number`) named `reservations_schedule_date_queue_unique`

Notes:
- `patient_id` nullable supports walk-in reservations.
- if `patient_id` is null, guest identity is stored in `guest_name` and `guest_phone_number`.
- queue is one line per (`doctor_clinic_schedule_id`, `reservation_date`).
- queue order can be `derived` or `manual`.

#### `medical_records`
- `id` PK
- `reservation_id` FK -> `reservations.id`, required, unique, `cascadeOnDelete`
- `patient_id` FK -> `users.id`, nullable, `nullOnDelete`
- `guest_name` string, nullable
- `guest_phone_number` string(30), nullable
- `clinic_id` FK -> `clinics.id`, required, `cascadeOnDelete`
- `doctor_id` FK -> `users.id`, required, `cascadeOnDelete`
- `diagnosis` text, nullable
- `treatment` text, nullable
- `prescription_notes` text, nullable
- `doctor_notes` text, required
- `issued_at` timestamp, required
- `created_at` timestamp
- `updated_at` timestamp

Indexes:
- index (`patient_id`, `issued_at`)
- index (`clinic_id`, `issued_at`)
- index (`doctor_id`, `issued_at`)

Notes:
- one reservation has at most one medical record.
- medical record creation is the completion mechanism for reservations.

### 1.2 ERD relationships and cardinality

Use these cardinalities in Visual Paradigm:

- `Clinic 1 ---- 0..* User`
  - via `users.clinic_id`
  - semantic role: admin primary clinic assignment

- `Clinic 1 ---- 0..* ClinicOperatingHour`

- `Clinic 1 ---- 0..* DoctorClinicSchedule`

- `Clinic 1 ---- 0..* Reservation`

- `Clinic 1 ---- 0..* MedicalRecord`

- `User 1 ---- 0..* Reservation`
  - role: `patient_id`
  - nullable on reservation side

- `User 1 ---- 0..* Reservation`
  - role: `doctor_id`
  - nullable on reservation side

- `User 1 ---- 0..* Reservation`
  - role: `handled_by_admin_id`
  - nullable on reservation side

- `DoctorClinicSchedule 1 ---- 0..* Reservation`
  - nullable on reservation side

- `Reservation 1 ---- 0..1 MedicalRecord`
  - enforced by unique `medical_records.reservation_id`

- `User 1 ---- 0..* MedicalRecord`
  - role: `patient_id`
  - nullable on medical record side

- `User 1 ---- 0..* MedicalRecord`
  - role: `doctor_id`

- `Clinic * ---- * User`
  - realized through `clinic_user`
  - semantic role: doctor assignment to clinic

### 1.3 ERD business-rule notes for thesis annotation

Recommended ERD notes:

- User roles:
  - `patient`
  - `doctor`
  - `admin`
  - `superadmin`

- Reservation statuses:
  - `pending`
  - `approved`
  - `rejected`
  - `cancelled`
  - `completed`

- Queue statuses:
  - `waiting`
  - `called`
  - `in_progress`
  - `skipped`
  - `completed`
  - `cancelled`

- Queue order source:
  - `derived`
  - `manual`

- Walk-in patient rule:
  - `reservations.patient_id = null` means the reservation belongs to a guest/walk-in patient.

- Medical record completion rule:
  - reservation completion is driven by medical record creation, not direct admin completion.

## 2. Class Diagram Specification

### 2.1 Package structure for Visual Paradigm

Create these packages:

- `Models`
- `Controllers`
- `Services`
- `Notifications`
- `Exports`
- `Middleware`

Optional:
- `Support Exports` as a subpackage under `Exports`

### 2.2 Classes to include

#### Models

##### `User`
Superclass:
- `Authenticatable`

Traits/concerns:
- `HasApiTokens`
- `HasFactory`
- `Notifiable`

Key constants:
- `ROLE_PATIENT`
- `ROLE_DOCTOR`
- `ROLE_ADMIN`
- `ROLE_SUPERADMIN`
- `ROLES`
- `CLINIC_SCOPED_ROLES`
- `PROFILE_PICTURES`

Public relationships/methods:
- `clinic()`
- `clinics()`
- `reservations()`
- `assignedReservations()`
- `handledReservations()`
- `patientMedicalRecords()`
- `issuedMedicalRecords()`
- `doctorClinicSchedules()`
- `profilePicturesForRole(role)`
- `defaultProfilePictureForRole(role)`
- `isValidProfilePictureForRole(role, profilePicture)`

##### `Clinic`
Superclass:
- `Model`

Relationships:
- `users()`
- `doctors()`
- `reservations()`
- `medicalRecords()`
- `operatingHours()`
- `doctorClinicSchedules()`

##### `ClinicOperatingHour`
Superclass:
- `Model`

Relationships:
- `clinic()`

##### `DoctorClinicSchedule`
Superclass:
- `Model`

Relationships:
- `clinic()`
- `doctor()`

##### `Reservation`
Superclass:
- `Model`

Key constants:
- reservation status constants
- queue status constants
- queue order source constants
- `ACTIVE_STATUSES`
- `ACTIVE_QUEUE_STATUSES`

Relationships:
- `patient()`
- `clinic()`
- `doctor()`
- `doctorClinicSchedule()`
- `handledByAdmin()`
- `medicalRecord()`

##### `MedicalRecord`
Superclass:
- `Model`

Relationships:
- `reservation()`
- `patient()`
- `clinic()`
- `doctor()`

#### Controllers

##### `AuthController`
Public methods:
- `register(request)`
- `login(request)`
- `me(request)`
- `logout(request)`
- `forgotPassword(request)`
- `resetPassword(request)`

Primary dependencies:
- `User`

##### `AdminController`
Public methods:
- `getUser(request, usernameOrEmail)`
- `createUser(request)`
- `updateUser(request, usernameOrEmail)`
- `deleteUser(request, usernameOrEmail)`

Primary dependencies:
- `User`

##### `ClinicController`
Public methods:
- `index()`
- `show(clinicId)`
- `create(request)`
- `update(request, clinicId)`
- `delete(clinicId)`
- `assignDoctor(request, clinicId)`
- `removeDoctor(request, clinicId)`
- `createDoctorClinicSchedule(request)`
- `updateDoctorClinicSchedule(request, schedule)`

Primary dependencies:
- `Clinic`
- `User`
- `DoctorClinicSchedule`
- `ClinicOperatingHour`

##### `UserController`
Public methods:
- `show(request)`
- `update(request)`
- `updatePassword(request)`
- `profilePictureOptions(request)`
- `updateProfilePicture(request)`

Primary dependencies:
- `User`

##### `ReservationController`
Injected dependencies:
- `TimeWindowScheduler`
- `ReservationQueueService`
- `PatientNotificationService`

Public methods:
- `index(request)`
- `bookingSchedules(request)`
- `availableWindows(request)`
- `store(request)`
- `reschedule(request, reservation)`
- `cancel(request, reservation)`

Primary model dependencies:
- `Clinic`
- `DoctorClinicSchedule`
- `Reservation`
- `User`

##### `AdminReservationController`
Injected dependencies:
- `ReservationQueueService`
- `PatientNotificationService`
- `TimeWindowScheduler`

Public methods:
- `index(request)`
- `show(request, reservation)`
- `update(request, reservation)`
- `processReservation(request, reservation)`

Primary model dependencies:
- `DoctorClinicSchedule`
- `Reservation`
- `User`

##### `QueueController`
Injected dependencies:
- `ReservationQueueService`
- `PatientNotificationService`

Public methods:
- `patientIndex(request)`
- `adminIndex(request)`
- `doctorIndex(request)`
- `adminUpdate(request, reservation)`

Primary model dependencies:
- `DoctorClinicSchedule`
- `Reservation`
- `User`

##### `MedicalRecordController`
Injected dependencies:
- `ReservationQueueService`
- `PatientNotificationService`

Public methods:
- `patientIndex(request)`
- `patientShow(request, medicalRecord)`
- `adminIndex(request)`
- `adminShow(request, medicalRecord)`
- `doctorIndex(request)`
- `doctorShow(request, medicalRecord)`
- `store(request, reservation)`

Primary model dependencies:
- `MedicalRecord`
- `Reservation`
- `User`

##### `ReportController`
Injected dependencies:
- `ReportService`
- `ReservationQueueService`

Public methods:
- `reservations(request)`
- `exportReservations(request)`
- `medicalRecords(request)`
- `exportMedicalRecords(request)`

Primary dependencies:
- `Reservation`
- `MedicalRecord`
- `ReservationsReportExport`
- `MedicalRecordsReportExport`

#### Services

##### `TimeWindowScheduler`
Public methods:
- `generateWindows(schedule)`
- `findWindowByStart(schedule, windowStartTime)`

Primary dependency:
- `DoctorClinicSchedule`

##### `ReservationQueueService`
Public methods:
- `lineUsesManualOrdering(scheduleId, reservationDate)`
- `nextQueueNumber(scheduleId, reservationDate)`
- `syncQueueLine(scheduleId, reservationDate)`
- `resequenceQueueLineByWindowOrder(scheduleId, reservationDate)`
- `serializeReservations(reservations)`
- `serializeReservation(reservation)`
- `serializeQueueEntries(reservations, includePatient = false)`
- `serializeQueueEntry(reservation, includePatient = false)`
- `activeQueueSnapshotsForLine(scheduleId, reservationDate)`
- `moveReservationToQueueNumber(reservation, targetQueueNumber)`
- `compactQueueLine(scheduleId, reservationDate)`
- `syncWindowSlots(scheduleId, reservationDate, windowStartTime)`
- `applyQueueStatus(reservation, queueStatus)`
- `isActiveQueueReservation(reservation)`

Primary dependency:
- `Reservation`

##### `PatientNotificationService`
Injected dependencies:
- `FonnteService`

Public methods:
- `sendReservationStatusNotification(reservation, eventType)`
- `sendQueueProgressNotification(reservation, queueStatus)`
- `sendMedicalRecordReadyNotification(reservation, medicalRecord)`
- `sendQueueSnapshotChangeNotifications(beforeSnapshots, afterSnapshots, excludeReservationId = null)`

Primary dependencies:
- `Reservation`
- `MedicalRecord`
- `ReservationStatusNotification`
- `QueueProgressNotification`
- `MedicalRecordReadyNotification`

##### `ReportService`
Public methods:
- `reservations(actor, filters)`
- `medicalRecords(actor, filters)`

Primary dependencies:
- `User`
- `Reservation`
- `MedicalRecord`

##### `FonnteService`
Public methods:
- `isEnabled()`
- `sendMessage(phoneNumber, message)`

#### Notifications

##### `ReservationStatusNotification`
Superclass:
- `Notification`

Constructor state:
- `reservation`
- `eventType`

Public methods:
- `via(notifiable)`
- `toMail(notifiable)`
- `toWhatsAppText(recipientName = null)`

##### `QueueProgressNotification`
Superclass:
- `Notification`

Constructor state:
- `reservation`
- `queueStatus`

Public methods:
- `via(notifiable)`
- `toMail(notifiable)`
- `toWhatsAppText(recipientName = null)`

##### `MedicalRecordReadyNotification`
Superclass:
- `Notification`

Constructor state:
- `reservation`
- `medicalRecord`

Public methods:
- `via(notifiable)`
- `toMail(notifiable)`
- `toWhatsAppText(recipientName = null)`

#### Exports

##### `ReservationsReportExport`
Implements:
- `WithMultipleSheets`

Composition:
- builds `SummarySheetExport`
- builds `DataSheetExport`

Public methods:
- `sheets()`

##### `MedicalRecordsReportExport`
Implements:
- `WithMultipleSheets`

Composition:
- builds `SummarySheetExport`
- builds `DataSheetExport`

Public methods:
- `sheets()`

##### `SummarySheetExport`
Implements:
- `FromArray`
- `ShouldAutoSize`
- `WithTitle`

Public methods:
- `array()`
- `title()`

##### `DataSheetExport`
Implements:
- `FromArray`
- `ShouldAutoSize`
- `WithTitle`

Public methods:
- `array()`
- `title()`

#### Middleware

##### `AuthorizeRole`
Public methods:
- `handle(request, next, roles...)`

Primary dependencies:
- `User`
- `Clinic`

### 2.3 Class relationships to draw

#### Inheritance
- all controllers inherit from `Controller`
- `User` inherits from `Authenticatable`
- `Clinic`, `ClinicOperatingHour`, `DoctorClinicSchedule`, `Reservation`, `MedicalRecord` inherit from `Model`
- notification classes inherit from `Notification`

#### Core model associations
- same as ERD relationships

#### Controller-to-service dependencies
- `ReservationController ..> TimeWindowScheduler`
- `ReservationController ..> ReservationQueueService`
- `ReservationController ..> PatientNotificationService`
- `AdminReservationController ..> TimeWindowScheduler`
- `AdminReservationController ..> ReservationQueueService`
- `AdminReservationController ..> PatientNotificationService`
- `QueueController ..> ReservationQueueService`
- `QueueController ..> PatientNotificationService`
- `MedicalRecordController ..> ReservationQueueService`
- `MedicalRecordController ..> PatientNotificationService`
- `ReportController ..> ReportService`
- `ReportController ..> ReservationQueueService`

#### Service dependencies
- `PatientNotificationService ..> FonnteService`
- `PatientNotificationService ..> ReservationStatusNotification`
- `PatientNotificationService ..> QueueProgressNotification`
- `PatientNotificationService ..> MedicalRecordReadyNotification`
- `ReportService ..> Reservation`
- `ReportService ..> MedicalRecord`
- `ReportService ..> User`
- `ReservationQueueService ..> Reservation`
- `TimeWindowScheduler ..> DoctorClinicSchedule`

#### Notification dependencies
- `ReservationStatusNotification ..> Reservation`
- `QueueProgressNotification ..> Reservation`
- `MedicalRecordReadyNotification ..> Reservation`
- `MedicalRecordReadyNotification ..> MedicalRecord`

#### Export composition
- `ReservationsReportExport *-- SummarySheetExport`
- `ReservationsReportExport *-- DataSheetExport`
- `MedicalRecordsReportExport *-- SummarySheetExport`
- `MedicalRecordsReportExport *-- DataSheetExport`

### 2.4 Recommended Visual Paradigm layout

For the ERD:
- place `clinics` in the center
- place `users` on the left
- place `doctor_clinic_schedules` and `clinic_operating_hours` above/below `clinics`
- place `reservations` to the right
- place `medical_records` to the far right
- place `clinic_user` between `clinics` and `users`

For the class diagram:
- top row: controllers
- middle row: services and middleware
- bottom row: models, notifications, exports
- keep exports in a separate package block to avoid crossing lines with domain classes

### 2.5 Diagram completeness note

For thesis presentation:
- main diagrams should show domain and application logic only
- Laravel infrastructure tables and vendor classes should be mentioned in a short note, not placed in the main figure

That keeps the diagram truthful to the codebase while preserving readability.
