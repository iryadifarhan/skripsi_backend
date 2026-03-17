<?php

namespace App\Exports\Support;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;

class SummarySheetExport implements FromArray, ShouldAutoSize, WithTitle
{
    /**
     * @param  array<int, array<int, string|int>>  $rows
     */
    public function __construct(
        private readonly string $title,
        private readonly array $rows,
    ) {
    }

    /**
     * @return array<int, array<int, string|int>>
     */
    public function array(): array
    {
        return array_merge([['Metric', 'Value']], $this->rows);
    }

    public function title(): string
    {
        return $this->title;
    }
}
