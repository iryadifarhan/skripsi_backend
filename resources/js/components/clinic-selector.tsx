import type { WorkspaceClinic } from '@/types';

type ClinicSelectorProps = {
    clinics: WorkspaceClinic[];
    value: number | string | null | undefined;
    onChange: (clinicId: string) => void;
    label?: string;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
};

export function ClinicSelector({
    clinics,
    value,
    onChange,
    label = 'Klinik',
    className = '',
    disabled = false,
    placeholder,
}: ClinicSelectorProps) {
    return (
        <section className={`rounded-xl border border-gray-200 bg-white px-4 py-3 ${className}`}>
            <label className="flex w-full flex-col gap-2 text-[12px] font-medium text-[#40311D]">
                {label}
                <select
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled || clinics.length === 0}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none transition focus:border-[#40311D] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                    {placeholder ? <option value="">{placeholder}</option> : null}
                    {clinics.length === 0 ? <option value="">Tidak ada klinik</option> : null}
                    {clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                            {clinic.name}
                        </option>
                    ))}
                </select>
            </label>
        </section>
    );
}
