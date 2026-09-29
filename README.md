# Indah Tracker

Project tracking terpisah dari katalog PWA (`indah_mesin`).

- **Folder:** `c:\laragon\www\indah_tracker`
- **Database:** `indah_tracker` (MySQL terpisah)
- **Public:** `/track` — brand Indah Mesin
- **Admin:** `/admin` — dashboard + analytics + WBS

## Setup local

1. MySQL Laragon running, buat DB `indah_tracker`
2. `copy .env.example .env` lalu sesuaikan password MySQL
3. Install & migrate:

```bash
cd c:\laragon\www\indah_tracker
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Seed membuat admin, template WBS, dan sample tracking (+ foto di `public/uploads`).

## Environment: local vs production

| Variabel | Local | Production |
|----------|-------|------------|
| `DATABASE_URL` | MySQL Laragon | MySQL server production |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | boleh nilai contoh | **wajib** secret acak kuat |
| `NEXTAUTH_URL` | `http://localhost:3001` | `https://domain-anda` |
| `NEXT_PUBLIC_APP_URL` | sama local | URL publik HTTPS (untuk `trackUrl`) |
| Upload | `public/uploads` (default) | set `UPLOAD_DIR` + `UPLOAD_PUBLIC_BASE_URL` bila perlu |
| `TRACKER_API_KEY` | bebas untuk dev | key kuat, sama dengan yang dipakai PWA |

Detail lengkap ada di `.env.example`.

## Akses

| Halaman | URL |
|---------|-----|
| Public track | http://localhost:3001/track |
| Link dengan code | http://localhost:3001/track?code=IM-TRK-... |
| + verifikasi telepon | http://localhost:3001/track?code=IM-TRK-...&phone=7890 |
| Admin login | http://localhost:3001/admin/login |

**Login seed default:** `admin@tracker.local` / `admin123`

## Keamanan track publik

- `/api/track` punya rate limit dasar (per IP + anti brute-force 4 digit telepon).
- Override via env: `TRACK_RATE_LIMIT_*` (lihat `.env.example`).

## Reminder deadline (Fase 3)

- Ambang due soon: `/admin/settings` atau env `REMINDER_SOON_DAYS` (default 2).
- Job harian: `npm run cron:reminders` atau `GET/POST /api/cron/deadline-reminders` (+ header `x-cron-secret` / `Authorization: Bearer`).
- Email digest via SMTP (`SMTP_*`). Opsional Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`).
- Anti-spam: 1 notifikasi per shipment per channel per hari (WIB).

## Generate dari katalog PWA / ERP (API v1)

Auth: header `x-api-key: <TRACKER_API_KEY>` atau `Authorization: Bearer <TRACKER_API_KEY>`.

### Create / upsert (idempotent via `externalOrderId`)

```http
POST /api/v1/shipments
Content-Type: application/json

{
  "orderNumber": "PO-20260926-001",
  "externalOrderId": "uuid-dari-order",
  "customerName": "Budi",
  "companyName": "PT Contoh",
  "phone": "081234567890",
  "applyTemplateId": "optional-wbs-template-uuid",
  "upsert": true
}
```

Jika `externalOrderId` sudah ada → update field dasar (bukan buat baru). Response berisi `trackingNumber`, `trackUrl`, `workshopUrl`.

### Lookup

```http
GET /api/v1/shipments?externalOrderId=uuid-dari-order
GET /api/v1/shipments?trackingNumber=IM-TRK-...
GET /api/v1/shipments/<id|trackingNumber|externalOrderId>
```

### Update status / data

```http
PATCH /api/v1/shipments/<id|trackingNumber|externalOrderId>
Content-Type: application/json

{ "status": "IN_PROGRESS", "note": "opsional" }
```

### Webhook outbound

Set `WEBHOOK_URL` (+ opsional `WEBHOOK_SECRET`). Event:

- `shipment.created`
- `shipment.status_changed`
- `shipment.progress_updated`

Header: `X-Tracker-Event`, `X-Tracker-Signature` = HMAC-SHA256 hex dari raw body.

## Workshop PWA (admin lapangan)

1. Login admin di HP: `/admin/login`
2. Buka `/admin/workshop` — install “Add to Home Screen” (manifest + service worker)
3. Tap job → checklist cepat update status tahap

## Alur kerja singkat

1. **Generate tracking** — `/admin/shipments/new` atau `POST /api/v1/shipments`
2. **Apply WBS** — template aktif → Apply di progress (atau `applyTemplateId` di API)
3. **Update** — progress desktop / `/admin/workshop` di HP
4. **Kirim link** — salin track URL / WhatsApp dari detail shipment

Panduan lengkap: `docs/WORKFLOW.md` atau `/admin/help`.

## Monitoring & polish

- Bahasa track publik: toggle **ID / EN**
- OG / title dinamis: `/track?code=…` (+ `/api/og`)
- Health / uptime: `GET /api/health`
- Error: set `SENTRY_DSN` (opsional)
- Upload foto dioptimasi WebP (sharp)

## Port

Jalankan di **port 3001** supaya tidak bentrok dengan `indah_mesin` (3000).
