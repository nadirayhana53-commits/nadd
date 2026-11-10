KUMPUL DASHBOARD

Isi folder:
- index.html      halaman website
- style.css       desain dan tampilan responsif
- app.js          fungsi dashboard, tugas, mata kuliah, kalender, riwayat, upload
- config.js       konfigurasi Supabase dan profil tampilan
- supabase.sql    tabel, kebijakan akses, dan storage Supabase

MENJALANKAN WEBSITE
1. Ekstrak folder.
2. Buka folder di VS Code.
3. Buka config.js, isi SUPABASE_URL dan SUPABASE_ANON_KEY dari Supabase Project Settings > API.
   Gunakan anon/publishable key, JANGAN gunakan service_role/secret key.
4. Di Supabase > SQL Editor, jalankan isi supabase.sql.
5. Jalankan index.html dengan ekstensi Live Server atau deploy folder ke Vercel.

FITUR
- Tambah, edit, dan hapus mata kuliah dari halaman Mata Kuliah.
- Tambah, edit, dan hapus tugas dari halaman Tugas Saya.
- Upload tugas, unduh file, dan ganti file pengumpulan yang sudah dikirim.
- Dashboard statistik, pencarian, filter, kalender, dan riwayat.
- Tanpa login; data online tersimpan di Supabase.

CATATAN KEAMANAN
Website ini sengaja tanpa login. Kebijakan SQL mengizinkan pengunjung publik membaca, menambah,
mengubah, dan menghapus tugas/mata kuliah serta mengunggah/menghapus file. Jangan simpan dokumen
pribadi atau sensitif. Untuk website publik, gunakan autentikasi dan pembatasan akses sebelum dipakai
oleh banyak orang.
