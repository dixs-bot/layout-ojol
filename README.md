# 🛵 OjekX – Mini Super App Ojol Belajar Backend & Frontend

OjekX adalah proyek **ojek online sederhana** yang dibangun sepenuhnya dari **HP Android** menggunakan **Termux, Ruby, dan HTML + React UMD**.  
Tujuan utamanya: **belajar konsep backend–frontend, role user, dan alur order ojol** (ride & food) dengan stack yang ringan.

> Project ini bukan untuk produksi besar dulu, tapi sebagai **MVP (Minimum Viable Product)** dan portofolio dev.

---

## ✨ Fitur Utama

### 👤 Role & Panel

- **Customer Panel**
  - Daftar & login
  - Pesan layanan:
    - Bike / Car
    - Food Delivery (via resto/merchant)
  - Lihat status order (driver otw, sampai, mengantar, selesai)

- **Driver Panel**
  - Daftar & login sebagai driver
  - Mode **Online / Offline**
  - Terima order:
    - Ride (Bike / Car)
    - Food Delivery
  - Step-by-step status:
    - Ride:
      1. Menuju lokasi jemput
      2. Tiba di titik jemput
      3. Sedang mengantar
      4. Selesai
    - Food:
      1. Menuju restoran
      2. Sudah di restoran
      3. Mengantar ke customer
      4. Selesai

- **Merchant / Resto Panel**
  - Daftar & login sebagai **merchant**
  - Menerima pesanan FOOD dari customer
  - Klik **"Pesanan siap, kirim ke driver"** → order dilempar ke driver
  - Monitoring:
    - Pesanan menunggu konfirmasi resto
    - Pesanan sedang dikerjakan driver
    - Riwayat pesanan selesai

- **Owner Panel** (draft/early)
  - Konsep untuk lihat pendapatan & fee 20% per order
  - Bisa dikembangkan untuk laporan harian / mingguan / bulanan

---

## 🧱 Arsitektur Sederhana

Proyek ini dipisah jadi 2 bagian:

### 1. Backend – Ruby (`app.rb`)

- API sederhana dengan Ruby (Sinatra / Rack style)
- Data disimpan dalam file JSON:
  - `users.json` – semua akun (driver, customer, merchant, owner)
  - `orders.json` – semua order
- Fitur backend:
  - `/register` – daftar akun + role
  - `/login` – login, balikin token
  - `/profile` – info user berdasarkan token
  - `/orders` – list order (filtered by role)
  - `/orders/create` – buat order dari customer
  - `/orders/open` – list order yang bisa diambil driver
  - `/orders/accept` – driver ambil order
  - `/orders/status` – update status order
  - `/merchant/release` – merchant kirim pesanan ke driver

> Catatan: autentikasi pakai token sederhana (bukan full JWT production).

### 2. Frontend – HTML Single File per Role

Repo `layout-ojol` berisi:

```bash
layout-ojol/
├── driver/
│   └── index.html          # OjekX Driver Panel (single file, React UMD)
├── customer/
│   └── index.html          # OjekX Customer Panel
├── merchant/
│   └── index.html          # OjekX Merchant / Resto Panel
├── owner/
│   └── index.html          # (opsional / draft) Owner Panel
├── css/
│   └── ...                 # (opsional) styling terpisah
├── js/
│   └── ...                 # (opsional) script terpisah
└── index.html              # (opsional) landing / test
