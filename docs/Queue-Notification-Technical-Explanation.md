# Penjelasan Teknis Queue Notification untuk Laporan Skripsi

## Gambaran Umum

Pada tahap pengembangan lanjutan, mekanisme pengiriman notifikasi pada sistem CliniQueue diubah dari proses sinkron menjadi proses asynchronous berbasis queue. Perubahan ini dilakukan agar pengiriman notifikasi email dan WhatsApp tidak lagi membebani request utama yang dipicu oleh pengguna atau admin.

Sebelum mekanisme queue diterapkan, proses approval reservation, reschedule reservation, perubahan status antrean, dan penyelesaian reservation oleh dokter akan langsung menjalankan pengiriman notifikasi dalam request yang sama. Pendekatan tersebut sederhana, tetapi memiliki kelemahan karena waktu respons endpoint menjadi bergantung pada keberhasilan koneksi ke layanan eksternal seperti SMTP mail server dan Fonnte WhatsApp API.

Untuk mengatasi hal tersebut, sistem kemudian menggunakan Laravel Queue dengan driver `database`. Dengan pendekatan ini, request utama cukup menyimpan data bisnis terlebih dahulu, sedangkan pengiriman notifikasi diproses terpisah oleh worker queue di background.

## Tujuan Implementasi Queue

Penerapan queue pada notifikasi memiliki beberapa tujuan utama:

1. Mengurangi waktu tunggu response API.
2. Memisahkan proses bisnis inti dari proses integrasi eksternal.
3. Meningkatkan efisiensi request yang memicu notifikasi.
4. Menyediakan mekanisme retry apabila pengiriman notifikasi gagal.
5. Menjaga kompleksitas sistem tetap rendah dengan memanfaatkan fitur bawaan Laravel.

## Arsitektur yang Digunakan

Implementasi queue notification pada sistem ini menggunakan komponen berikut:

1. Laravel Queue dengan koneksi `database`.
2. Tabel `jobs` untuk menyimpan job yang menunggu diproses.
3. Tabel `failed_jobs` untuk mencatat job yang gagal.
4. Queued Notification Laravel untuk pengiriman email.
5. Queued Job khusus untuk pengiriman WhatsApp melalui Fonnte.

Komponen yang terlibat dalam kode:

- [PatientNotificationService.php](/c:/Users/iryad/Documents/skripsi_backend/app/Services/PatientNotificationService.php)
- [SendWhatsAppNotificationJob.php](/c:/Users/iryad/Documents/skripsi_backend/app/Jobs/SendWhatsAppNotificationJob.php)
- [ReservationStatusNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/ReservationStatusNotification.php)
- [QueueProgressNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/QueueProgressNotification.php)
- [MedicalRecordReadyNotification.php](/c:/Users/iryad/Documents/skripsi_backend/app/Notifications/MedicalRecordReadyNotification.php)

## Alur Kerja Sistem

### 1. Perubahan data bisnis terjadi

Sistem terlebih dahulu menjalankan proses utama, misalnya:

- admin menyetujui reservation,
- patient melakukan reschedule,
- admin memanggil antrean,
- dokter membuat medical record.

Pada tahap ini, database akan diperbarui terlebih dahulu sesuai kebutuhan proses bisnis.

### 2. Service notifikasi dipanggil

Setelah perubahan data berhasil, controller akan memanggil `PatientNotificationService`. Service ini bertugas:

- membangun objek notification email,
- menentukan penerima email,
- membangun pesan WhatsApp,
- mendispatch job WhatsApp jika nomor tujuan tersedia dan integrasi Fonnte diaktifkan.

### 3. Email masuk ke queue

Notification email pada sistem ini telah mengimplementasikan `ShouldQueue`. Dengan demikian, saat metode `notify()` dipanggil, Laravel tidak langsung mengirim email pada request yang sedang berjalan, melainkan menyimpan job email ke tabel `jobs`.

### 4. WhatsApp masuk ke queue

Pengiriman WhatsApp tidak dilakukan langsung dari service, melainkan melalui `SendWhatsAppNotificationJob`. Job ini juga dimasukkan ke queue agar request utama tidak menunggu respons dari Fonnte API.

### 5. Worker memproses queue

Worker Laravel yang dijalankan dengan `php artisan queue:work` akan mengambil job satu per satu dari tabel `jobs`, kemudian:

- mengirim email melalui mailer yang dikonfigurasi,
- mengirim WhatsApp melalui `FonnteService`.

## Mekanisme After Commit

Queue notification dan WhatsApp job pada sistem ini dikonfigurasi dengan `afterCommit()`. Mekanisme ini penting karena job hanya akan benar-benar dimasukkan ke queue setelah transaksi database berhasil disimpan.

Artinya:

- jika transaksi gagal atau di-rollback, notifikasi tidak ikut dikirim,
- konsistensi data menjadi lebih terjaga,
- pengguna tidak menerima notifikasi untuk perubahan data yang sebenarnya tidak jadi tersimpan.

## Alasan Pemilihan Driver Database

Dalam konteks skripsi dan demo, driver queue `database` dipilih karena paling seimbang antara manfaat dan kompleksitas. Beberapa alasan pemilihannya adalah:

1. Tidak memerlukan server tambahan seperti Redis.
2. Mudah dijalankan di lingkungan lokal atau laptop.
3. Data job dapat diamati langsung melalui database.
4. Mudah dijelaskan pada dokumentasi akademik.
5. Cukup memadai untuk skala sistem prototipe dan MVP.

Driver ini memang tidak secepat Redis, tetapi lebih sesuai untuk kebutuhan implementasi skripsi yang menekankan kejelasan arsitektur dan kemudahan demonstrasi.

## Kelebihan Pendekatan Ini

Kelebihan implementasi queue notification pada sistem ini adalah:

1. Response API menjadi lebih cepat karena tidak menunggu koneksi ke layanan eksternal.
2. Proses bisnis utama tetap berjalan meskipun pengiriman notifikasi lambat.
3. Notifikasi dapat diproses ulang jika terjadi kegagalan.
4. Sistem menjadi lebih modular karena pengiriman notifikasi dipisahkan dari logika bisnis inti.
5. Cocok untuk pengembangan bertahap menuju arsitektur yang lebih scalable.

## Keterbatasan Pendekatan Ini

Meskipun lebih baik daripada proses sinkron, pendekatan ini tetap memiliki keterbatasan:

1. Worker queue harus aktif agar notifikasi benar-benar terkirim.
2. Jika worker berhenti, job akan menumpuk di tabel `jobs`.
3. Monitoring masih sederhana karena belum menggunakan dashboard seperti Horizon.
4. Karena fokusnya untuk skripsi dan demo, implementasi ini belum diarahkan ke level production penuh.

Keterbatasan tersebut tetap dapat diterima karena tujuan implementasi adalah menunjukkan penerapan asynchronous processing yang efektif namun tetap sederhana.

## Pertimbangan Desain

Desain queue notification pada sistem ini sengaja dibuat tidak over-engineered. Beberapa keputusan penting yang diambil adalah:

1. Tidak menggunakan event-listener yang terlalu banyak.
2. Tidak menggunakan Redis atau Horizon.
3. Tetap memusatkan orkestrasi notifikasi pada `PatientNotificationService`.
4. Memisahkan email dan WhatsApp hanya pada level mekanisme eksekusi, bukan pada level arsitektur yang terlalu kompleks.

Pendekatan ini dipilih agar sistem tetap:

- mudah dibaca,
- mudah diuji,
- mudah didemonstrasikan,
- dan mudah dijelaskan di laporan skripsi.

## Kesimpulan

Penerapan queue notification pada CliniQueue meningkatkan efisiensi proses notifikasi dengan memindahkan pengiriman email dan WhatsApp ke background process. Dengan memanfaatkan Laravel Queue berbasis database, sistem memperoleh manfaat asynchronous processing tanpa memerlukan infrastruktur tambahan yang kompleks. Pendekatan ini cocok untuk kebutuhan skripsi karena mampu menunjukkan peningkatan kualitas arsitektur sistem secara teknis, namun tetap sederhana dari sisi implementasi dan debugging.

## Ringkasan Siap Pakai untuk Laporan

Berikut versi ringkas yang dapat langsung disisipkan ke laporan:

> Sistem notifikasi pada CliniQueue diimplementasikan menggunakan mekanisme queue berbasis database pada framework Laravel. Penerapan queue dilakukan agar proses pengiriman email dan WhatsApp tidak dieksekusi secara sinkron pada request utama, sehingga waktu respons endpoint tetap cepat dan proses bisnis inti tidak bergantung pada layanan eksternal. Notification email diimplementasikan sebagai queued notification, sedangkan notifikasi WhatsApp diimplementasikan sebagai queued job yang memanggil layanan Fonnte. Seluruh job dikonfigurasi agar hanya masuk queue setelah transaksi database berhasil disimpan (`after commit`), sehingga konsistensi data tetap terjaga. Pemilihan driver database dilakukan karena lebih sederhana, mudah didebug, dan sesuai untuk kebutuhan prototipe skripsi tanpa menambah kompleksitas infrastruktur seperti Redis atau Horizon.

