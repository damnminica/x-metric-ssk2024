# SSK 2024 × X

Papan visual untuk Pemilihan Member Single ke-26 JKT48 (voting 1 September–9 Desember 2024). Aplikasi ini membandingkan suara resmi Top 24 dengan aktivitas di X: mention, akun unik, views, hashtag, follower, dan engagement.

Keramaian di X tidak sama dengan suara yang masuk. Sinyal terkuat untuk masuk papan bukan seberapa sering member menulis, melainkan berapa banyak akun berbeda yang menyebut nama mereka.

## Yang bisa dilihat

Halaman utama, [src/components/desk.tsx](src/components/desk.tsx), satu laporan yang bisa disaring.

| Bagian | Isi |
|---|---|
| Suara | Peringkat akhir Top 24. Klik batang untuk memilih member. |
| Sebaran | Metrik X terhadap suara, plus garis regresi. Merah di atas garis, kuningan di bawah. |
| Korelasi | Koefisien studi: peringkat keseluruhan, kelolosan, dan di dalam Top 24 dengan atau tanpa Feni. |
| Lintasan | Peringkat pada tahap 1, tahap 2, dan hasil akhir. |
| Konversi | Suara per akun unik, dan indeks Senbatsu, Undergirls, serta unranked. |
| Unranked | Estimasi 19 member yang suaranya tidak diumumkan, dibanding cutoff Delynn (26.947). |

Saringan di sidebar berlaku untuk grafik dan tabel: kelompok, generasi, nama, sumbu sebaran, serta opsi menyembunyikan Feni. Estimasi unranked bisa dimatikan. Angka pada tombol unduh tidak mengikuti saringan. Itu laporan lengkap.

## Unduhan

Dari bagian atas halaman, atau langsung dari `public/`:

| Berkas | Isi |
|---|---|
| [public/ssk-2024-laporan.png](public/ssk-2024-laporan.png) | Gambar satu lembar dari papan visual. |
| [public/ssk-2024-laporan.pdf](public/ssk-2024-laporan.pdf) | PDF grafik, beberapa halaman. |
| [public/ssk-2024-laporan-tertulis.pdf](public/ssk-2024-laporan-tertulis.pdf) | Laporan tertulis, 9 halaman. |

## Batas tafsir

- Suara resmi hanya ada untuk 24 nama. Totalnya 1.525.190.
- Lulu tidak tercantum pada pengumuman tahap 1. Delynn tidak tercantum pada tahap 1 maupun tahap 2. Sel kosong berarti tidak diumumkan, bukan suara nol.
- Koefisien N = 43 dikutip dari studi sumber. Unranked tidak punya suara publik, jadi koefisien itu bukan korelasi terhadap jumlah suara yang diumumkan untuk ke-43 orang.
- Garis regresi di grafik dihitung ulang dari 24 pasang akun unik dan suara akhir. Pearson di dalam Top 24 adalah 0,121. Tanpa Feni, 0,401.
- Estimasi unranked memakai tarif rata-rata Undergirls (25,96 suara per akun unik, 0,0879 per follower, 4,20 per engagement), dicampur kira-kira 45% / 35% / 20%. Lima nama melewati cutoff model. Itu potensi menurut X, bukan hasil pemungutan.
- Tidak ada angka di sini yang membuktikan sebab-akibat. Mention bisa mengikuti ketenaran, bukan menghasilkan suara.

## Data

Angka aplikasi ada di [src/data/ssk.ts](src/data/ssk.ts): 43 member, rata-rata kelompok, matriks korelasi, dan tiga tahap voting. Berkas itu dihasilkan dari dua workbook sumber, bukan diketik ulang di komponen.

- Hasil resmi Top 24 dan metrik X per member.
- Matriks korelasi, militansi, konversi, dan proyeksi unranked.

## Menjalankan

Butuh Node.js. Dari akar repositori:

```bash
npm install
npm run dev
```

Dev server mendengarkan di [http://127.0.0.1:8080](http://127.0.0.1:8080).

```bash
npm run typecheck
npm run build
npm run preview:restart   # hasil build di http://127.0.0.1:8081
```

`npm run build` juga menjalankan migrasi. Tanpa `DATABASE_URL`, migrasi Postgres dilewati. Aplikasi visual ini tidak membutuhkan basis data. Seluruh angkanya statis.

## Susunan

```
src/components/desk.tsx   papan visual
src/data/ssk.ts           dataset yang dirender
src/lib/format.ts         angka Indonesia, Pearson, regresi linear
src/routes/index.tsx      rute halaman utama
public/                   favicon dan tiga berkas unduhan
```

Tumpukannya Vite, TanStack Start, React, Recharts, dan Tailwind CSS 4. Tipografi: Fraunces untuk judul, Outfit untuk teks. Warna kelompok tetap: merah Senbatsu, kuningan Undergirls, abu-abu unranked.
