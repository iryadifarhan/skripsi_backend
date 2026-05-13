# Panduan Deployment Lokal CliniQueue

Dokumen ini menjelaskan cara menjalankan project CliniQueue secara lokal untuk kebutuhan development tim. Project ini menggunakan Laravel 12 sebagai backend, Inertia React sebagai frontend full-stack, MySQL lokal dari XAMPP, queue berbasis database, dan local storage untuk upload gambar.

## 1. Ringkasan Teknologi

| Komponen | Teknologi | Versi Minimum | Versi Rekomendasi | Catatan |
| --- | --- | --- | --- | --- |
| Backend | Laravel | 12.x | 12.x | Framework utama aplikasi. |
| PHP | PHP | 8.2 | 8.3 atau 8.4 | Sesuaikan dengan versi PHP dari XAMPP atau PHP standalone. |
| Database | MySQL/MariaDB via XAMPP | MySQL 8.x atau MariaDB 10.x | MySQL 8.x | Digunakan untuk data aplikasi, session, cache, queue, dan jobs. |
| Frontend | React | 19.x | 19.x | Berjalan melalui Inertia dan Vite. |
| Build tool | Vite | 7.x | 7.x | Membutuhkan Node.js modern. |
| CSS | Tailwind CSS | 4.x | 4.x | Styling utama frontend. |
| Package manager PHP | Composer | 2.x | 2.7+ | Untuk instalasi dependency Laravel. |
| Package manager JS | npm | 10.x | 10.x atau lebih baru | Untuk instalasi dependency frontend. |
| Node.js | Node.js | 20.19+ | 22.x LTS | Vite 7 membutuhkan Node.js versi modern. |

## 2. Prasyarat Instalasi

Pastikan perangkat development sudah memiliki software berikut.

| Software | Fungsi | Rekomendasi |
| --- | --- | --- |
| Git | Clone repository dan version control | Versi terbaru |
| XAMPP | Menjalankan MySQL lokal | XAMPP dengan PHP 8.2+ |
| PHP CLI | Menjalankan Artisan command | PHP 8.2+ |
| Composer | Install package Laravel | Composer 2.x |
| Node.js | Menjalankan Vite dan build React | Node.js 22 LTS atau minimal 20.19 |
| npm | Install package frontend | Mengikuti instalasi Node.js |
| Google Chrome / Edge / Firefox | Browser testing | Versi terbaru |
| Code editor | Development | VS Code atau editor lain |

> Catatan: Jika PHP dari XAMPP belum masuk ke `PATH`, pastikan command `php -v` bisa dijalankan dari terminal. Jika belum, tambahkan path PHP XAMPP, misalnya `C:\xampp\php`, ke environment variable `PATH`.

## 3. Clone Repository

```bash
git clone <URL_REPOSITORY>
cd skripsi_backend
```

Jika repository sudah ada di lokal:

```bash
git pull
```

## 4. Instalasi Dependency

Install dependency backend:

```bash
composer install
```

Install dependency frontend:

```bash
npm install
```

## 5. Konfigurasi Environment

Salin file environment:

```bash
copy .env.example .env
```

Generate application key:

```bash
php artisan key:generate
```

## 6. Setup XAMPP

1. Buka XAMPP Control Panel.
2. Start module `Apache` dan `MySQL`.
3. Buka phpMyAdmin melalui `http://localhost/phpmyadmin`.
4. Buat database baru dengan nama `skripsi_backend`

## 7. Migrasi dan Seeder

Jalankan migrasi database:

```bash
php artisan migrate
```

Jalankan seeder:

```bash
php artisan db:seed
```

Seeder saat ini membuat data awal berikut:

| Seeder | Data yang dibuat |
| --- | --- |
| `SuperAdminSeeder` | Akun superadmin default |
| `ClinicCitySeeder` | Master kota klinik seperti Jakarta, Bekasi, Bogor, dan Tambun |

Akun superadmin default dari seeder:

```env
SUPERADMIN_NAME="Super Admin"
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD=superadmin123
```

Jika ingin reset database lokal dari awal:

```bash
php artisan migrate:fresh --seed
```

> Peringatan: `migrate:fresh --seed` akan menghapus seluruh tabel dan data lokal.

## 8. Setup Local Storage

Karena upload gambar dokter, pasien, dan klinik menggunakan local public storage saat development, jalankan:

```bash
php artisan storage:link
```

Command ini membuat symbolic link dari:

```text
public/storage
```

ke:

```text
storage/app/public
```

Tanpa command ini, gambar yang berhasil diupload bisa tersimpan tetapi tidak dapat diakses dari browser.

## 9. Menjalankan Aplikasi Lokal

Jalankan Laravel server:

```bash
php artisan serve
```

Secara default aplikasi dapat diakses melalui:

```text
http://127.0.0.1:8000
```

## 10. Queue Worker Lokal

Project menggunakan queue berbasis database untuk notification job seperti email dan WhatsApp. Karena `QUEUE_CONNECTION=database`, job akan masuk ke tabel `jobs`.

Jalankan worker di terminal terpisah:

```bash
php artisan queue:work
```

Jika worker tidak berjalan, notification yang memakai queue tidak akan diproses sampai worker dinyalakan.

## 11. Scheduler Lokal

Scheduler digunakan untuk menjalankan task berkala, termasuk reminder reservasi approved yang mendekati waktu reservasi.

Untuk development lokal, jalankan di terminal terpisah:

```bash
php artisan schedule:work
```

## 12. Build Frontend Lokal

Untuk mengecek hasil frontend build:

```bash
npm run build
```

Jika build gagal, cek versi Node.js:

```bash
node -v
npm -v
```

Pastikan Node.js minimal `20.19` atau gunakan Node.js `22.x LTS`.

## 13. Testing

Jalankan test suite:

```bash
php artisan test
```

Jika konfigurasi `.env` berubah tetapi hasil test masih memakai konfigurasi lama:

```bash
php artisan config:clear
```

## 14. Flow Development Harian (Setup sudah selesai)

Setelah initial setup selesai, alur harian cukup seperti ini.

1. Start `Apache` dan `MySQL` dari XAMPP.
2. Masuk ke folder project.
3. Jalankan Laravel server.

```bash
php artisan serve
```

4. **(Opsional)** Jalankan queue worker jika ingin memproses notification.

```bash
php artisan queue:work
```

5. **(Opsional)** Jalankan scheduler jika ingin menguji reminder reservasi.

```bash
php artisan schedule:work
```

## 15. Troubleshooting

### Error `No application encryption key has been specified`

Jalankan:

```bash
php artisan key:generate
```

### Error database connection refused

Pastikan:

1. MySQL di XAMPP sudah berjalan.
2. `.env` memakai `DB_HOST=127.0.0.1`.
3. Database `cliniqueue` sudah dibuat.
4. Username dan password sesuai konfigurasi MySQL lokal.

### Tampilan frontend tidak update

Jalankan perintah:

```bash
npm run build
php artisan view:clear
```

### Gambar upload tidak muncul

Pastikan:

1. `.env` memakai `MEDIA_DISK=public`.
2. Sudah menjalankan:

```bash
php artisan storage:link
```

3. File tersimpan di `storage/app/public`.
4. URL gambar mengarah ke `/storage/...`.

### Notification tidak terkirim

Untuk lokal:

1. Pastikan worker berjalan.
2. Cek file log Laravel di `storage/logs/laravel.log`.
3. Jika `MAIL_MAILER=log`, email memang tidak masuk inbox dan hanya dicatat di log.
4. Jika `MAIL_MAILER=smtp`, email masuk ke inbox sandbox mailtrap.
5. Jika ingin menguji WhatsApp, set `FONNTE_ENABLED=true` dan isi `FONNTE_TOKEN`.

### CSRF token mismatch

Umumnya terjadi karena session stale atau form terlalu lama terbuka. Solusi development:

```bash
php artisan cache:clear
php artisan config:clear
```

Kemudian refresh browser dan login ulang.

### Port 8000 sudah digunakan

Gunakan port lain:

```bash
php artisan serve --port=8001
```

Jika port berubah, sesuaikan juga `APP_URL` di `.env`.
