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
    clinic_id?: number;
    status: string;
    reservation_date: string;
    window_start_time: string;
    window_end_time: string;
    complaint?: string | null;
    reschedule_reason?: string | null;
    cancellation_reason?: string | null;
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

export type QueueEntry = {
    reservation_id: number;
    reservation_number: string;
    reservation_date: string;
    reservation_status: string;
    complaint?: string | null;
    guest_name?: string | null;
    patient?: {
        id: number;
        name: string;
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
        status: string;
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
    operating_hours?: {
        id: number;
        clinic_id: number;
        day_of_week: number;
        open_time: string | null;
        close_time: string | null;
        is_closed: boolean;
    }[];
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
