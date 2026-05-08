import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

import type { SharedData } from '@/types';

const loginNext = (path: string) => `/masuk?next=${encodeURIComponent(path)}`;

function pathFromHref(href: string) {
    return href.split('?')[0].split('#')[0] || '/';
}

function isActivePath(currentPath: string, href: string) {
    const linkPath = pathFromHref(href);

    if (linkPath === '/') {
        return currentPath === '/';
    }

    return currentPath === linkPath || currentPath.startsWith(`${linkPath}/`);
}

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
    const initial = name.trim().charAt(0).toUpperCase() || 'P';

    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />;
    }

    return <span className="text-sm font-bold text-[#DED0B6]">{initial}</span>;
}

function UserIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 opacity-55">
            <path
                fill="currentColor"
                d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4Z"
            />
        </svg>
    );
}

function LogoutIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 opacity-65">
            <path
                fill="currentColor"
                d="M4 3h7a1 1 0 0 1 1 1v3h-2V5H5v10h5v-2h2v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm10.59 4.59L17 10l-2.41 2.41-1.42-1.42.59-.59H8V9h5.76l-.59-.59 1.42-1.42Z"
            />
        </svg>
    );
}

export function PublicNavbar() {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const user = auth?.user ?? null;
    const isPatient = user?.role === 'patient';
    const avatarUrl = user?.display_avatar_url ?? user?.image_url ?? user?.profile_picture_url ?? null;
    const currentPath = pathFromHref(page.url);
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);

        handleScroll();
        window.addEventListener('scroll', handleScroll);

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!profileOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!profileRef.current?.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [profileOpen]);

    const patientHref = (path: string) => (isPatient ? path : loginNext(path));
    const logoHref = isPatient ? '/beranda' : '/';
    const navLinks = [
        { href: isPatient ? '/beranda' : '/', label: 'beranda' },
        { href: '/klinik', label: 'klinik' },
        { href: '/dokter', label: 'dokter' },
        { href: patientHref('/reservasi'), label: 'reservasi' },
        { href: patientHref('/rekam-medis'), label: 'rekam medis' },
    ];
    const logout = () => {
        setProfileOpen(false);
        setMenuOpen(false);
        router.post('/logout');
    };

    return (
        <nav
            className={`sticky top-0 z-50 bg-[#DED0B6] transition ${
                scrolled ? 'border-b border-[#40311D]/15 shadow-[0_2px_12px_rgba(64,49,29,0.08)]' : 'border-b border-transparent'
            }`}
        >
            <style>
                {`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}
            </style>
            <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3.5 md:px-8">
                <Link href={logoHref} className="mr-auto shrink-0 text-xl font-black tracking-[-0.02em] text-[#40311D]">
                    CLINI<span className="text-[#00917B]">&gt;</span>QUEUE<span className="text-[#00917B]">&gt;</span>
                </Link>

                <ul className="hidden items-center gap-7 md:flex">
                    {navLinks.map((link) => {
                        const active = isActivePath(currentPath, link.href);

                        return (
                            <li key={`${link.href}-${link.label}`}>
                                <Link
                                    href={link.href}
                                    className={`border-b-2 pb-px text-sm transition hover:text-[#40311D] ${
                                        active
                                            ? 'border-[#00917B] font-bold text-[#40311D] opacity-100'
                                            : 'border-transparent font-medium text-[#40311D]/65'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                <Link
                    href="/klinik"
                    className="hidden h-9 w-9 items-center justify-center rounded-full text-[#40311D] transition hover:bg-[#40311D]/8 md:flex"
                    aria-label="Cari klinik atau dokter"
                >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
                        <path
                            fill="currentColor"
                            d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.15 3.15-1.06 1.06-3.15-3.15A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                        />
                    </svg>
                </Link>

                {isPatient ? (
                    <div ref={profileRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setProfileOpen((current) => !current)}
                            className="flex md:h-10 md:w-10 h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#40311D] text-[#DED0B6] shadow-[0_0_0_2px_rgba(64,49,29,0.9)] transition hover:bg-[#00917B] hover:shadow-[0_0_0_2px_rgba(0,145,123,0.9)]"
                            aria-label="Buka menu profil"
                            aria-expanded={profileOpen}
                        >
                            <ProfileAvatar name={user.name} avatarUrl={avatarUrl} />
                        </button>

                        {profileOpen ? (
                            <div className="absolute right-0 top-[calc(100%+0.75rem)] md:w-56 w-40 overflow-hidden rounded-xl border border-[#40311D]/20 bg-[#DED0B6] text-[#40311D] shadow-[0_14px_34px_rgba(64,49,29,0.16)] shadow-[0_8px_24px_rgba(64,49,29,0.12)] animate-[dropIn_0.15s_ease]">
                                <div className="border-b border-[#40311D]/10 px-4 py-3 text-xs font-semibold text-[#40311D]/45">{user.name}</div>
                                <Link
                                    href="/profil"
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#40311D] transition hover:bg-[#40311D]/5"
                                >
                                    <UserIcon />
                                    Profil saya
                                </Link>
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="flex w-full items-center gap-2 border-t border-[#40311D]/10 px-4 py-3 text-left text-sm font-bold text-[#d95d4f] transition hover:bg-[#40311D]/5"
                                >
                                    <LogoutIcon />
                                    Keluar
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="hidden items-center gap-2 md:flex">
                        <Link
                            href="/masuk"
                            className="rounded-full border-[1.5px] border-[#40311D] px-4 py-1.5 text-xs font-semibold text-[#40311D] transition hover:bg-[#40311D] hover:text-[#DED0B6]"
                        >
                            Masuk
                        </Link>
                        <Link
                            href="/daftar"
                            className="rounded-full border-[1.5px] border-[#40311D] bg-[#40311D] px-4 py-1.5 text-xs font-semibold text-[#DED0B6] transition hover:border-[#00917B] hover:bg-[#00917B]"
                        >
                            Daftar
                        </Link>
                    </div>
                )}

                <button type="button" onClick={() => setMenuOpen((current) => !current)} className="flex flex-col gap-1.5 p-1 md:hidden" aria-label="Toggle menu">
                    <span className="block h-0.5 w-6 bg-[#40311D]" />
                    <span className="block h-0.5 w-6 bg-[#40311D]" />
                    <span className="block h-0.5 w-6 bg-[#40311D]" />
                </button>
            </div>

            {menuOpen ? (
                <div className="mx-auto flex max-w-[1400px] flex-col gap-3 border-t border-[#40311D]/10 px-5 py-5 md:hidden">
                    {navLinks.map((link) => {
                        const active = isActivePath(currentPath, link.href);

                        return (
                            <Link
                                key={`${link.href}-${link.label}-mobile`}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className={`w-fit border-b-2 pb-px text-base transition hover:text-[#40311D] ${
                                    active
                                        ? 'border-[#00917B] font-bold text-[#40311D] opacity-100'
                                        : 'border-transparent font-medium text-[#40311D]/65'
                                }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                    {!isPatient ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <Link href="/masuk" className="rounded-full border-[1.5px] border-[#40311D] px-4 py-2 text-center text-sm font-semibold text-[#40311D]">
                                Masuk
                            </Link>
                            <Link href="/daftar" className="rounded-full border-[1.5px] border-[#40311D] bg-[#40311D] px-4 py-2 text-center text-sm font-semibold text-[#DED0B6]">
                                Daftar
                            </Link>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </nav>
    );
}
