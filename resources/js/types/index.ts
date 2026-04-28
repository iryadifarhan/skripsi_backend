export type AuthUser = {
    id: number;
    name: string;
    username: string;
    email: string;
    role: 'superadmin' | 'admin' | 'doctor' | 'patient';
    phone_number?: string | null;
    profile_picture?: string | null;
    image_url?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    clinic?: {
        id: number;
        name: string;
    } | null;
};

export type WorkspaceClinic = {
    id: number;
    name: string;
};

export type WorkspaceContext = {
    role: AuthUser['role'];
    clinicId: number | null;
    clinics: WorkspaceClinic[];
};

export type ReservationEntry = {
    id: number;
    reservation_number: string;
    patient_id?: number | null;
    clinic_id?: number;
    doctor_id?: number;
    doctor_clinic_schedule_id?: number;
    status: string;
    reservation_date: string;
    window_start_time: string;
    window_end_time: string;
    window_slot_number?: number | null;
    complaint?: string | null;
    guest_name?: string | null;
    guest_phone_number?: string | null;
    admin_notes?: string | null;
    reschedule_reason?: string | null;
    cancellation_reason?: string | null;
    patient?: {
        id: number;
        name: string;
        username?: string;
        email?: string;
        phone_number?: string | null;
        gender?: string | null;
    } | null;
    clinic?: {
        id: number;
        name: string;
    } | null;
    doctor?: {
        id: number;
        name: string;
    } | null;
    queue_summary?: {
        number?: number | null;
        status?: string | null;
        position?: number | null;
        waiting_ahead?: number | null;
        size?: number | null;
        current_called_number?: number | null;
        is_current?: boolean;
    } | null;
};

export type PatientSummaryEntry = {
    type: 'registered';
    id: number;
    name: string;
    username: string;
    email: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    image_url?: string | null;
    reservation_count: number;
    medical_record_count: number;
    latest_activity_at?: string | null;
};

export type WalkInPatientSummaryEntry = {
    type: 'walk_in';
    walk_in_key: string;
    key: string;
    name: string;
    phone_number?: string | null;
    reservation_count: number;
    medical_record_count: number;
    latest_activity_at?: string | null;
    clinics?: string[];
};

export type PatientDetailEntry = {
    type: 'registered' | 'walk_in';
    id?: number;
    walk_in_key?: string;
    name: string;
    username?: string;
    email?: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    image_url?: string | null;
    reservation_count?: number;
    medical_record_count?: number;
    latest_activity_at?: string | null;
};

export type QueueEntry = {
    reservation_id: number;
    reservation_number: string;
    patient_id?: number | null;
    reservation_date: string;
    reservation_status: string;
    complaint?: string | null;
    guest_name?: string | null;
    guest_phone_number?: string | null;
    patient?: {
        id: number;
        name: string;
        username?: string;
        email?: string;
        phone_number?: string | null;
        gender?: string | null;
    } | null;
    doctor?: {
        id: number;
        name: string;
    } | null;
    clinic?: {
        id: number;
        name: string;
    } | null;
    window: {
        start_time: string;
        end_time: string;
        slot_number: number | null;
    };
    queue: {
        number: number | null;
        status: string;
        size: number;
        current_called_number: number | null;
        position: number | null;
        waiting_ahead: number | null;
        is_current: boolean;
    };
};

export type MedicalRecordEntry = {
    id: number;
    reservation_id: number;
    patient_id: number | null;
    guest_name?: string | null;
    diagnosis?: string | null;
    treatment?: string | null;
    prescription_notes?: string | null;
    doctor_notes: string;
    issued_at: string;
    patient?: {
        id: number;
        name: string;
        username?: string;
        email?: string;
        phone_number?: string | null;
    } | null;
    doctor?: {
        id: number;
        name: string;
    } | null;
    clinic?: {
        id: number;
        name: string;
    } | null;
    reservation?: {
        id: number;
        reservation_number: string;
        reservation_date: string;
        window_start_time?: string;
        window_end_time?: string;
        status: string;
        complaint?: string | null;
        reschedule_reason?: string | null;
    } | null;
};

export type DoctorEntry = {
    id: number;
    name: string;
    username: string;
    email: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    image_path?: string | null;
    image_url?: string | null;
    role?: AuthUser['role'];
    specialities?: string[];
    speciality?: string[];
};

export type ClinicDetail = {
    id: number;
    name: string;
    address: string;
    phone_number: string;
    email: string;
    image_url?: string | null;
    specialities: string[];
    doctors: DoctorEntry[];
    admins?: {
        id: number;
        name: string;
        username: string;
        email: string;
        phone_number?: string | null;
        date_of_birth?: string | null;
        gender?: string | null;
        email_verified_at?: string | null;
        created_at?: string | null;
    }[];
    operating_hours?: {
        id: number;
        clinic_id: number;
        day_of_week: number;
        open_time: string | null;
        close_time: string | null;
        is_closed: boolean;
    }[];
};

export type DoctorClinicScheduleEntry = {
    id: number;
    clinic_id: number;
    doctor_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    window_minutes: number;
    max_patients_per_window: number;
    is_active: boolean;
    doctor?: {
        id: number;
        name: string;
        email?: string | null;
        phone_number?: string | null;
    } | null;
};

export type SharedData = {
    auth?: {
        user: AuthUser | null;
    };
    app?: {
        name: string;
    };
    flash?: {
        status?: string | null;
    };
};

export type ValidationErrors = Record<string, string[]>;
