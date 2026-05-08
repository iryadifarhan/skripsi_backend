<tr>
<td class="header">
<a href="{{ config('app.url') }}" style="display: inline-block; text-decoration: none;">
@php
    $logoUrl = Vite::asset('resources/js/assets/cliniquelogo.png');
    $absoluteLogoUrl = str_starts_with($logoUrl, 'http') ? $logoUrl : url($logoUrl);
@endphp
    <img
        src="{{ $absoluteLogoUrl }}"
        alt="{{ config('app.name') }}"
        style="height: 42px; width: auto; border: 0;"
    >
</a>
</td>
</tr>
