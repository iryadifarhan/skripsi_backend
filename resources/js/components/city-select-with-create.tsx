import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

export type ClinicCityOption = {
    id: number;
    name: string;
};

export function CitySelectWithCreate({
    label = 'Kota',
    value,
    cities,
    error,
    cityName,
    cityError,
    savingCity,
    onChange,
    onCityNameChange,
    onCitySubmit,
}: {
    label?: string;
    value: string;
    cities: ClinicCityOption[];
    error?: string;
    cityName: string;
    cityError?: string;
    savingCity: boolean;
    onChange: (value: string) => void;
    onCityNameChange: (value: string) => void;
    onCitySubmit: () => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const selectedCity = cities.find((city) => String(city.id) === value) ?? null;

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!rootRef.current || rootRef.current.contains(event.target as Node)) {
                return;
            }

            setOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);

        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    const submitCity = () => {
        if (cityName.trim() === '' || savingCity) {
            return;
        }

        onCitySubmit();
    };

    const handleCityInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        submitCity();
    };

    return (
        <div ref={rootRef} className="relative flex flex-col gap-2 text-[12px] font-medium text-[#40311D]">
            {label}
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-left text-[12px] outline-none transition ${
                    open ? 'border-[#40311D]' : 'border-gray-300'
                }`}
            >
                <span className={selectedCity ? 'text-gray-700' : 'text-gray-400'}>
                    {selectedCity?.name ?? 'Pilih kota'}
                </span>
                <span className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>v</span>
            </button>

            {open ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#e4ddd4] bg-white shadow-xl">
                    <div className="max-h-48 overflow-y-auto py-1">
                        {cities.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] italic text-gray-400">Belum ada kota.</p>
                        ) : (
                            cities.map((city) => {
                                const selected = String(city.id) === value;

                                return (
                                    <button
                                        key={city.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(String(city.id));
                                            setOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition-colors hover:bg-[#faf9f7] ${
                                            selected ? 'bg-[#faf9f7] font-medium text-[#40311D]' : 'text-gray-700'
                                        }`}
                                    >
                                        {city.name}
                                        {selected ? <span className="text-[11px] text-teal-700">Terpilih</span> : null}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t border-[#e4ddd4] bg-[#faf9f7] p-3">
                        <p className="text-[11px] font-medium text-[#40311D]">Tambah kota baru</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={cityName}
                                onChange={(event) => onCityNameChange(event.target.value)}
                                onKeyDown={handleCityInputKeyDown}
                                placeholder="Contoh: Jakarta Pusat"
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-700 outline-none placeholder:italic placeholder:text-gray-400 focus:border-[#40311D]"
                            />
                            <button
                                type="button"
                                onClick={submitCity}
                                disabled={savingCity || cityName.trim() === ''}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-[#40311D] transition hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingCity ? 'Menambah...' : 'Tambah'}
                            </button>
                        </div>
                        {cityError ? <span className="mt-2 block text-[11px] font-medium text-red-600">{cityError}</span> : null}
                    </div>
                </div>
            ) : null}

            {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
        </div>
    );
}
