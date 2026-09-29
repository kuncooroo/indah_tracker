# Alur kerja Indah Tracker

Panduan singkat untuk ops / admin.

## 1. Generate tracking

**Admin UI**

1. Login `/admin/login`
2. Buka **Shipments** → **Generate tracking** (`/admin/shipments/new`)
3. Isi customer / PO / telepon (4 digit terakhir dipakai verifikasi publik)
4. Opsional: isi **External Order ID** jika sinkron dari ERP

**Dari katalog / ERP (API)**

```http
POST /api/v1/shipments
x-api-key: <TRACKER_API_KEY>
Content-Type: application/json

{
  "orderNumber": "PO-001",
  "externalOrderId": "erp-uuid",
  "customerName": "Budi",
  "companyName": "PT Contoh",
  "phone": "081234567890",
  "applyTemplateId": "optional-template-uuid",
  "upsert": true
}
```

Response berisi `trackingNumber` + `trackUrl`.

## 2. Apply template WBS

1. Pastikan ada template aktif di **Template WBS**
2. Buka shipment → **Update progress**
3. **Apply template** (hanya jika belum ada fase)
4. Preview bobot muncul sebelum apply

Atau kirim `applyTemplateId` saat create via API.

## 3. Update progress

- Desktop: `/admin/shipments/[id]/progress` — update per tahap + foto
- HP lapangan: **/admin/workshop** (PWA) — checklist cepat Belum / Kerja / Selesai
- Bulk simpan beberapa tahap sekaligus

Progress % dihitung dari bobot WBS. Status shipment bisa disarankan (mis. 100% → Quality check) tanpa override paksa.

## 4. Kirim link ke customer

Dari detail shipment:

1. Salin **track URL** atau kirim **WhatsApp**
2. Customer buka `/track?code=…&phone=…`
3. Bisa ganti bahasa **ID / EN** di header track
4. Customer melihat status, progress, foto, dan update terbaru (versi aman)

Laporan PDF (opsional): `/admin/shipments/[id]/report` → Cetak / Simpan PDF.

## Checklist first-run

1. Template WBS aktif
2. Minimal 1 shipment
3. Progress / WBS terpasang
4. Link track dibagikan

Lihat juga banner **First-run guide** di Dashboard jika data masih kosong.

## Monitoring

- Health: `GET /api/health` (uptime)
- Error: set `SENTRY_DSN` (opsional)
- Backup: `npm run db:backup`
