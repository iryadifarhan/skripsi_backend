<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MediaImageService
{
    public static function store(UploadedFile $image, string $directory, ?string $disk = null): string
    {
        $disk = self::disk($disk);
        $source = self::makeImage($image);

        try {
            [$contents, $extension] = self::encode($source);
            $path = trim($directory, '/').'/'.Str::random(40).'.'.$extension;
            try {
                $stored = Storage::disk($disk)->put($path, $contents, [
                    'visibility' => 'public',
                ]);
            } catch (Throwable) {
                throw ValidationException::withMessages([
                    'image' => ['Gagal menyimpan file ke storage. Periksa konfigurasi Object Storage.'],
                ]);
            }

            if ($stored !== true) {
                throw ValidationException::withMessages([
                    'image' => ['Gagal menyimpan file ke storage. Periksa konfigurasi Object Storage.'],
                ]);
            }

            return $path;
        } finally {
            imagedestroy($source);
        }
    }

    public static function delete(?string $path, ?string $disk = null): void
    {
        if (!self::hasValidPath($path)) {
            return;
        }

        Storage::disk(self::disk($disk))->delete($path);
    }

    public static function hasValidPath(mixed $path): bool
    {
        if (!is_string($path)) {
            return false;
        }

        $path = trim($path);

        return $path !== '' && $path !== '0';
    }

    private static function makeImage(UploadedFile $image): GdImage
    {
        $realPath = $image->getRealPath();
        $mimeType = $image->getMimeType();

        if ($realPath === false || $realPath === '') {
            throw ValidationException::withMessages([
                'image' => ['File gambar tidak dapat dibaca.'],
            ]);
        }

        $source = match ($mimeType) {
            'image/jpeg' => imagecreatefromjpeg($realPath),
            'image/png' => imagecreatefrompng($realPath),
            'image/webp' => imagecreatefromwebp($realPath),
            default => false,
        };

        if (!$source instanceof GdImage) {
            throw ValidationException::withMessages([
                'image' => ['Format gambar tidak dapat diproses.'],
            ]);
        }

        if ($mimeType === 'image/jpeg') {
            $source = self::applyJpegOrientation($source, $realPath);
        }

        imagepalettetotruecolor($source);
        imagealphablending($source, true);
        imagesavealpha($source, true);

        return $source;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function encode(GdImage $source): array
    {
        if (self::hasAlpha($source)) {
            return [self::encodePng($source), 'png'];
        }

        return [self::encodeJpeg($source), 'jpg'];
    }

    private static function encodeJpeg(GdImage $source): string
    {
        $targetBytes = max(1, (int) config('filesystems.media_image.target_kb', 512)) * 1024;
        $minQuality = max(1, min(100, (int) config('filesystems.media_image.min_quality', 60)));
        $quality = max($minQuality, min(100, (int) config('filesystems.media_image.quality', 82)));
        $jpeg = self::whiteCanvas($source);
        $bestContents = '';

        try {
            for ($currentQuality = $quality; $currentQuality >= $minQuality; $currentQuality -= 5) {
                ob_start();
                $encoded = imagejpeg($jpeg, null, $currentQuality);
                $contents = ob_get_clean();

                if ($encoded !== true || $contents === false || $contents === '') {
                    continue;
                }

                $bestContents = $contents;

                if (strlen($contents) <= $targetBytes) {
                    return $contents;
                }
            }

            if ($bestContents === '') {
                throw ValidationException::withMessages([
                    'image' => ['Gagal mengompresi gambar.'],
                ]);
            }

            return $bestContents;
        } finally {
            imagedestroy($jpeg);
        }
    }

    private static function encodePng(GdImage $source): string
    {
        ob_start();
        $encoded = imagepng($source, null, 9);
        $contents = ob_get_clean();

        if ($encoded !== true || $contents === false || $contents === '') {
            throw ValidationException::withMessages([
                'image' => ['Gagal mengompresi gambar PNG.'],
            ]);
        }

        return $contents;
    }

    private static function whiteCanvas(GdImage $source): GdImage
    {
        $width = imagesx($source);
        $height = imagesy($source);
        $canvas = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($canvas, 255, 255, 255);

        imagefill($canvas, 0, 0, $white);
        imagecopy($canvas, $source, 0, 0, 0, 0, $width, $height);

        return $canvas;
    }

    private static function hasAlpha(GdImage $source): bool
    {
        $transparentColor = imagecolortransparent($source);

        if ($transparentColor >= 0) {
            return true;
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $stepX = max(1, (int) floor($width / 50));
        $stepY = max(1, (int) floor($height / 50));

        for ($y = 0; $y < $height; $y += $stepY) {
            for ($x = 0; $x < $width; $x += $stepX) {
                $rgba = imagecolorat($source, $x, $y);

                if ((($rgba & 0x7F000000) >> 24) > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function applyJpegOrientation(GdImage $source, string $path): GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $source;
        }

        $exif = @exif_read_data($path);
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;

        return match ($orientation) {
            3 => imagerotate($source, 180, 0),
            6 => imagerotate($source, -90, 0),
            8 => imagerotate($source, 90, 0),
            default => $source,
        };
    }

    private static function disk(?string $disk): string
    {
        return $disk ?? (string) config('filesystems.media_disk', 'public');
    }
}
