# Indah Tracker

Project tracking terpisah dari katalog PWA (`indah_mesin`).

- **Folder:** `c:\laragon\www\indah_tracker`
- **Database:** `indah_tracker` (MySQL terpisah)
- **Public:** `/track` — merah-putih ala J&T Trace & Track
- **Admin:** `/admin` — dashboard netral mirip admin PWA

## Fitur (disamakan dengan PWA)

- Template WBS (fase parent + sub-tugas jam)
- Apply template ke shipment
- Update progress + upload foto dokumentasi
- Public `/track` menampilkan progress WBS + galeri foto
- Admin style netral seperti dashboard PWA

## Setup

1. Pastikan MySQL Laragon running
2. Database: `indah_tracker`
3. Salin env bila perlu: `copy .env.example .env`
4. Install & migrate:

```bash
cd c:\laragon\www\indah_tracker
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Seed membuat:
- Admin `admin@tracker.local` / `admin123`
- Template **Produksi Retort Standar** (fabrikasi, piping/cabang, electrical, QC, packing)
- Sample tracking + task selesai + foto dokumentasi realistis di `public/uploads/doc-*.png`
  (retort, welding, piping cabang, panel listrik, QC, packing)


## Akses

| Halaman | URL |
|---------|-----|
| Public track | http://localhost:3001/track |
| Admin login | http://localhost:3001/admin/login |
| Admin dashboard | http://localhost:3001/admin/dashboard |

**Login seed default**

- Email: `admin@tracker.local`
- Password: `admin123`

## Generate dari katalog PWA (API)

```http
POST http://localhost:3001/api/v1/shipments
x-api-key: <TRACKER_API_KEY>
Content-Type: application/json

{
  "orderNumber": "PO-20260926-001",
  "externalOrderId": "uuid-dari-order",
  "customerName": "Budi",
  "companyName": "PT Contoh",
  "phone": "081234567890"
}
```

Response berisi `trackingNumber` dan `trackUrl` untuk dibagikan ke customer.

## Port

Jalankan di **port 3001** supaya tidak bentrok dengan `indah_mesin` (3000).
