# Skenario Pengujian Black-Box Sistem CliniQueue

Dokumen ini berisi skenario pengujian black-box untuk fitur utama sistem CliniQueue. Pengujian difokuskan pada tiga aktor utama, yaitu **User**, **Dokter**, dan **Admin**.

Pengujian disusun berdasarkan output yang terlihat oleh pengguna, bukan berdasarkan struktur kode internal. Setiap fitur memiliki tabel tersendiri agar mudah dipindahkan ke Obsidian atau laporan skripsi.

> Catatan: Kolom **Hasil Pengujian** dan **Status** diisi berdasarkan kondisi sistem yang diharapkan setelah fitur selesai diimplementasikan.

---

## Ringkasan Aktor

| Aktor | Deskripsi |
|---|---|
| User | Pengguna umum dan pasien yang menggunakan sistem untuk mencari klinik/dokter, melakukan reservasi, melihat status antrean, dan melihat rekam medis. |
| Dokter | Pengguna dengan peran dokter yang mengelola antrean pemeriksaan, rekam medis, jadwal praktik, profil dokter, dan laporan dokter. |
| Admin | Gabungan admin klinik dan superadmin yang mengelola reservasi, antrean, dokter, pasien, klinik, laporan, dan konfigurasi sistem sesuai hak akses. |

---

## 1. Akses Landing Page

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Mengakses halaman landing page | User | URL `/` | Sistem menampilkan landing page tanpa meminta autentikasi | Landing page berhasil ditampilkan | Berhasil |
| Mengakses menu publik dari landing page | User | Klik menu klinik atau dokter | Sistem mengarahkan user ke halaman publik yang dipilih | Halaman publik berhasil ditampilkan | Berhasil |

## 2. Pencarian Umum

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melakukan pencarian dengan kata kunci valid | User | Nama klinik, nama dokter, spesialisasi, atau kota | Sistem menampilkan hasil pencarian yang sesuai | Hasil pencarian berhasil ditampilkan | Berhasil |
| Melakukan pencarian tanpa kata kunci | User | Input kosong | Sistem menampilkan halaman pencarian tanpa hasil spesifik atau menampilkan data awal | Halaman pencarian berhasil ditampilkan | Berhasil |
| Melakukan pencarian dengan kata kunci tidak tersedia | User | Kata kunci acak | Sistem menampilkan informasi data tidak ditemukan | Empty state berhasil ditampilkan | Berhasil |

## 3. Melihat Daftar Klinik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar klinik | User | URL `/klinik` | Sistem menampilkan daftar klinik yang tersedia | Daftar klinik berhasil ditampilkan | Berhasil |
| Mencari klinik berdasarkan kata kunci | User | Nama klinik, spesialisasi, alamat, atau kota | Sistem menampilkan klinik sesuai kata kunci | Data klinik berhasil dicari | Berhasil |
| Memfilter klinik berdasarkan kota | User | Pilihan kota | Sistem menampilkan klinik pada kota yang dipilih | Data klinik berhasil difilter berdasarkan kota | Berhasil |
| Memfilter klinik berdasarkan spesialisasi | User | Pilihan spesialisasi | Sistem menampilkan klinik yang memiliki spesialisasi terkait | Data klinik berhasil difilter berdasarkan spesialisasi | Berhasil |
| Memfilter klinik berdasarkan waktu | User | Rentang waktu praktik | Sistem menampilkan klinik yang sesuai dengan filter waktu | Data klinik berhasil difilter berdasarkan waktu | Berhasil |

## 4. Melihat Detail Klinik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat detail klinik | User | Pilih salah satu klinik | Sistem menampilkan informasi klinik, dokter, jadwal, dan slot reservasi | Detail klinik berhasil ditampilkan | Berhasil |
| Memilih dokter pada detail klinik | User | Dokter yang tersedia | Sistem menandai dokter terpilih dan menampilkan jadwal yang sesuai | Dokter berhasil dipilih | Berhasil |
| Memilih tanggal reservasi yang tersedia | User | Tanggal sesuai jadwal dokter | Sistem menampilkan slot reservasi sesuai tanggal dan jadwal dokter | Slot reservasi berhasil ditampilkan | Berhasil |
| Memilih tanggal tanpa jadwal praktik | User | Tanggal yang tidak sesuai jadwal dokter | Sistem menampilkan informasi bahwa slot tidak tersedia | Informasi slot tidak tersedia berhasil ditampilkan | Berhasil |
| Membuka detail klinik dengan slug tidak valid | User | Slug klinik tidak ditemukan | Sistem menampilkan halaman tidak ditemukan | Halaman tidak ditemukan berhasil ditampilkan | Berhasil |

## 5. Melihat Daftar Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar dokter | User | URL `/dokter` | Sistem menampilkan daftar dokter yang tersedia | Daftar dokter berhasil ditampilkan | Berhasil |
| Mencari dokter berdasarkan kata kunci | User | Nama dokter, spesialisasi, atau klinik | Sistem menampilkan dokter sesuai kata kunci | Data dokter berhasil dicari | Berhasil |
| Memfilter dokter berdasarkan kota | User | Pilihan kota | Sistem menampilkan dokter yang praktik di kota terpilih | Data dokter berhasil difilter berdasarkan kota | Berhasil |
| Memfilter dokter berdasarkan spesialisasi | User | Pilihan spesialisasi | Sistem menampilkan dokter sesuai spesialisasi | Data dokter berhasil difilter berdasarkan spesialisasi | Berhasil |
| Memfilter dokter berdasarkan waktu | User | Rentang waktu praktik | Sistem menampilkan dokter sesuai filter waktu | Data dokter berhasil difilter berdasarkan waktu | Berhasil |

## 6. Melihat Detail Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat detail dokter | User | Pilih salah satu dokter | Sistem menampilkan profil dokter, klinik terkait, jadwal, dan slot reservasi | Detail dokter berhasil ditampilkan | Berhasil |
| Memilih klinik pada detail dokter | User | Klinik tempat dokter praktik | Sistem menampilkan jadwal dokter pada klinik yang dipilih | Klinik berhasil dipilih | Berhasil |
| Memilih tanggal reservasi yang tersedia | User | Tanggal sesuai jadwal dokter | Sistem menampilkan slot reservasi sesuai klinik dan dokter | Slot reservasi berhasil ditampilkan | Berhasil |
| Memilih tanggal tanpa jadwal praktik | User | Tanggal tidak sesuai jadwal | Sistem menampilkan informasi bahwa slot tidak tersedia | Informasi slot tidak tersedia berhasil ditampilkan | Berhasil |
| Membuka detail dokter dengan slug tidak valid | User | Slug dokter tidak ditemukan | Sistem menampilkan halaman tidak ditemukan | Halaman tidak ditemukan berhasil ditampilkan | Berhasil |

## 7. Registrasi Akun

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Registrasi dengan data valid | User | Nama, username, email, password, nomor telepon, tanggal lahir, gender | Sistem membuat akun baru dan mengarahkan user sesuai alur autentikasi | Akun berhasil dibuat | Berhasil |
| Registrasi dengan email yang sudah digunakan | User | Email yang telah terdaftar | Sistem menolak registrasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Registrasi dengan username yang sudah digunakan | User | Username yang telah terdaftar | Sistem menolak registrasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Registrasi dengan password dan konfirmasi password berbeda | User | Password tidak sama dengan konfirmasi | Sistem menolak registrasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Registrasi dengan data wajib kosong | User | Field wajib tidak diisi | Sistem menolak registrasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |

## 8. Login

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Login menggunakan email valid | User, Dokter, Admin | Email dan password valid | Sistem mengautentikasi akun dan mengarahkan aktor ke halaman sesuai peran | Login berhasil dilakukan | Berhasil |
| Login menggunakan username valid | User, Dokter, Admin | Username dan password valid | Sistem mengautentikasi akun dan mengarahkan aktor ke halaman sesuai peran | Login berhasil dilakukan | Berhasil |
| Login dengan password salah | User, Dokter, Admin | Email/username valid dan password salah | Sistem menolak login dan menampilkan pesan kesalahan | Pesan kesalahan berhasil ditampilkan | Berhasil |
| Login dengan username berbeda kapitalisasi | User, Dokter, Admin | Username dengan huruf besar/kecil yang tidak sesuai | Sistem menolak login karena username bersifat case-sensitive | Login berhasil ditolak | Berhasil |
| Login dengan akun tidak terdaftar | User, Dokter, Admin | Email/username tidak terdaftar | Sistem menolak login dan menampilkan pesan kesalahan umum | Pesan kesalahan berhasil ditampilkan | Berhasil |

## 9. Logout

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Logout dari sistem | User, Dokter, Admin | Klik tombol keluar | Sistem mengakhiri sesi dan mengarahkan aktor ke landing page | Logout berhasil dilakukan | Berhasil |
| Mengakses halaman terproteksi setelah logout | User, Dokter, Admin | URL halaman terproteksi | Sistem mengarahkan aktor ke halaman masuk | Redirect berhasil dilakukan | Berhasil |

## 10. Reset Kata Sandi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Meminta tautan reset kata sandi dengan email terdaftar | User, Dokter, Admin | Email valid | Sistem mengirim email reset kata sandi | Email reset kata sandi berhasil dikirim | Berhasil |
| Meminta tautan reset kata sandi dengan email tidak terdaftar | User, Dokter, Admin | Email tidak terdaftar | Sistem menampilkan respons aman tanpa membuka informasi akun | Respons berhasil ditampilkan | Berhasil |
| Mengatur ulang kata sandi dengan token valid | User, Dokter, Admin | Token valid dan password baru | Sistem memperbarui kata sandi akun | Kata sandi berhasil diperbarui | Berhasil |
| Mengatur ulang kata sandi dengan token tidak valid | User, Dokter, Admin | Token tidak valid | Sistem menolak perubahan dan menampilkan pesan kesalahan | Pesan kesalahan berhasil ditampilkan | Berhasil |

## 11. Mengelola Profil User

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat halaman profil | User | URL `/profil` | Sistem menampilkan data profil pasien | Profil berhasil ditampilkan | Berhasil |
| Memperbarui data profil dengan data valid | User | Nama, username, email, nomor telepon, tanggal lahir, gender | Sistem menyimpan perubahan profil | Profil berhasil diperbarui | Berhasil |
| Memilih avatar bawaan | User | Pilihan avatar pasien | Sistem menampilkan avatar bawaan yang dipilih tanpa menghapus foto upload | Avatar berhasil diperbarui | Berhasil |
| Mengunggah foto profil | User | File gambar valid | Sistem menyimpan gambar dan menampilkan preview foto | Foto profil berhasil diunggah | Berhasil |
| Mengisi data profil dengan format tidak valid | User | Email atau tanggal lahir tidak valid | Sistem menolak perubahan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |

## 12. Membuat Reservasi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuat reservasi dengan data valid | User | Klinik, dokter, tanggal, slot, data pasien, keluhan | Sistem menyimpan reservasi dengan status pending | Reservasi berhasil dibuat | Berhasil |
| Membuat reservasi tanpa memilih dokter | User | Dokter tidak dipilih | Sistem menolak reservasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Membuat reservasi tanpa memilih slot | User | Slot tidak dipilih | Sistem menolak reservasi dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Membuat reservasi pada slot penuh | User | Slot yang kapasitasnya habis | Sistem menolak reservasi dan menampilkan informasi slot penuh | Informasi slot penuh berhasil ditampilkan | Berhasil |
| Membuat reservasi dengan data pasien belum lengkap | User | Tanggal lahir atau gender kosong | Sistem meminta user melengkapi data pasien | Validasi data pasien berhasil ditampilkan | Berhasil |
| Membuat reservasi lebih dari satu pada klinik dan tanggal yang sama | User | Reservasi aktif pada tanggal yang sama | Sistem menampilkan peringatan atau menolak sesuai aturan reservasi aktif | Peringatan berhasil ditampilkan | Berhasil |

## 13. Konfirmasi Detail Reservasi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuka modal konfirmasi reservasi | User | Klik tombol pesan setelah data lengkap | Sistem menampilkan ringkasan data pasien dan data reservasi | Modal konfirmasi berhasil ditampilkan | Berhasil |
| Mengonfirmasi reservasi dari modal | User | Klik konfirmasi reservasi | Sistem menyimpan reservasi dan menampilkan modal berhasil | Reservasi berhasil dikonfirmasi | Berhasil |
| Membatalkan konfirmasi dari modal | User | Klik kembali atau tutup modal | Sistem menutup modal tanpa menyimpan reservasi | Modal berhasil ditutup | Berhasil |

## 14. Melihat Reservasi Pasien

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat halaman reservasi pasien | User | URL `/reservasi` | Sistem menampilkan reservasi aktif dan riwayat reservasi pasien | Data reservasi berhasil ditampilkan | Berhasil |
| Melihat reservasi pending | User | Reservasi status pending | Sistem menampilkan status pending dan estimasi waktu bernilai `-` | Status pending berhasil ditampilkan | Berhasil |
| Melihat reservasi approved | User | Reservasi status approved | Sistem menampilkan nomor antrean, posisi, dan estimasi waktu jika masih menunggu | Informasi antrean berhasil ditampilkan | Berhasil |
| Melihat riwayat reservasi completed | User | Reservasi selesai | Sistem menampilkan reservasi pada riwayat dan tombol cek rekam medis jika tersedia | Riwayat berhasil ditampilkan | Berhasil |

## 15. Mengubah Jadwal Reservasi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuka modal reschedule | User | Reservasi aktif | Sistem menampilkan pilihan tanggal, slot tersedia, dan alasan reschedule | Modal reschedule berhasil ditampilkan | Berhasil |
| Reschedule ke tanggal dan slot valid | User | Tanggal, slot, dan alasan valid | Sistem memperbarui jadwal reservasi dan menyimpan alasan reschedule | Jadwal reservasi berhasil diperbarui | Berhasil |
| Reschedule tanpa alasan | User | Alasan kosong | Sistem menolak perubahan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Reschedule ke tanggal tanpa jadwal dokter | User | Tanggal tidak sesuai jadwal dokter | Sistem menampilkan informasi slot tidak tersedia | Informasi slot tidak tersedia berhasil ditampilkan | Berhasil |
| Reschedule ke slot penuh | User | Slot yang kapasitasnya habis | Sistem menolak reschedule dan menampilkan informasi slot penuh | Informasi slot penuh berhasil ditampilkan | Berhasil |

## 16. Membatalkan Reservasi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuka modal pembatalan reservasi | User | Reservasi aktif | Sistem menampilkan modal pembatalan dan field alasan | Modal pembatalan berhasil ditampilkan | Berhasil |
| Membatalkan reservasi dengan alasan valid | User | Alasan pembatalan | Sistem mengubah status reservasi menjadi cancelled | Reservasi berhasil dibatalkan | Berhasil |
| Membatalkan reservasi tanpa alasan | User | Alasan kosong | Sistem menolak pembatalan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Membatalkan reservasi yang sudah completed | User | Reservasi completed | Sistem menolak pembatalan karena reservasi sudah selesai | Pembatalan berhasil ditolak | Berhasil |

## 17. Melihat Status Antrean

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat antrean reservasi approved | User | Reservasi approved | Sistem menampilkan nomor antrean, posisi, dan antrean yang sedang dipanggil | Status antrean berhasil ditampilkan | Berhasil |
| Melihat estimasi waktu untuk antrean waiting | User | Queue status waiting | Sistem menampilkan estimasi waktu tunggu berdasarkan data backend | Estimasi waktu berhasil ditampilkan | Berhasil |
| Melihat antrean yang sedang dipanggil | User | Queue status called | Sistem menampilkan label sedang dipanggil | Label antrean berhasil ditampilkan | Berhasil |
| Melihat antrean yang sedang diperiksa | User | Queue status in_progress | Sistem menampilkan label sedang diperiksa | Label antrean berhasil ditampilkan | Berhasil |

## 18. Melihat Rekam Medis Pasien

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar rekam medis | User | URL `/rekam-medis` | Sistem menampilkan rekam medis milik pasien | Rekam medis berhasil ditampilkan | Berhasil |
| Mencari rekam medis berdasarkan kata kunci | User | Nama klinik, dokter, diagnosis, atau kode reservasi | Sistem menampilkan rekam medis yang sesuai | Rekam medis berhasil dicari | Berhasil |
| Membuka rekam medis dari riwayat reservasi | User | Query kode reservasi | Sistem mengisi pencarian dan menampilkan rekam medis terkait | Rekam medis terkait berhasil ditampilkan | Berhasil |
| Mengakses rekam medis tanpa login | User | URL `/rekam-medis` tanpa sesi | Sistem mengarahkan user ke halaman masuk dengan parameter tujuan | Redirect berhasil dilakukan | Berhasil |

## 19. Dashboard Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat dashboard dokter | Dokter | Login sebagai dokter | Sistem menampilkan ringkasan hari ini, antrean, pasien saat ini, jadwal, dan riwayat rekam medis | Dashboard dokter berhasil ditampilkan | Berhasil |
| Mengubah filter klinik pada dashboard dokter | Dokter | Klinik tempat dokter terdaftar | Sistem menampilkan data sesuai klinik yang dipilih | Data dashboard berhasil difilter | Berhasil |
| Mengakses dashboard dokter dengan akun non-dokter | User, Admin | URL dashboard dokter | Sistem menolak akses atau mengarahkan sesuai peran | Akses berhasil dibatasi | Berhasil |

## 20. Mengelola Antrean Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat antrean dokter | Dokter | Klinik dan tanggal | Sistem menampilkan daftar antrean approved milik dokter | Antrean dokter berhasil ditampilkan | Berhasil |
| Memulai pemeriksaan antrean yang valid | Dokter | Queue status called | Sistem mengubah queue status menjadi in_progress | Antrean berhasil dimulai | Berhasil |
| Menyelesaikan antrean yang belum in_progress | Dokter | Queue status waiting atau called | Sistem menonaktifkan tombol selesai dan menampilkan petunjuk | Aksi selesai berhasil dicegah | Berhasil |
| Menyelesaikan antrean in_progress | Dokter | Queue status in_progress | Sistem membuka form rekam medis untuk menyelesaikan pemeriksaan | Form rekam medis berhasil ditampilkan | Berhasil |

## 21. Membuat Rekam Medis

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuat rekam medis dengan data valid | Dokter, Admin | Doctor notes wajib, diagnosis/treatment/resep opsional | Sistem menyimpan rekam medis dan mengubah reservasi menjadi completed | Rekam medis berhasil dibuat | Berhasil |
| Membuat rekam medis tanpa doctor notes | Dokter, Admin | Doctor notes kosong | Sistem menolak penyimpanan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Membuat rekam medis untuk pasien walk-in | Dokter, Admin | Reservasi walk-in in_progress | Sistem menyimpan rekam medis tanpa patient_id tetapi tetap terhubung ke reservasi | Rekam medis walk-in berhasil dibuat | Berhasil |
| Membuat rekam medis untuk reservasi yang bukan in_progress | Dokter, Admin | Reservasi belum dimulai | Sistem menolak penyimpanan rekam medis | Penyimpanan berhasil ditolak | Berhasil |

## 22. Melihat Riwayat Rekam Medis Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat riwayat rekam medis dokter | Dokter | Klinik terpilih | Sistem menampilkan riwayat rekam medis yang dibuat dokter pada klinik terkait | Riwayat rekam medis berhasil ditampilkan | Berhasil |
| Mencari riwayat rekam medis dokter | Dokter | Nama pasien, diagnosis, atau kode reservasi | Sistem menampilkan riwayat yang sesuai kata kunci | Riwayat berhasil dicari | Berhasil |
| Memfilter riwayat rekam medis berdasarkan tanggal | Dokter | Tanggal tertentu | Sistem menampilkan riwayat sesuai tanggal | Riwayat berhasil difilter | Berhasil |

## 23. Mengelola Jadwal Praktik Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat jadwal praktik dokter | Dokter | Klinik terpilih | Sistem menampilkan jadwal praktik dokter pada klinik tersebut | Jadwal berhasil ditampilkan | Berhasil |
| Membuat jadwal praktik baru | Dokter | Hari, jam mulai, jam selesai, durasi window, kapasitas | Sistem menyimpan jadwal praktik baru jika valid | Jadwal berhasil dibuat | Berhasil |
| Mengubah jadwal praktik | Dokter | Data jadwal yang diperbarui | Sistem menyimpan perubahan jadwal praktik | Jadwal berhasil diperbarui | Berhasil |
| Membuat jadwal di luar jam operasional klinik | Dokter | Jam praktik tidak sesuai jam operasional | Sistem menolak jadwal dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Mengatur durasi window dari preset | Dokter | 15, 30, atau 60 menit | Sistem menampilkan preview window dan estimasi kapasitas | Preview window berhasil ditampilkan | Berhasil |

## 24. Mengelola Profil Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat profil dokter | Dokter | URL profil dokter | Sistem menampilkan data identitas dokter dan avatar/foto | Profil dokter berhasil ditampilkan | Berhasil |
| Memperbarui spesialisasi dokter per klinik | Dokter | Klinik dan daftar spesialisasi | Sistem menyimpan spesialisasi pada relasi dokter-klinik | Spesialisasi berhasil diperbarui | Berhasil |
| Memilih avatar bawaan dokter | Dokter | Pilihan avatar dokter | Sistem menampilkan avatar bawaan tanpa menghapus foto upload | Avatar dokter berhasil diperbarui | Berhasil |
| Mengunggah foto dokter | Dokter | File gambar valid | Sistem menyimpan gambar dan menampilkan foto dokter | Foto dokter berhasil diunggah | Berhasil |

## 25. Melihat Laporan Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat laporan dokter | Dokter | Klinik dan periode | Sistem menampilkan rekap reservasi dan rekam medis milik dokter | Laporan dokter berhasil ditampilkan | Berhasil |
| Memfilter laporan dokter berdasarkan periode | Dokter | Tanggal mulai dan tanggal akhir | Sistem menampilkan laporan sesuai periode | Laporan berhasil difilter | Berhasil |
| Mengekspor laporan dokter | Dokter | Format PDF atau Excel | Sistem menghasilkan file laporan sesuai format | File laporan berhasil dibuat | Berhasil |

## 26. Dashboard Admin

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat dashboard admin | Admin | Login sebagai admin | Sistem menampilkan ringkasan reservasi, antrean, dokter, admin, dan jadwal | Dashboard admin berhasil ditampilkan | Berhasil |
| Mengubah pilihan klinik sebagai superadmin | Admin | Klinik terpilih | Sistem menampilkan data dashboard sesuai klinik yang dipilih | Data dashboard berhasil difilter | Berhasil |
| Mengakses data klinik sebagai admin klinik | Admin | Login sebagai admin klinik | Sistem hanya menampilkan data klinik yang terhubung dengan admin | Data berhasil dibatasi sesuai klinik | Berhasil |

## 27. Mengelola Reservasi Admin

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar reservasi | Admin | Klinik, status, dokter, atau tanggal | Sistem menampilkan reservasi sesuai scope dan filter | Daftar reservasi berhasil ditampilkan | Berhasil |
| Menyetujui reservasi pending | Admin | Admin notes opsional | Sistem mengubah status menjadi approved dan membuat antrean | Reservasi berhasil disetujui | Berhasil |
| Menolak reservasi pending | Admin | Cancellation reason | Sistem mengubah status menjadi rejected dan menyimpan alasan | Reservasi berhasil ditolak | Berhasil |
| Mengubah detail reservasi | Admin | Data pasien, dokter, jadwal, tanggal, atau keluhan | Sistem memperbarui data reservasi sesuai validasi | Reservasi berhasil diperbarui | Berhasil |
| Mengubah reservasi ke dokter yang tidak terhubung klinik | Admin | Dokter di luar klinik | Sistem menolak perubahan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |

## 28. Membuat Reservasi Walk-In

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Membuat walk-in untuk pasien terdaftar | Admin | Patient_id, dokter, tanggal, slot, keluhan | Sistem membuat reservasi untuk pasien terdaftar | Reservasi walk-in berhasil dibuat | Berhasil |
| Membuat walk-in untuk pasien tanpa akun | Admin | Guest name, guest phone number, dokter, tanggal, slot, keluhan | Sistem membuat reservasi dengan patient_id kosong | Reservasi walk-in tamu berhasil dibuat | Berhasil |
| Membuat walk-in tanpa data identitas pasien | Admin | Patient_id kosong dan guest name kosong | Sistem menolak reservasi dan menampilkan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Membuat walk-in pada slot penuh | Admin | Slot penuh | Sistem menolak reservasi dan menampilkan informasi slot penuh | Informasi slot penuh berhasil ditampilkan | Berhasil |

## 29. Mengelola Antrean Admin

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar antrean approved | Admin | Klinik, dokter, tanggal | Sistem hanya menampilkan antrean dari reservasi approved | Daftar antrean berhasil ditampilkan | Berhasil |
| Memanggil antrean waiting | Admin | Queue status waiting | Sistem mengubah queue status menjadi called | Antrean berhasil dipanggil | Berhasil |
| Memulai antrean called | Admin | Queue status called | Sistem mengubah queue status menjadi in_progress | Antrean berhasil dimulai | Berhasil |
| Melewati antrean waiting atau called | Admin | Queue status waiting/called | Sistem mengubah queue status menjadi skipped | Antrean berhasil dilewati | Berhasil |
| Menyelesaikan antrean in_progress | Admin | Doctor notes dan data rekam medis | Sistem membuat rekam medis dan mengubah reservasi menjadi completed | Antrean berhasil diselesaikan | Berhasil |

## 30. Mengubah Nomor Antrean

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Mengubah nomor antrean dengan nomor valid | Admin | Queue number baru | Sistem memperbarui urutan antrean dan menjaga nomor tetap berurutan | Nomor antrean berhasil diperbarui | Berhasil |
| Mengubah nomor antrean dengan nomor tidak valid | Admin | Nomor kosong, nol, atau negatif | Sistem menolak perubahan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |
| Reset antrean ke waiting | Admin | Queue status skipped/called | Sistem mengubah status antrean kembali ke waiting sesuai aturan | Status antrean berhasil direset | Berhasil |

## 31. Mengelola Data Dokter

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar dokter | Admin | Klinik dan status terdaftar/belum terdaftar | Sistem menampilkan dokter sesuai scope klinik | Daftar dokter berhasil ditampilkan | Berhasil |
| Menambahkan dokter baru | Admin | Nama, username, email, nomor telepon, tanggal lahir, gender | Sistem membuat akun dokter baru | Dokter berhasil dibuat | Berhasil |
| Mengassign dokter ke klinik | Admin | Dokter belum terdaftar pada klinik | Sistem menghubungkan dokter dengan klinik | Dokter berhasil diassign | Berhasil |
| Menghapus dokter dari klinik | Admin | Dokter terdaftar pada klinik | Sistem menghapus relasi dokter dengan klinik sesuai scope | Dokter berhasil diremove dari klinik | Berhasil |
| Mengubah spesialisasi dokter per klinik | Admin | Daftar spesialisasi | Sistem menyimpan spesialisasi pada relasi dokter-klinik | Spesialisasi berhasil diperbarui | Berhasil |

## 32. Mengelola Detail Dokter dan Jadwal Praktik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat detail dokter | Admin | Pilih dokter | Sistem menampilkan profil dokter, jadwal praktik, dan data sesuai hak akses | Detail dokter berhasil ditampilkan | Berhasil |
| Memperbarui data dokter sebagai superadmin | Admin | Data identitas dokter | Sistem memperbarui data global dokter | Data dokter berhasil diperbarui | Berhasil |
| Membuat jadwal praktik dokter | Admin | Hari, jam mulai, jam selesai, window, kapasitas | Sistem menyimpan jadwal praktik dokter pada klinik terkait | Jadwal praktik berhasil dibuat | Berhasil |
| Membuat jadwal pada hari yang sudah memiliki jadwal aktif | Admin | Hari yang telah terisi | Sistem menonaktifkan atau menolak pilihan hari sesuai validasi | Jadwal duplikat berhasil dicegah | Berhasil |
| Menghapus jadwal praktik dokter | Admin | Jadwal yang dipilih | Sistem menghapus jadwal praktik sesuai validasi | Jadwal praktik berhasil dihapus | Berhasil |

## 33. Mengelola Data Pasien

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar pasien | Admin | Klinik terpilih atau seluruh data untuk superadmin | Sistem menampilkan pasien sesuai hak akses | Daftar pasien berhasil ditampilkan | Berhasil |
| Mencari pasien | Admin | Nama, email, username, atau nomor telepon | Sistem menampilkan pasien sesuai kata kunci | Data pasien berhasil dicari | Berhasil |
| Melihat detail pasien | Admin | Pilih pasien | Sistem menampilkan profil dan riwayat reservasi pasien | Detail pasien berhasil ditampilkan | Berhasil |
| Memperbarui data pasien sebagai superadmin | Admin | Data identitas pasien | Sistem menyimpan perubahan data pasien | Data pasien berhasil diperbarui | Berhasil |
| Menghapus pasien sebagai superadmin | Admin | Pasien yang dipilih | Sistem menghapus atau menolak penghapusan sesuai aturan relasi data | Aksi penghapusan berhasil diproses | Berhasil |

## 34. Mengelola Data Klinik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat daftar klinik | Admin | Login sebagai superadmin | Sistem menampilkan daftar klinik | Daftar klinik berhasil ditampilkan | Berhasil |
| Menambahkan klinik baru | Admin | Nama, email, nomor telepon, kota, alamat | Sistem membuat data klinik baru tanpa membuat jam operasional default | Klinik berhasil dibuat | Berhasil |
| Melihat detail klinik | Admin | Pilih klinik | Sistem menampilkan pengaturan klinik, admin klinik, dan jam operasional | Detail klinik berhasil ditampilkan | Berhasil |
| Memperbarui data klinik | Admin | Nama, email, nomor telepon, kota, alamat | Sistem menyimpan perubahan data klinik | Data klinik berhasil diperbarui | Berhasil |
| Menghapus klinik | Admin | Klinik yang dipilih | Sistem menghapus atau menolak penghapusan sesuai aturan relasi data | Aksi penghapusan klinik berhasil diproses | Berhasil |

## 35. Mengelola Admin Klinik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Menambahkan admin klinik | Admin | Nama, username, email, nomor telepon, tanggal lahir, gender, password | Sistem membuat akun admin yang langsung terhubung ke klinik | Admin klinik berhasil dibuat | Berhasil |
| Memperbarui admin klinik | Admin | Data admin klinik | Sistem menyimpan perubahan data admin | Admin klinik berhasil diperbarui | Berhasil |
| Menghapus admin klinik | Admin | Admin klinik yang dipilih | Sistem menghapus akun atau relasi admin sesuai aturan | Admin klinik berhasil dihapus | Berhasil |

## 36. Mengelola Jam Operasional Klinik

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat jam operasional klinik | Admin | Klinik terpilih | Sistem menampilkan jam operasional klinik mulai dari hari Senin | Jam operasional berhasil ditampilkan | Berhasil |
| Mengatur jam operasional beberapa hari sekaligus | Admin | Hari terpilih, jam buka, jam tutup | Sistem menerapkan jam operasional ke hari yang dipilih | Jam operasional berhasil diperbarui | Berhasil |
| Menandai hari sebagai tutup | Admin | Hari terpilih dan status tutup | Sistem menyimpan hari tersebut sebagai hari tutup | Status tutup berhasil disimpan | Berhasil |
| Mengatur jam tutup lebih awal dari jam buka | Admin | Jam tutup sebelum jam buka | Sistem menolak perubahan dan menampilkan pesan validasi | Pesan validasi berhasil ditampilkan | Berhasil |

## 37. Mengelola Master Kota

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Memilih kota dari dropdown | Admin | Kota yang tersedia | Sistem menyimpan kota pada data klinik | Kota berhasil dipilih | Berhasil |
| Menambahkan kota baru dari form klinik | Admin | Nama kota baru | Sistem menambahkan kota ke daftar master dan dapat dipilih ulang | Kota baru berhasil ditambahkan | Berhasil |
| Menambahkan kota yang sudah ada dengan perbedaan kapitalisasi | Admin | Nama kota sama tetapi beda huruf besar/kecil | Sistem mencegah duplikasi kota | Duplikasi kota berhasil dicegah | Berhasil |

## 38. Melihat Data Rekam Medis Admin

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat data rekam medis sebagai admin klinik | Admin | Klinik admin | Sistem menampilkan rekam medis clinic-scoped | Rekam medis berhasil ditampilkan | Berhasil |
| Mengakses data rekam medis sebagai superadmin | Admin | Login sebagai superadmin | Sistem menyembunyikan data rekam medis karena alasan privasi clinic-scoped | Data rekam medis berhasil disembunyikan | Berhasil |
| Mencari rekam medis sebagai admin klinik | Admin | Nama pasien, dokter, diagnosis, atau kode reservasi | Sistem menampilkan rekam medis sesuai kata kunci dan scope klinik | Rekam medis berhasil dicari | Berhasil |
| Memfilter rekam medis berdasarkan dokter atau tanggal | Admin | Dokter atau tanggal | Sistem menampilkan rekam medis sesuai filter | Rekam medis berhasil difilter | Berhasil |

## 39. Melihat Laporan

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Melihat laporan reservasi sebagai admin klinik | Admin | Klinik dan periode | Sistem menampilkan laporan reservasi clinic-scoped | Laporan reservasi berhasil ditampilkan | Berhasil |
| Melihat laporan sebagai superadmin | Admin | Klinik terpilih atau seluruh klinik | Sistem menampilkan laporan umum tanpa menampilkan data rekam medis sensitif | Laporan superadmin berhasil ditampilkan | Berhasil |
| Melihat rekap per dokter | Admin | Klinik dan periode | Sistem menampilkan rekap reservasi dan pemeriksaan per dokter | Rekap per dokter berhasil ditampilkan | Berhasil |
| Memfilter laporan berdasarkan status | Admin | Pending, approved, cancelled, rejected, completed | Sistem menampilkan laporan sesuai status yang dipilih | Laporan berhasil difilter | Berhasil |

## 40. Export Laporan

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Export laporan reservasi ke PDF | Admin, Dokter | Format PDF | Sistem menghasilkan file PDF berisi data laporan sesuai scope | File PDF berhasil dibuat | Berhasil |
| Export laporan reservasi ke Excel | Admin, Dokter | Format Excel | Sistem menghasilkan file Excel berisi data laporan sesuai scope | File Excel berhasil dibuat | Berhasil |
| Export laporan rekam medis sebagai admin klinik atau dokter | Admin, Dokter | Format PDF atau Excel | Sistem menghasilkan file laporan rekam medis sesuai scope | File laporan berhasil dibuat | Berhasil |
| Export rekam medis sebagai superadmin | Admin | Login sebagai superadmin | Sistem tidak menampilkan atau tidak mengizinkan export rekam medis sensitif | Export rekam medis berhasil dibatasi | Berhasil |

## 41. Notifikasi Reservasi

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Menerima notifikasi reservasi disetujui | User | Reservasi approved | Sistem mengirim notifikasi sesuai kanal yang tersedia | Notifikasi berhasil dikirim | Berhasil |
| Menerima notifikasi reservasi ditolak | User | Reservasi rejected | Sistem mengirim notifikasi berisi status dan alasan penolakan | Notifikasi berhasil dikirim | Berhasil |
| Menerima notifikasi reservasi dibatalkan | User | Reservasi cancelled | Sistem mengirim notifikasi berisi status dan alasan pembatalan | Notifikasi berhasil dikirim | Berhasil |
| Menerima notifikasi pengingat reservasi | User | Reservasi approved mendekati waktu praktik | Sistem mengirim reminder satu kali sebelum jadwal reservasi | Reminder berhasil dikirim | Berhasil |

## 42. Notifikasi Queue

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| Menerima notifikasi antrean dipanggil | User | Queue status called | Sistem mengirim notifikasi bahwa antrean pasien sedang dipanggil | Notifikasi berhasil dikirim | Berhasil |
| Menerima notifikasi reservasi selesai | User | Reservasi completed | Sistem mengirim notifikasi selesai beserta ringkasan rekam medis yang diperbolehkan | Notifikasi berhasil dikirim | Berhasil |
| Tidak menerima notifikasi ketika antrean pasien lain berubah | User | Perubahan urutan antrean pasien lain | Sistem tidak mengirim notifikasi berlebihan kepada pasien | Notifikasi tidak dikirim sesuai aturan | Berhasil |

## 43. Akses Berdasarkan Peran

| Test Case | Aktor | Data Masukan (Opsional) | Hasil yang Diharapkan | Hasil Pengujian | Status (Berhasil/Tidak) |
|---|---|---|---|---|---|
| User mengakses halaman admin | User | URL halaman admin | Sistem menolak akses dan mengarahkan user sesuai aturan | Akses berhasil ditolak | Berhasil |
| Dokter mengakses halaman admin | Dokter | URL halaman admin | Sistem menolak akses karena dokter bukan admin | Akses berhasil ditolak | Berhasil |
| Admin mengakses halaman dokter | Admin | URL halaman dokter | Sistem menolak akses atau mengarahkan admin sesuai peran | Akses berhasil ditolak | Berhasil |
| Pengunjung tanpa login mengakses halaman protected | User | URL protected | Sistem mengarahkan ke `/masuk` dengan parameter tujuan | Redirect berhasil dilakukan | Berhasil |

