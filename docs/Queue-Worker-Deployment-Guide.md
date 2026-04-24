# Panduan Singkat Deployment Worker untuk Skripsi/Demo

## Tujuan

Dokumen ini menjelaskan cara menjalankan worker queue pada sistem CliniQueue untuk kebutuhan skripsi, demo, dan pengujian lokal. Pendekatan yang digunakan sengaja dibuat sederhana agar:

- mudah dijalankan di laptop/development machine,
- mudah diamati saat debugging,
- tidak menambah kompleksitas infrastruktur seperti Redis, Horizon, atau Supervisor.

Arsitektur queue pada project ini memakai:

- Laravel Queue bawaan,
- `QUEUE_CONNECTION=database`,
- tabel `jobs`, `job_batches`, dan `failed_jobs`,
- queued notification untuk email,
- queued job untuk pengiriman WhatsApp melalui Fonnte.

## Komponen yang Dipakai

Konfigurasi yang relevan:

- [queue.php](/c:/Users/iryad/Documents/skripsi_backend/config/queue.php)
- [.env.example](/c:/Users/iryad/Documents/skripsi_backend/.env.example)
- [PatientNotificationService.php](/c:/Users/iryad/Documents/skripsi_backend/app/Services/PatientNotificationService.php)
- [SendWhatsAppNotificationJob.php](/c:/Users/iryad/Documents/skripsi_backend/app/Jobs/SendWhatsAppNotificationJob.php)

Notification yang sudah berjalan melalui queue:

- [ReservationStatusNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/ReservationStatusNotification.php)
- [QueueProgressNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/QueueProgressNotification.php)
- [MedicalRecordReadyNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/MedicalRecordReadyNotification.php)

## Prasyarat

Pastikan hal berikut sudah tersedia:

1. Database sudah aktif dan aplikasi bisa terkoneksi.
2. Semua migration sudah dijalankan.
3. Konfigurasi mail sudah diisi jika ingin benar-benar mengirim email.
4. Konfigurasi Fonnte sudah diisi jika ingin benar-benar mengirim WhatsApp.

## Konfigurasi `.env`

Minimal gunakan konfigurasi berikut:

```env
QUEUE_CONNECTION=database

MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="noreply@cliniqueue.test"
MAIL_FROM_NAME="CliniQueue"

FONNTE_ENABLED=true
FONNTE_TOKEN=your-token
FONNTE_BASE_URL=https://api.fonnte.com
FONNTE_COUNTRY_CODE=62
```

Catatan:

- Untuk demo lokal email, Mailpit adalah opsi paling sederhana.
- Jika belum ingin benar-benar kirim email, `MAIL_MAILER=log` tetap bisa dipakai, tetapi worker tetap berjalan.
- Jika `FONNTE_ENABLED=false`, job WhatsApp tidak akan didispatch.

## Langkah Menjalankan untuk Demo

### 1. Jalankan migration

```bash
php artisan migrate
```

Ini memastikan tabel queue seperti `jobs` dan `failed_jobs` tersedia.

### 2. Jalankan backend Laravel

```bash
php artisan serve
```

### 3. Jalankan worker queue di terminal terpisah

```bash
php artisan queue:work
```

Untuk kebutuhan demo, satu worker sudah cukup.

Jika ingin output lebih jelas:

```bash
php artisan queue:work --tries=3 --timeout=120 -v
```

### 4. Jalankan frontend

Jalankan frontend seperti biasa pada terminal terpisah sesuai stack frontend Anda.

## Pola Operasional yang Direkomendasikan untuk Demo

Untuk kebutuhan sidang atau demo, gunakan 3 terminal:

1. Terminal backend Laravel
2. Terminal worker queue
3. Terminal frontend

Dengan pola ini Anda bisa langsung menunjukkan bahwa:

- request utama tetap cepat,
- notifikasi diproses di background,
- log error atau job gagal mudah diamati.

## Cara Memastikan Queue Sedang Bekerja

### Opsi 1: Lihat output terminal worker

Saat ada reservation approval, reschedule, queue called, atau medical record completion, terminal worker akan memproses job baru.

### Opsi 2: Cek tabel jobs

Saat worker belum dijalankan, job akan menumpuk di tabel `jobs`.

Setelah worker aktif, job akan diproses dan hilang dari tabel `jobs`.

### Opsi 3: Cek tabel failed_jobs

Jika ada job gagal, Laravel akan mencatatnya di `failed_jobs`.

Command yang berguna:

```bash
php artisan queue:failed
php artisan queue:retry all
php artisan queue:flush
```

## Mode Debugging Paling Sederhana

Jika Anda ingin debugging paling mudah dan belum ingin menjalankan worker, sementara bisa ubah:

```env
QUEUE_CONNECTION=sync
```

Dampaknya:

- notification dan WhatsApp job kembali diproses langsung di request,
- lebih mudah ditelusuri step-by-step,
- tetapi tidak lagi asynchronous.

Untuk demo arsitektur queue, tetap gunakan `database`.

## Skenario Demo yang Disarankan

### Skenario 1: Approval Reservation

1. Admin approve reservation.
2. Response API kembali cepat.
3. Worker memproses email notification dan WhatsApp job.

### Skenario 2: Patient Reschedule

1. Patient melakukan reschedule.
2. Data reservation berubah lebih dulu di database.
3. Setelah transaksi sukses commit, notification rescheduled masuk queue.

### Skenario 3: Doctor Menyelesaikan Reservation

1. Doctor membuat medical record.
2. Reservation berubah menjadi completed.
3. Worker memproses notifikasi medical record ready.

## Kenapa Pendekatan Ini Cocok untuk Skripsi

Pendekatan ini dipilih karena:

- menunjukkan penerapan asynchronous processing yang nyata,
- tetap sederhana untuk dipresentasikan,
- tidak memerlukan infrastruktur tambahan di luar Laravel dan database,
- mudah dijelaskan secara akademik maupun saat demo.

## Catatan Penting

- Jika worker tidak aktif, notifikasi tidak akan terkirim meskipun job berhasil masuk ke tabel `jobs`.
- Karena implementasi ini sengaja dibuat sederhana, belum digunakan dashboard monitoring seperti Horizon.
- Pendekatan ini cukup untuk kebutuhan skripsi, demo, dan pengujian fungsional.

