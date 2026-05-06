import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import reservasiImg from '@/assets/reservasi-mock.png';
import { PublicFooter } from '@/components/landing/public-footer';
import { PublicNavbar } from '@/components/landing/public-navbar';
import type { ReservationEntry } from '@/types';

type HomeClinic = {
    id: number;
    name: string;
    address?: string | null;
    city_name?: string | null;
    image_url?: string | null;
    specialities?: string[];
    doctors: {
        id: number;
        name: string;
        specialities?: string[];
    }[];
    slots: {
        time: string;
        filled: number;
        capacity: number;
    }[];
};

type HomeDoctor = {
    id: number;
    name: string;
    image_url?: string | null;
    specialities?: string[];
    clinics: {
        id: number;
        name: string;
        city_name?: string | null;
        specialities?: string[];
    }[];
};

type PatientHomeProps = {
    userName: string;
    currentReservation: ReservationEntry | null;
    lastReservation: ReservationEntry | null;
    clinics: HomeClinic[];
    doctors: HomeDoctor[];
};

const STYLES = `
  :root {
    --hp-cream: #DED0B6;
    --hp-dark: #40311D;
    --hp-deep: #2c2115;
    --hp-teal: #00917B;
    --hp-silver: #DFE0DF;
    --hp-page-max: 1180px;
    --hp-page-pad: 1.5rem;
  }

  .hp-page { min-height: 100vh; background: var(--hp-cream); color: var(--hp-dark); font-family: 'Work Sans', sans-serif; }
  .hp-container { width: 100%; max-width: var(--hp-page-max); margin: 0 auto; padding: 0 var(--hp-page-pad); }
  .hp-body { padding: 2rem 0 4rem; overflow: visible; }
  .hp-hero { display: grid; grid-template-columns: 220px minmax(0,1fr) minmax(0,1fr); justify-items: stretch; gap: 2.5rem; align-items: start; padding: 2rem 0; margin-bottom: 2.5rem; border-bottom: 1px dashed rgba(64,49,29,.2); animation: hpFadeUp .5s ease both; }
  @keyframes hpFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

  .hp-greeting-label { font-size: 1rem; font-weight: 600; opacity: .6; margin-bottom: .3rem; }
  .hp-clock { font-size: clamp(4.4rem, 8vw, 5.2rem); font-weight: 700; letter-spacing: -.05em; line-height: 1; }
  .hp-clock-tz { font-size: .78rem; font-weight: 500; opacity: .5; margin-left: .3rem; vertical-align: super; }
  .hp-location { font-size: .78rem; opacity: .55; margin-top: .5rem; }
  .hp-booking-col, .hp-booking-col-middle { padding-left: 2rem; border-left: 1px solid rgba(64,49,29,.12); min-width: 0; }
  .hp-booking-label { font-size: .75rem; font-weight: 700; opacity: .5; margin-bottom: .6rem; text-transform: uppercase; letter-spacing: .07em; }
  .hp-booking-clinic { font-size: clamp(1.25rem, 2.5vw, 1.92rem); font-weight: 700; color: var(--hp-dark); line-height: 1.1; margin-bottom: .4rem; }
  .hp-booking-chips { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; margin: .35rem 0 .6rem; }
  .hp-chip { font-size: .78rem; font-weight: 700; padding: .18rem .55rem; border-radius: 999px; background: var(--hp-dark); color: var(--hp-cream); white-space: nowrap; }
  .hp-chip-teal { background: var(--hp-teal); color: white; }
  .hp-booking-meta { font-size: .875rem; opacity: .62; line-height: 1.75; }
  .hp-empty { padding: .5rem 0; }
  .hp-empty-icon { font-size: 2.25rem; opacity: .3; margin-bottom: .4rem; }
  .hp-empty-text { font-size: .78rem; opacity: .55; margin-bottom: .65rem; line-height: 1.5; }
  .hp-empty-btns { display: flex; gap: .4rem; flex-wrap: wrap; }
  .hp-pill-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .85rem; border-radius: 999px; font-size: .75rem; font-weight: 700; border: 1.5px solid var(--hp-dark); background: var(--hp-dark); color: var(--hp-cream); text-decoration: none; transition: background .2s, border-color .2s; }
  .hp-pill-btn:hover { background: var(--hp-teal); border-color: var(--hp-teal); }
  .hp-pill-btn-outline { background: transparent; color: var(--hp-dark); }
  .hp-pill-btn-outline:hover { background: var(--hp-dark); color: var(--hp-cream); }

  .hp-section { margin-bottom: 2.5rem; animation: hpFadeUp .5s ease both; }
  .hp-section-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 1.1rem; }
  .hp-scroll-region { overflow-x: auto; overflow-y: visible; padding-bottom: .5rem; scrollbar-width: none; -ms-overflow-style: none; }
  .hp-scroll-region::-webkit-scrollbar { display: none; }
  .hp-card-grid { display: grid; grid-template-columns: repeat(6, 220px); gap: 1rem; grid-auto-flow: column; width: max-content; }
  .hp-card-scene { perspective: 1000px; width: 100%; aspect-ratio: 1 / 1; cursor: pointer; }
  .hp-card-flipper { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform .55s cubic-bezier(.4,0,.2,1); border-radius: 10px; }
  .hp-card-flipper.flipped { transform: rotateY(180deg); }
  .hp-card-front, .hp-card-back { position: absolute; inset: 0; border-radius: 10px; -webkit-backface-visibility: hidden; backface-visibility: hidden; overflow: hidden; }
  .hp-card-front { background: var(--hp-silver); background-size: cover; background-position: center; transition: box-shadow .2s; }
  .hp-card-front.ring { box-shadow: 0 0 0 3px var(--hp-teal); }
  .hp-flip-hint { position: absolute; right: 8px; bottom: 8px; border-radius: 8px; background: rgba(64,49,29,.78); color: var(--hp-cream); padding: 3px 7px; font-size: 10px; font-weight: 700; pointer-events: none; }
  .hp-card-back { background: var(--hp-cream); border: 1.5px solid rgba(64,49,29,.15); transform: rotateY(180deg); padding: .75rem; display: flex; flex-direction: column; gap: .2rem; font-size: .72rem; overflow-y: auto; }
  .hp-card-back::-webkit-scrollbar { width: 3px; }
  .hp-card-back::-webkit-scrollbar-thumb { background: rgba(64,49,29,.25); border-radius: 99px; }
  .hp-dark-back { background: #2a2016; border-color: rgba(222,208,182,.1); color: var(--hp-cream); }
  .hp-back-title { font-size: .82rem; font-weight: 800; margin-bottom: .1rem; }
  .hp-back-copy { font-size: .63rem; opacity: .65; line-height: 1.45; }
  .hp-back-section { font-size: .62rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; opacity: .45; margin: .35rem 0 .05rem; }
  .hp-back-row { display: flex; justify-content: space-between; gap: .5rem; font-size: .67rem; padding: .05rem 0; line-height: 1.4; }
  .hp-back-row span:first-child { opacity: .75; }
  .hp-slot-busy { color: #d97706; font-weight: 800; font-size: .63rem; }
  .hp-slot-full { color: #dc2626; font-weight: 800; font-size: .63rem; }
  .hp-slot-open { color: var(--hp-teal); font-weight: 800; font-size: .63rem; }
  .hp-back-link { margin-top: auto; font-size: .68rem; font-weight: 800; color: var(--hp-teal); text-decoration: none; width: fit-content;}
  .hp-card-scene:hover .hp-card-front:not(.ring) { box-shadow: 0 8px 20px rgba(64,49,29,.15); }
  .hp-card-label { margin-top: .45rem; font-size: .875rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--hp-dark); }
  .hp-card-label.teal { color: var(--hp-teal); }
  .hp-card-label.cream { color: var(--hp-cream); }
  .hp-label-sub { display: inline-block; margin-top: .1rem; font-weight: 500; opacity: .75; text-transform: none; letter-spacing: 0; }
  .hp-review-wrap { text-align: center; margin-top: 1.25rem; }
  .hp-review-btn { display: inline-block; padding: .5rem 1.75rem; border-radius: 999px; border: 1.5px solid var(--hp-dark); background: transparent; font-size: .85rem; font-weight: 700; color: var(--hp-dark); text-decoration: none; transition: background .2s, color .2s; }
  .hp-review-btn:hover { background: var(--hp-dark); color: var(--hp-cream); }
  .hp-dokter-bg { background: var(--hp-dark); color: var(--hp-cream); padding: 2rem 0 3rem; }
  .hp-dokter-bg .hp-card-front { background-color: rgba(222,208,182,.12); }
  .hp-dokter-bg .hp-review-btn { border-color: var(--hp-cream); color: var(--hp-cream); }
  .hp-dokter-bg .hp-review-btn:hover { background: var(--hp-cream); color: var(--hp-dark); }
  .hp-scroll-btn { position: absolute; top: 36%; z-index: 10; width: 32px; height: 32px; border: none; border-radius: 999px; background: var(--hp-dark); color: var(--hp-cream); display: flex; align-items: center; justify-content: center; }
  .hp-scroll-btn.left { left: -40px; }
  .hp-scroll-btn.right { right: -40px; }
  .hp-dokter-bg .hp-scroll-btn { background: var(--hp-cream); color: var(--hp-dark); }

  @media (max-width: 1024px) {
    .hp-hero { grid-template-columns: 1fr; gap: 1.5rem; }
    .hp-booking-col, .hp-booking-col-middle { padding-left: 0; border-left: none; border-top: 1px solid rgba(64,49,29,.12); padding-top: 1rem; }
  }
  @media (max-width: 768px) {
    :root { --hp-page-pad: 1rem; }
    .hp-card-grid { grid-template-columns: repeat(6, 190px); }
    .hp-scroll-btn { display: none; }
  }
`;

function useLiveClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const tick = window.setInterval(() => setTime(new Date()), 1000);

        return () => window.clearInterval(tick);
    }, []);

    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 3) return 'Selamat malam';
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 19) return 'Selamat sore';

    return 'Selamat malam';
}

function getSlotStatus(filled: number, capacity: number) {
    if (capacity <= 0 || filled >= capacity) return { label: 'Penuh', className: 'hp-slot-full' };

    const ratio = filled / capacity;

    if (ratio >= 0.75) return { label: 'Sibuk', className: 'hp-slot-busy' };
    if (ratio >= 0.5) return { label: 'Sedang', className: 'hp-slot-busy' };

    return { label: 'Tersedia', className: 'hp-slot-open' };
}

function dateLabel(value?: string | null) {
    if (!value) return '-';

    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    if (!year || !month || !day) return value;

    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(year, month - 1, day));
}

function shortTime(value?: string | null) {
    return value ? value.slice(0, 5) : '-';
}


function reservationLocation(reservation: ReservationEntry | null) {
    const clinic = reservation?.clinic as ({ address?: string | null; city?: { name?: string | null } | null; city_name?: string | null } & ReservationEntry['clinic']) | undefined;
    const city = clinic?.city?.name ?? clinic?.city_name;

    return [clinic?.address, city].filter(Boolean).join(', ') || 'Lokasi klinik';
}

function ScrollableCards({
    children,
    dark = false,
}: {
    children: ReactNode;
    dark?: boolean;
}) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [canScroll, setCanScroll] = useState(false);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    useEffect(() => {
        const checkScroll = () => {
            const el = scrollRef.current;
            if (!el) return;

            const hasOverflow = el.scrollWidth > el.clientWidth;
            setCanScroll(hasOverflow);
            setAtStart(el.scrollLeft <= 0);
            setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
        };

        checkScroll();
        const el = scrollRef.current;
        el?.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);

        return () => {
            el?.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [children]);

    return (
        <div className="relative">
            {canScroll && !atStart ? (
                <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })} className="hp-scroll-btn left">
                    &lt;
                </button>
            ) : null}
            <div ref={scrollRef} className="hp-scroll-region">
                <div className="hp-card-grid">{children}</div>
            </div>
            {canScroll && !atEnd ? (
                <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })} className={`hp-scroll-btn right ${dark ? 'dark' : ''}`}>
                    &gt;
                </button>
            ) : null}
        </div>
    );
}

function KlinikBack({ clinic }: { clinic: HomeClinic }) {
    return (
        <div className="hp-card-back">
            <div className="hp-back-title">{clinic.name}</div>
            <div className="hp-back-copy">{[clinic.address, clinic.city_name].filter(Boolean).join(', ') || 'Informasi lokasi klinik belum lengkap.'}</div>
            <div className="hp-back-section">Dokter aktif</div>
            {clinic.doctors.length > 0 ? (
                clinic.doctors.map((doctor) => (
                    <div key={doctor.id} className="hp-back-row">
                        <span>{doctor.name}</span>
                        <span className="text-right opacity-60">{doctor.specialities?.join(', ') || 'Dokter umum'}</span>
                    </div>
                ))
            ) : (
                <div className="hp-back-copy">Belum ada dokter terhubung.</div>
            )}
            <div className="hp-back-section">Slot terdekat</div>
            {clinic.slots.length > 0 ? (
                clinic.slots.map((slot) => {
                    const status = getSlotStatus(slot.filled, slot.capacity);

                    return (
                        <div key={slot.time} className="hp-back-row">
                            <span>{slot.time}</span>
                            <span className={status.className}>
                                {status.label} ({slot.filled}/{slot.capacity})
                            </span>
                        </div>
                    );
                })
            ) : (
                <div className="hp-back-copy">Belum ada jadwal aktif.</div>
            )}
            <Link href="/reservasi" className="hp-back-link">
                Buat reservasi -&gt;
            </Link>
        </div>
    );
}

function DokterBack({ doctor }: { doctor: HomeDoctor }) {
    return (
        <div className="hp-card-back hp-dark-back">
            <div className="hp-back-title">{doctor.name}</div>
            <div className="hp-back-copy">{doctor.specialities?.join(', ') || 'Spesialisasi klinik belum diatur.'}</div>
            <div className="hp-back-section text-white">Klinik praktik</div>
            {doctor.clinics.length > 0 ? (
                doctor.clinics.map((clinic) => (
                    <div key={clinic.id} className="hp-back-row">
                        <span>{clinic.name}</span>
                        <span className="text-right text-[#00917B]">{clinic.city_name ?? 'Kota belum diatur'}</span>
                    </div>
                ))
            ) : (
                <div className="hp-back-copy">Belum terhubung ke klinik.</div>
            )}
            <Link href="/reservasi" className="hp-back-link">
                Reservasi dokter -&gt;
            </Link>
        </div>
    );
}

function FlipCard({
    image,
    label,
    subLabel,
    isActive,
    onClick,
    back,
    isDark = false,
}: {
    image?: string | null;
    label: string;
    subLabel?: string | null;
    isActive: boolean;
    onClick: () => void;
    back: ReactNode;
    isDark?: boolean;
}) {
    return (
        <div>
            <div className="hp-card-scene" onClick={onClick}>
                <div className={`hp-card-flipper ${isActive ? 'flipped' : ''}`}>
                    <div
                        className={`hp-card-front ${isActive ? 'ring' : ''}`}
                        style={{ backgroundImage: `url(${image || reservasiImg})` }}
                    >
                        {!isActive ? <div className="hp-flip-hint">lihat</div> : null}
                    </div>
                    {back}
                </div>
            </div>
            <div className={`hp-card-label ${isActive ? 'teal' : isDark ? 'cream' : ''}`}>
                {label}
                <br />
                <span className="hp-label-sub">{subLabel || '-'}</span>
            </div>
        </div>
    );
}

export default function PatientHome({ userName, currentReservation, lastReservation, clinics, doctors }: PatientHomeProps) {
    const clock = useLiveClock();
    const greeting = getGreeting();
    const [activeClinic, setActiveClinic] = useState<number | null>(null);
    const [activeDoctor, setActiveDoctor] = useState<number | null>(null);

    const waitingAhead = currentReservation?.queue_summary?.waiting_ahead;
    const estimatedWait = typeof waitingAhead === 'number' ? `~${waitingAhead * 20} menit` : '-';

    return (
        <>
            <Head title="Beranda" />
            <style>{STYLES}</style>
            <div className="hp-page">
                <PublicNavbar />
                <div className="hp-container">
                    <main className="hp-body">
                        <section className="hp-hero lg:text-start text-center">
                            <div>
                                <div className="hp-greeting-label">
                                    {greeting}, {userName}
                                </div>
                                <div className="hp-clock">
                                    {clock}
                                    <span className="hp-clock-tz">WIB</span>
                                </div>
                                <div className="hp-location">Indonesia</div>
                            </div>

                            <div className="hp-booking-col-middle">
                                <div className="hp-booking-label">Booking saat ini</div>
                                {currentReservation ? (
                                    <>
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                            <div className="hp-booking-clinic">{currentReservation.clinic?.name ?? 'Klinik'}</div>
                                            <div className="hp-booking-chips sm:ml-auto">
                                                <span className="hp-chip">Queue: {currentReservation.queue_summary?.number ?? '-'}</span>
                                                <span className="hp-chip hp-chip-teal">Estimasi: {estimatedWait}</span>
                                            </div>
                                        </div>
                                        <div className="hp-booking-meta">
                                            {reservationLocation(currentReservation)}
                                            <br />
                                            {currentReservation.reservation_number} &nbsp; {dateLabel(currentReservation.reservation_date)} &nbsp; {shortTime(currentReservation.window_start_time)} - {shortTime(currentReservation.window_end_time)}
                                        </div>
                                        <div className="mt-3">
                                            <Link href="/reservasi" className="hp-pill-btn">
                                                Detil reservasi -&gt;
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <div className="hp-empty">
                                        <div className="hp-empty-icon">-</div>
                                        <div className="hp-empty-text">Saat ini kamu tidak mempunyai booking aktif.</div>
                                        <div className="hp-empty-btns justify-center lg:justify-start">
                                            <Link href="/klinik" className="hp-pill-btn">Cari Klinik</Link>
                                            <Link href="/dokter" className="hp-pill-btn">Cari Dokter</Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="hp-booking-col">
                                <div className="hp-booking-label">Booking terakhir</div>
                                {lastReservation ? (
                                    <>
                                        <div className="hp-booking-clinic">{lastReservation.clinic?.name ?? 'Klinik'}</div>
                                        <div className="hp-booking-meta">
                                            {reservationLocation(lastReservation)}
                                            <br />
                                            {shortTime(lastReservation.window_start_time)} - {shortTime(lastReservation.window_end_time)} &nbsp;
                                            <span className="font-bold text-[#00917B]">{lastReservation.status}</span>
                                        </div>
                                        <div className="mt-3">
                                            <Link href="/rekam-medis" className="hp-pill-btn hp-pill-btn-outline">
                                                Rekam medis -&gt;
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <div className="hp-empty">
                                        <div className="hp-empty-icon">-</div>
                                        <div className="hp-empty-text">Saat ini kamu belum mempunyai riwayat booking.</div>
                                        <div className="hp-empty-btns">
                                            <Link href="/klinik" className="hp-pill-btn">Cari Klinik</Link>
                                            <Link href="/dokter" className="hp-pill-btn">Cari Dokter</Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section id="klinik" className="hp-section scroll-mt-24">
                            <div className="hp-section-title">Klinik</div>
                            {clinics.length > 0 ? (
                                <ScrollableCards>
                                    {clinics.map((clinic) => (
                                        <FlipCard
                                            key={clinic.id}
                                            label={clinic.name}
                                            subLabel={clinic.city_name}
                                            image={clinic.image_url}
                                            isActive={activeClinic === clinic.id}
                                            onClick={() => setActiveClinic((current) => (current === clinic.id ? null : clinic.id))}
                                            back={<KlinikBack clinic={clinic} />}
                                        />
                                    ))}
                                </ScrollableCards>
                            ) : (
                                <div className="rounded-2xl border border-[#40311D]/10 bg-white/40 p-6 text-sm text-[#40311D]/60">Belum ada klinik tersedia.</div>
                            )}
                            <div className="hp-review-wrap">
                                <Link href="/reservasi" className="hp-review-btn">Buat reservasi</Link>
                            </div>
                        </section>
                    </main>
                </div>

                <section id="dokter" className="hp-dokter-bg scroll-mt-24">
                    <div className="hp-container">
                        <div className="hp-section">
                            <div className="hp-section-title">Dokter</div>
                            {doctors.length > 0 ? (
                                <ScrollableCards dark>
                                    {doctors.map((doctor) => (
                                        <FlipCard
                                            key={doctor.id}
                                            label={doctor.name}
                                            subLabel={doctor.specialities?.join(', ') || 'Dokter'}
                                            image={doctor.image_url}
                                            isDark
                                            isActive={activeDoctor === doctor.id}
                                            onClick={() => setActiveDoctor((current) => (current === doctor.id ? null : doctor.id))}
                                            back={<DokterBack doctor={doctor} />}
                                        />
                                    ))}
                                </ScrollableCards>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">Belum ada dokter tersedia.</div>
                            )}
                            <div className="hp-review-wrap">
                                <Link href="/reservasi" className="hp-review-btn">Tinjau jadwal dokter</Link>
                            </div>
                        </div>
                    </div>
                </section>

                <PublicFooter />
            </div>
        </>
    );
}

