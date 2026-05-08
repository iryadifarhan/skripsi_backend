import { Head, Link } from '@inertiajs/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import {
    ClinicImage,
    EmptyDirectory,
    matchesText,
    type DirectoryFilters,
    type PublicClinic,
} from '@/pages/public/directory-components';
import { defaultPublicTimeFilter, isDefaultPublicTimeFilter, matchesPublicTimeFilter, PublicTimePicker, type PublicTimeFilterState } from '@/pages/public/time-filter';

type ClinicListProps = {
    clinics: PublicClinic[];
    filters: DirectoryFilters;
};

export default function ClinicListPage({ clinics, filters }: ClinicListProps) {
    const [search, setSearch] = useState('');
    const [citySearch, setCitySearch] = useState('');
    const [specialitySearch, setSpecialitySearch] = useState('');
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);
    const [time, setTime] = useState<PublicTimeFilterState>(defaultPublicTimeFilter);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const filteredClinics = useMemo(
        () =>
            clinics.filter((clinic) => {
                const doctorNames = clinic.doctors.map((doctor) => doctor.name);
                const cityMatches = selectedCities.length === 0 || selectedCities.some((city) => city.toLowerCase() === (clinic.city_name ?? '').toLowerCase());
                const specialityMatches =
                    selectedSpecialities.length === 0 ||
                    clinic.specialities.some((speciality) => selectedSpecialities.some((selected) => selected.toLowerCase() === speciality.toLowerCase()));

                return (
                    matchesText(search, [clinic.name, clinic.location, clinic.email, clinic.phone_number, ...clinic.specialities, ...doctorNames]) &&
                    cityMatches &&
                    specialityMatches &&
                    matchesPublicTimeFilter(time, clinic.time_ranges)
                );
            }),
        [clinics, search, selectedCities, selectedSpecialities, time],
    );

    const resetFilters = () => {
        setSearch('');
        setCitySearch('');
        setSpecialitySearch('');
        setSelectedCities([]);
        setSelectedSpecialities([]);
        setTime(defaultPublicTimeFilter);
    };

    const filterPanel = (
        <DirectoryFilterPanel
            cityOptions={filters.cities}
            specialityOptions={filters.specialities}
            citySearch={citySearch}
            specialitySearch={specialitySearch}
            selectedCities={selectedCities}
            selectedSpecialities={selectedSpecialities}
            time={time}
            onCitySearchChange={setCitySearch}
            onSpecialitySearchChange={setSpecialitySearch}
            onCityToggle={(city) => toggleFilterValue(selectedCities, city, setSelectedCities)}
            onSpecialityToggle={(speciality) => toggleFilterValue(selectedSpecialities, speciality, setSelectedSpecialities)}
            onTimeChange={setTime}
            onTimeReset={() => setTime(defaultPublicTimeFilter)}
        />
    );

    return (
        <>
            <Head title="Cari Klinik" />
            <div className="min-h-screen bg-[#DED0B6] text-[#40311D]">
                <PublicNavbar />

                <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-12 md:px-8">
                    <PageHeader
                        title="Cari Klinik"
                        placeholder="Cari nama klinik, spesialisasi, atau lokasi..."
                        search={search}
                        count={filteredClinics.length}
                        onSearchChange={setSearch}
                    />

                    <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
                        <aside className="hidden space-y-4 lg:block">{filterPanel}</aside>

                        {filteredClinics.length === 0 ? (
                            <EmptyDirectory>Tidak ada klinik yang sesuai dengan filter saat ini.</EmptyDirectory>
                        ) : (
                            <section className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
                                {filteredClinics.map((clinic) => (
                                    <ClinicDirectoryCard key={clinic.id} clinic={clinic} />
                                ))}
                            </section>
                        )}
                    </div>
                </main>

                <PublicFooter />

                <MobileFilterButton activeCount={selectedCities.length + selectedSpecialities.length + (isDefaultPublicTimeFilter(time) ? 0 : 1)} onClick={() => setFiltersOpen(true)} />

                <FilterModal open={filtersOpen} resultCount={filteredClinics.length} onClose={() => setFiltersOpen(false)} onReset={resetFilters}>
                    {filterPanel}
                </FilterModal>
            </div>
        </>
    );
}

function PageHeader({
    title,
    placeholder,
    search,
    count,
    onSearchChange,
}: {
    title: string;
    placeholder: string;
    search: string;
    count: number;
    onSearchChange: (value: string) => void;
}) {
    return (
        <section className="mb-8">
            <h1 className="mb-5 text-3xl font-black md:text-5xl">{title}</h1>
            <div className="flex max-w-[480px] items-center gap-3 rounded-full border border-[#40311D]/30 bg-transparent px-5 py-3 transition focus-within:border-[#00917B] focus-within:ring-4 focus-within:ring-[#00917B]/10">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4 text-[#40311D]/35" />
                <input
                    type="search"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm font-medium text-[#40311D] outline-none placeholder:text-[#40311D]/35 placeholder:italic"
                />
                {search !== '' ? (
                    <button type="button" onClick={() => onSearchChange('')} className="text-xs font-bold text-[#40311D]/45 hover:text-[#40311D]">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                ) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-[#40311D]/45">Menampilkan : {count} hasil</p>
        </section>
    );
}

function DirectoryFilterPanel({
    cityOptions,
    specialityOptions,
    citySearch,
    specialitySearch,
    selectedCities,
    selectedSpecialities,
    time,
    onCitySearchChange,
    onSpecialitySearchChange,
    onCityToggle,
    onSpecialityToggle,
    onTimeChange,
    onTimeReset,
}: {
    cityOptions: string[];
    specialityOptions: string[];
    citySearch: string;
    specialitySearch: string;
    selectedCities: string[];
    selectedSpecialities: string[];
    time: PublicTimeFilterState;
    onCitySearchChange: (value: string) => void;
    onSpecialitySearchChange: (value: string) => void;
    onCityToggle: (value: string) => void;
    onSpecialityToggle: (value: string) => void;
    onTimeChange: (value: PublicTimeFilterState) => void;
    onTimeReset: () => void;
}) {
    const visibleCities = cityOptions.filter((city) => city.toLowerCase().includes(citySearch.toLowerCase()));
    const visibleSpecialities = specialityOptions.filter((speciality) => speciality.toLowerCase().includes(specialitySearch.toLowerCase()));

    return (
        <>
            <FilterGroup title="Pilih Kota">
                <FilterSearch value={citySearch} placeholder="Cari Lokasi" onChange={onCitySearchChange} />
                <CheckboxList emptyLabel="Kota tidak ditemukan." options={visibleCities} selected={selectedCities} onToggle={onCityToggle} />
            </FilterGroup>

            <FilterGroup title="Pilih Spesialis">
                <FilterSearch value={specialitySearch} placeholder="Cari Spesialisasi" onChange={onSpecialitySearchChange} />
                <CheckboxList emptyLabel="Spesialis tidak ditemukan." maxHeight options={visibleSpecialities} selected={selectedSpecialities} onToggle={onSpecialityToggle} />
            </FilterGroup>

            <FilterGroup title="Pilih Waktu">
                <PublicTimePicker value={time} onChange={onTimeChange} onReset={onTimeReset} />
            </FilterGroup>
        </>
    );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-[#40311D]/15 bg-[#40311D]/[0.02] px-4 py-4">
            <h2 className="mb-3 border-b border-[#40311D]/10 pb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#40311D]/45">{title}</h2>
            {children}
        </section>
    );
}

function FilterSearch({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
    return (
        <div className="mb-3 flex items-center gap-2 rounded-full border border-[#40311D]/20 bg-transparent px-3 py-2">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3 w-3 text-[#40311D]/35" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-xs text-[#40311D] outline-none placeholder:text-[#40311D]/35 placeholder:italic"
                type="search"
            />
        </div>
    );
}

function CheckboxList({
    options,
    selected,
    onToggle,
    emptyLabel,
    maxHeight = false,
}: {
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
    emptyLabel: string;
    maxHeight?: boolean;
}) {
    if (options.length === 0) {
        return <p className="text-xs text-[#40311D]/40">{emptyLabel}</p>;
    }

    return (
        <div className={maxHeight ? 'max-h-[140px] space-y-2 overflow-y-auto pr-1' : 'space-y-2'}>
            {options.map((option) => (
                <label key={option} className="flex cursor-pointer items-start gap-2 text-[13px] font-medium leading-snug text-[#2c2115]">
                    <input
                        type="checkbox"
                        checked={selected.includes(option)}
                        onChange={() => onToggle(option)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-[#40311D]/25 accent-[#40311D]"
                    />
                    <span>{option}</span>
                </label>
            ))}
        </div>
    );
}

function ClinicDirectoryCard({ clinic }: { clinic: PublicClinic }) {
    return (
        <Link
            href={`/klinik/${clinic.slug}`}
            className="group grid grid-cols-[56px_minmax(0,1fr)] gap-4 rounded-xl bg-[#dacdb5] p-5 text-[#40311D] transition hover:-translate-y-0.5 hover:bg-[#d7c8ad]/70 hover:shadow-[0_10px_26px_rgba(64,49,29,0.08)]"
        >
            <div className="mt-0.5 h-14 w-14 overflow-hidden rounded-full">
                <ClinicImage imageUrl={clinic.image_url} name={clinic.name} className="rounded-full" />
            </div>

            <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-[-0.03em] group-hover:text-[#00917B]">{clinic.name}</h2>
                    <SmallStatusBadge active={clinic.is_open_now}>{clinic.is_open_now ? 'Buka' : 'Tutup'}</SmallStatusBadge>
                </div>
                <div className="mt-1 text-xs font-medium leading-relaxed text-[#40311D]/55">
                    <p className="line-clamp-1">{clinic.address ?? clinic.location ?? '-'}</p>
                    <p>{clinic.phone_number ?? '-'}</p>
                    <p className="line-clamp-1">{clinic.email ?? '-'}</p>
                </div>

                <p className="mt-4 text-xs font-medium text-[#40311D]/50">
                    Jam Operasional : <span className="font-bold text-[#40311D]/65">{clinic.operational_label}, {clinic.hours_label}</span>
                </p>

                <TagList items={clinic.specialities} fallback="Klinik umum" />
            </div>
        </Link>
    );
}

function SmallStatusBadge({ active, children }: { active: boolean; children: ReactNode }) {
    return (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${active ? 'bg-[#00917B]/15 text-[#00836f]' : 'bg-[#d95d4f]/12 text-[#d95d4f]'}`}>
            {children}
        </span>
    );
}

function TagList({ items, fallback }: { items: string[]; fallback: string }) {
    const visible = items.length > 0 ? items.slice(0, 2) : [fallback];

    return (
        <div className="mt-3 flex flex-wrap gap-1.5">
            {visible.map((item) => (
                <span key={item} className="rounded-full border border-[#40311D]/14 px-2 py-0.5 text-[10px] font-bold text-[#40311D]/55">
                    {item}
                </span>
            ))}
            {items.length > visible.length ? (
                <span className="rounded-full border border-[#40311D]/14 px-2 py-0.5 text-[10px] font-bold text-[#40311D]/55">+{items.length - visible.length}</span>
            ) : null}
        </div>
    );
}

function MobileFilterButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#40311D] px-5 py-3 text-sm font-black text-[#DED0B6] shadow-xl lg:hidden"
        >
            <FontAwesomeIcon icon={faFilter} />
            Filter
            {activeCount > 0 ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00917B] text-[11px]">{activeCount}</span> : null}
        </button>
    );
}

function FilterModal({
    open,
    resultCount,
    children,
    onClose,
    onReset,
}: {
    open: boolean;
    resultCount: number;
    children: ReactNode;
    onClose: () => void;
    onReset: () => void;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#2c2115]/45 lg:hidden" onClick={onClose}>
            <div className="max-h-[82vh] w-full overflow-y-auto rounded-t-3xl bg-[#DED0B6] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <p className="text-lg font-black text-[#2c2115]">Filter</p>
                        <p className="text-xs text-[#40311D]/45">Kota, spesialis, dan waktu.</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#40311D]/15 text-[#40311D]">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="space-y-4">{children}</div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                    <button type="button" onClick={onReset} className="rounded-full border border-[#40311D]/20 px-4 py-3 text-sm font-bold text-[#40311D]">
                        Reset
                    </button>
                    <button type="button" onClick={onClose} className="rounded-full bg-[#40311D] px-4 py-3 text-sm font-bold text-[#DED0B6]">
                        Tampilkan {resultCount}
                    </button>
                </div>
            </div>
        </div>
    );
}

function toggleFilterValue(values: string[], value: string, setter: (values: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
}
