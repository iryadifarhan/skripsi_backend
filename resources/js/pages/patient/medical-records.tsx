import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import type { MedicalRecordEntry } from '@/types';

type PatientMedicalRecordsPageProps = {
    medicalRecords: MedicalRecordEntry[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PER_PAGE = 6;

function initialSearchQuery(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    return new URLSearchParams(window.location.search).get('search') ?? '';
}

export default function PatientMedicalRecordsPage({ medicalRecords }: PatientMedicalRecordsPageProps) {
    const [query, setQuery] = useState(initialSearchQuery);
    const [selectedId, setSelectedId] = useState<number | null>(medicalRecords[0]?.id ?? null);
    const [page, setPage] = useState(1);
    const [showDetail, setShowDetail] = useState(false);

    const filteredRecords = useMemo(() => {
        const keyword = query.trim().toLowerCase();

        if (keyword === '') {
            return medicalRecords;
        }

        return medicalRecords.filter((record) => {
            const searchableValues = [
                record.clinic?.name,
                record.doctor?.name,
                record.reservation?.reservation_number,
                record.reservation?.complaint,
                record.diagnosis,
                record.treatment,
                record.prescription_notes,
                record.doctor_notes,
            ];

            return searchableValues
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [medicalRecords, query]);

    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PER_PAGE));
    const safePage = Math.min(page, pageCount);
    const visibleRecords = filteredRecords.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
    const selectedRecord = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;

    useEffect(() => {
        setPage(1);
        setShowDetail(false);
    }, [query]);

    useEffect(() => {
        if (filteredRecords.length === 0) {
            setSelectedId(null);
            return;
        }

        if (!filteredRecords.some((record) => record.id === selectedId)) {
            setSelectedId(filteredRecords[0].id);
        }
    }, [filteredRecords, selectedId]);

    const selectRecord = (record: MedicalRecordEntry) => {
        setSelectedId(record.id);
        setShowDetail(true);
    };

    return (
        <div className="flex min-h-screen flex-col bg-[#DED0B6] font-sans text-[#40311D]">
            <Head title="Rekaman Medis" />
            <PublicNavbar />

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#40311D] mb-6">Rekaman medis</h1>

                <div className="relative mb-6 inline-flex items-center">
                    <svg
                        className="pointer-events-none absolute left-3 text-[#40311D] opacity-45"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari nama klinik, atau dokter..."
                        className="w-64 rounded-full border-[1.5px] border-[#40311D] bg-transparent py-2 pr-4 pl-9 text-sm text-[#40311D] outline-none transition-[width] placeholder:text-[#40311D]/45 placeholder:italic focus:w-80 focus:border-[#00917B] sm:w-72"
                    />
                </div>

                <section className="grid overflow-hidden rounded-xl border-[1.5px] border-[#40311D]/25 bg-[#40311D]/[0.03] md:grid-cols-[300px_1fr]">
                    <aside className={`${showDetail ? 'hidden md:block' : 'block'} border-b border-[#40311D]/18 md:border-r md:border-b-0`}>
                        {filteredRecords.length === 0 ? (
                            <p className="p-6 text-center text-sm text-[#40311D]/50">Rekam medis tidak ditemukan.</p>
                        ) : (
                            visibleRecords.map((record) => (
                                <RecordItem
                                    key={record.id}
                                    record={record}
                                    isActive={selectedRecord?.id === record.id}
                                    onClick={() => selectRecord(record)}
                                />
                            ))
                        )}

                        <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
                    </aside>

                    <section className={`${showDetail ? 'flex' : 'hidden md:flex'} min-h-[480px] flex-col`}>
                        {showDetail ? (
                            <button
                                type="button"
                                onClick={() => setShowDetail(false)}
                                className="flex items-center gap-1.5 border-b border-[#40311D]/10 px-4 py-3 text-xs font-semibold text-[#40311D]/60 transition-colors hover:text-[#40311D] md:hidden"
                            >
                                &larr; Kembali ke daftar
                            </button>
                        ) : null}
                        <RecordDetail record={selectedRecord} />
                    </section>
                </section>
            </main>

            <PublicFooter />
        </div>
    );
}

function RecordItem({ record, isActive, onClick }: { record: MedicalRecordEntry; isActive: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`block w-full cursor-pointer border-b border-[#40311D]/10 px-4 py-3 text-left transition-colors ${
                isActive ? 'border-l-[3px] border-l-[#00917B] bg-[#00917B]/10' : 'hover:bg-[#40311D]/5'
            }`}
        >
            <div className="mb-1 flex items-start justify-between">
                <span className={`text-sm leading-tight font-bold ${isActive ? 'text-[#00917B]' : 'text-[#40311D]'}`}>{record.clinic?.name ?? '-'}</span>
                <span className="ml-2 whitespace-nowrap text-xs text-[#40311D]/50">{dateLabel(record.issued_at)}</span>
            </div>
            <p className="mb-1.5 text-xs text-[#40311D]/65">{record.doctor?.name ?? '-'}</p>
            <span className="inline-block rounded-full bg-[#00917B]/12 px-2 py-0.5 text-[11px] font-semibold text-[#00917B]">
                {record.diagnosis || record.reservation?.complaint || 'Rekam medis'}
            </span>
        </button>
    );
}

function RecordDetail({ record }: { record: MedicalRecordEntry | null }) {
    if (!record) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-[#40311D]/30">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
                <p className="text-sm">Pilih rekam medis untuk melihat detail</p>
            </div>
        );
    }

    const reservationNumber = record.reservation?.reservation_number ?? `MR-${record.id}`;
    const status = record.reservation?.status ?? 'completed';

    return (
        <article className="flex h-full flex-col p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#40311D]/12 pb-4">
                <div>
                    <h2 className="text-base font-bold text-[#40311D]">{record.clinic?.name ?? '-'}</h2>
                    <p className="mt-0.5 text-xs text-[#40311D]/55">{record.doctor?.name ?? '-'}</p>
                </div>
                <span className="whitespace-nowrap rounded-md bg-[#40311D] px-3 py-1.5 text-xs font-semibold text-[#DED0B6]">{dateLabel(record.issued_at)}</span>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Nama Klinik" value={record.clinic?.name ?? '-'} />
                <DetailField label="Dokter" value={record.doctor?.name ?? '-'} />
                <DetailField label="Penyakit" value={record.reservation?.complaint ?? record.diagnosis ?? '-'} />
                <DetailField label="Tanggal" value={dateLabel(record.issued_at)} />
            </div>

            <hr className="mb-5 border-[#40311D]/10" />

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Nama Pasien" value={patientName(record)} />
                <DetailField label="Diagnosa" value={record.diagnosis ?? '-'} />
                <DetailField label="Pengobatan" value={record.treatment ?? '-'} full />
                <DetailField label="Catatan Resep" value={record.prescription_notes ?? '-'} />
                <DetailField label="Catatan Dokter" value={record.doctor_notes} />
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#40311D]/12 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00917B]/12 px-3 py-1.5 text-xs font-semibold text-[#00917B]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00917B]" />
                        Status : {statusLabel(status)}
                    </span>
                    <span className="text-[11px] font-medium text-[#40311D]/40">{reservationNumber}</span>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-md bg-[#40311D] px-3 py-1.5 text-[11px] font-semibold text-[#DED0B6] transition-opacity hover:opacity-75"
                    >
                        export as pdf
                    </button>
                </div>
            </div>
        </article>
    );
}

function DetailField({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
    return (
        <div className={full ? 'sm:col-span-2' : ''}>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-[#40311D]/45 uppercase">{label}</p>
            <p className="text-sm leading-relaxed font-medium text-[#40311D]">{value}</p>
        </div>
    );
}

function Pagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 3);

    return (
        <div className="flex items-center justify-center gap-1.5 border-t border-[#40311D]/10 px-4 py-3">
            <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#40311D]/25 text-xs font-medium text-[#40311D] transition-colors hover:bg-[#40311D]/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
                &lsaquo;
            </button>
            {pages.map((item) => (
                <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                        item === page ? 'border-[#40311D] bg-[#40311D] text-[#DED0B6]' : 'border-[#40311D]/25 text-[#40311D] hover:bg-[#40311D]/8'
                    }`}
                >
                    {item}
                </button>
            ))}
            {pageCount > 3 ? <span className="text-xs text-[#40311D]/50">...</span> : null}
            <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#40311D]/25 text-xs font-medium text-[#40311D] transition-colors hover:bg-[#40311D]/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
                &rsaquo;
            </button>
        </div>
    );
}

function patientName(record: MedicalRecordEntry): string {
    return record.patient?.name ?? record.guest_name ?? 'Walk-in Patient';
}

function statusLabel(value: string): string {
    const normalized = value.toLowerCase();

    if (normalized === 'completed') {
        return 'Completed';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

function dateLabel(value?: string | null): string {
    const date = dateParts(value);

    if (date === null) {
        return '-';
    }

    return `${String(date.day).padStart(2, '0')} ${MONTHS[date.month - 1]} ${date.year}`;
}

function dateParts(value?: string | null): { day: number; month: number; year: number } | null {
    if (!value) {
        return null;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
        return null;
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };
}
