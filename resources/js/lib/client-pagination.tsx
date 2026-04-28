import { useEffect, useMemo, useState } from 'react';

type ClientPaginationOptions = {
    initialPerPage?: number;
    perPageOptions?: number[];
};

type PaginationControlsProps = {
    page: number;
    perPage: number;
    total: number;
    pageCount: number;
    startItem: number;
    endItem: number;
    perPageOptions: number[];
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
};

export function useClientPagination<T>(items: T[], options: ClientPaginationOptions = {}) {
    const perPageOptions = options.perPageOptions ?? [10, 25, 50];
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(options.initialPerPage ?? perPageOptions[0] ?? 10);
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / perPage));

    useEffect(() => {
        setPage(1);
    }, [items, perPage]);

    useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    const paginatedItems = useMemo(() => {
        const start = (page - 1) * perPage;

        return items.slice(start, start + perPage);
    }, [items, page, perPage]);

    const startItem = total === 0 ? 0 : (page - 1) * perPage + 1;
    const endItem = Math.min(page * perPage, total);

    return {
        page,
        perPage,
        total,
        pageCount,
        startItem,
        endItem,
        perPageOptions,
        paginatedItems,
        setPage,
        setPerPage,
    };
}

export function PaginationControls({
    page,
    perPage,
    total,
    pageCount,
    startItem,
    endItem,
    perPageOptions,
    onPageChange,
    onPerPageChange,
}: PaginationControlsProps) {
    if (total === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 border-t border-[#e4ddd4] bg-[#faf9f7] px-4 py-3 text-[12px] text-gray-500 md:flex-row md:items-center md:justify-between">
            <span>
                Menampilkan {startItem}-{endItem} dari {total} data
            </span>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                    Per halaman
                    <select
                        value={perPage}
                        onChange={(event) => onPerPageChange(Number(event.target.value))}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-[#40311D]"
                    >
                        {perPageOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[#40311D] transition-colors hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Prev
                </button>
                <span className="px-1 text-gray-500">
                    {page}/{pageCount}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                    disabled={page >= pageCount}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[#40311D] transition-colors hover:bg-[#DFE0DF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
