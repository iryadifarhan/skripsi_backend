import { useEffect, useState } from 'react';

type ImageCard = {
    id: string;
    src: string;
    alt: string;
    top: number;
    left: number;
    zIndex: number;
};

export default function ImageStack({ cards = [] }: { cards: ImageCard[] }) {
    const [selectedCard, setSelectedCard] = useState<ImageCard | null>(null);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedCard(null);
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <>
            <div className="relative w-[85%] pb-[70%]">
                {cards.map((card) => (
                    <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedCard(card)}
                        className="group absolute aspect-[5/3] w-3/4 overflow-hidden rounded-md transition duration-300 hover:z-10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
                        style={{
                            top: `${card.top}%`,
                            left: `${card.left}%`,
                            zIndex: card.zIndex,
                        }}
                    >
                        <img src={card.src} alt={card.alt} className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-[#40311D]/60 text-[13px] font-semibold tracking-wide text-[#DED0B6] opacity-0 transition group-hover:opacity-100">
                            Tekan gambar untuk diperbesar
                        </span>
                    </button>
                ))}
            </div>

            {selectedCard ? (
                <div
                    role="presentation"
                    onClick={() => setSelectedCard(null)}
                    className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-4"
                >
                    <div role="presentation" onClick={(event) => event.stopPropagation()} className="relative w-full max-w-[60vw]">
                        <button
                            type="button"
                            onClick={() => setSelectedCard(null)}
                            className="absolute -top-8 right-0 border-0 bg-transparent text-[13px] text-white/70 transition hover:text-white"
                        >
                            Klik / tekan ESC untuk menutup X
                        </button>
                        <img src={selectedCard.src} alt={selectedCard.alt} className="block w-full rounded-lg" />
                    </div>
                </div>
            ) : null}
        </>
    );
}
