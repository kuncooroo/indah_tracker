export type TrackLocale = "id" | "en";

export const TRACK_LOCALES: TrackLocale[] = ["id", "en"];

export function parseTrackLocale(raw: string | null | undefined): TrackLocale {
  return raw === "en" ? "en" : "id";
}

const dict = {
  id: {
    brandTrack: "Trace & Track",
    heroTitle: "Lacak progress pesanan Anda",
    heroSub:
      "Masukkan nomor tracking dari Indah Mesin. Data dilindungi verifikasi 4 digit telepon.",
    codeLabel: "Nomor tracking",
    codePlaceholder: "IM-TRK-…",
    phoneLabel: "4 digit terakhir telepon",
    phoneHint: "Opsional jika belum diminta",
    submit: "Lacak",
    loading: "Mencari…",
    memuat: "Memuat…",
    cancelled: "Pesanan dibatalkan",
    statusShipment: "Status pengiriman",
    recentUpdates: "Update terbaru",
    workDetail: "Rincian pengerjaan",
    noWbsTitle: "Detail pengerjaan belum tersedia",
    noWbsBody:
      "Tim produksi belum memasang tahapan WBS untuk tracking ini. Status umum di atas tetap valid — hubungi Indah Mesin jika butuh update lebih detail.",
    updated: "Diperbarui",
    done: "selesai",
    share: "Bagikan",
    copyLink: "Salin link",
    copied: "Tersalin",
    shareHintOk: "Link disalin — bisa di-bookmark atau dikirim ke WhatsApp.",
    shareHintFail: "Salin manual dari bilah alamat browser.",
    bookmarkHint: "Bookmark atau bagikan URL ini agar bisa dibuka lagi tanpa isi form.",
    docs: "Dokumentasi",
    taskDone: "Selesai",
    taskDoing: "Dikerjakan",
    taskTodo: "Belum",
    langId: "ID",
    langEn: "EN",
    errCodeRequired: "Nomor tracking wajib diisi.",
    errNotFoundTitle: "Kode tracking tidak ditemukan",
    errNotFoundMsg: "Periksa ejaan nomor tracking (huruf & angka).",
    errNotFoundHint:
      "Contoh format: IM-TRK-20260926-0001. Hubungi Indah Mesin jika Anda yakin kodenya benar.",
    errPhoneMismatchTitle: "Telepon tidak cocok",
    errPhoneMismatchHint:
      "Gunakan nomor yang terdaftar saat pemesanan. Bukan nomor lain di perusahaan.",
    errPhoneRequiredTitle: "Verifikasi telepon diperlukan",
    errPhoneRequiredMsg:
      "Tracking ditemukan. Masukkan 4 digit terakhir nomor telepon, lalu lacak lagi.",
    errPhoneRequiredHint: "Ini melindungi privasi progress pesanan Anda.",
    errInvalidPhoneTitle: "Format telepon belum lengkap",
    errInvalidPhoneMsg: "Masukkan tepat 4 digit terakhir.",
    errRateTitle: "Terlalu banyak percobaan",
    errRateMsg: "Tunggu beberapa menit lalu coba lagi.",
    errNetworkTitle: "Koneksi gagal",
    errNetworkMsg: "Tidak bisa menghubungi server. Coba lagi.",
    errGenericTitle: "Tidak bisa menampilkan tracking",
    errNeedVerifyTitle: "Perlu verifikasi",
    errNotFoundShort: "Tidak ditemukan.",
    errServer: "Gagal menghubungi server. Coba lagi.",
    progressOverall: "Progress keseluruhan",
    eta: "Estimasi",
    contact: "Butuh bantuan? Hubungi Indah Mesin.",
    formIntro:
      "Masukkan nomor tracking dan 4 digit terakhir nomor telepon yang terdaftar pada PO.",
    phoneVerifyHint: "Wajib untuk verifikasi identitas penerima/pengirim pada PO.",
    trackingNumber: "Nomor tracking",
    phoneDigitsLabel: "4 digit terakhir nomor telepon",
    phoneDigitsPlaceholder: "4 digit terakhir",
    phasePct: "fase",
    weight: "bobot",
    phasePhotos: "Bukti foto fase",
    noSubtasks: "Tidak ada sub-tugas pada fase ini.",
    hoursEst: "jam estimasi",
    hoursActual: "jam aktual",
    note: "Catatan",
    emptyReadyTitle: "Siap melacak pesanan Anda",
    emptyReadyBody:
      "Isi nomor tracking dari Indah Mesin, lalu verifikasi 4 digit telepon.",
    footerTagline: "CV. Indah Jaya Teknik — Spesialis Mesin Retort",
    remainingDone: "Pesanan sudah selesai / terkirim",
    remainingCancelled: "Pesanan dibatalkan",
    remainingOverdue: (d: number) => `Telat ${d} hari dari target`,
    remainingToday: "Target selesai hari ini",
    remainingDays: (d: number) => `±${d} hari lagi`,
    estWorkDays: (d: number) => `Estimasi pengerjaan ${d} hari`,
    targetPrefix: "target",
    steps: {
      CREATED: { label: "Dibuat", short: "Dibuat" },
      IN_PROGRESS: { label: "Proses", short: "Proses" },
      QUALITY_CHECK: { label: "QC", short: "QC" },
      READY_TO_SHIP: { label: "Siap", short: "Siap" },
      IN_TRANSIT: { label: "Kirim", short: "Kirim" },
      DELIVERED: { label: "Terkirim", short: "Selesai" },
    },
    statusShipmentLabels: {
      CREATED: "Dibuat",
      IN_PROGRESS: "Dalam proses",
      QUALITY_CHECK: "Quality check",
      READY_TO_SHIP: "Siap kirim",
      IN_TRANSIT: "Dalam pengiriman",
      DELIVERED: "Terkirim",
      CANCELLED: "Dibatalkan",
    },
  },
  en: {
    brandTrack: "Trace & Track",
    heroTitle: "Track your order progress",
    heroSub:
      "Enter your Indah Mesin tracking number. Data is protected with a 4-digit phone check.",
    codeLabel: "Tracking number",
    codePlaceholder: "IM-TRK-…",
    phoneLabel: "Last 4 phone digits",
    phoneHint: "Optional until requested",
    submit: "Track",
    loading: "Searching…",
    memuat: "Loading…",
    cancelled: "Order cancelled",
    statusShipment: "Shipment status",
    recentUpdates: "Latest updates",
    workDetail: "Work breakdown",
    noWbsTitle: "Work details not available yet",
    noWbsBody:
      "Production has not attached WBS stages for this tracking. The status above remains valid — contact Indah Mesin for more detail.",
    updated: "Updated",
    done: "done",
    share: "Share",
    copyLink: "Copy link",
    copied: "Copied",
    shareHintOk: "Link copied — bookmark it or send via WhatsApp.",
    shareHintFail: "Copy manually from the browser address bar.",
    bookmarkHint: "Bookmark or share this URL to open again without the form.",
    docs: "Photos",
    taskDone: "Done",
    taskDoing: "In progress",
    taskTodo: "Not started",
    langId: "ID",
    langEn: "EN",
    errCodeRequired: "Tracking number is required.",
    errNotFoundTitle: "Tracking code not found",
    errNotFoundMsg: "Check the tracking number spelling (letters & digits).",
    errNotFoundHint:
      "Example format: IM-TRK-20260926-0001. Contact Indah Mesin if you believe the code is correct.",
    errPhoneMismatchTitle: "Phone digits do not match",
    errPhoneMismatchHint:
      "Use the phone number registered with the order — not another company number.",
    errPhoneRequiredTitle: "Phone verification required",
    errPhoneRequiredMsg:
      "Tracking found. Enter the last 4 digits of the phone number, then track again.",
    errPhoneRequiredHint: "This protects the privacy of your order progress.",
    errInvalidPhoneTitle: "Incomplete phone format",
    errInvalidPhoneMsg: "Enter exactly 4 digits.",
    errRateTitle: "Too many attempts",
    errRateMsg: "Wait a few minutes and try again.",
    errNetworkTitle: "Connection failed",
    errNetworkMsg: "Could not reach the server. Try again.",
    errGenericTitle: "Unable to show tracking",
    errNeedVerifyTitle: "Verification needed",
    errNotFoundShort: "Not found.",
    errServer: "Failed to reach the server. Try again.",
    progressOverall: "Overall progress",
    eta: "Estimate",
    contact: "Need help? Contact Indah Mesin.",
    formIntro:
      "Enter your tracking number and the last 4 digits of the phone registered on the PO.",
    phoneVerifyHint: "Required to verify the recipient/sender on the PO.",
    trackingNumber: "Tracking number",
    phoneDigitsLabel: "Last 4 digits of phone number",
    phoneDigitsPlaceholder: "Last 4 digits",
    phasePct: "phase",
    weight: "weight",
    phasePhotos: "Phase photos",
    noSubtasks: "No sub-tasks in this phase.",
    hoursEst: "hours estimated",
    hoursActual: "hours actual",
    note: "Note",
    emptyReadyTitle: "Ready to track your order",
    emptyReadyBody:
      "Enter the Indah Mesin tracking number, then verify 4 phone digits.",
    footerTagline: "CV. Indah Jaya Teknik — Retort Machine Specialist",
    remainingDone: "Order completed / delivered",
    remainingCancelled: "Order cancelled",
    remainingOverdue: (d: number) => `${d} days past target`,
    remainingToday: "Target is today",
    remainingDays: (d: number) => `±${d} days left`,
    estWorkDays: (d: number) => `Estimated work ${d} days`,
    targetPrefix: "target",
    steps: {
      CREATED: { label: "Created", short: "New" },
      IN_PROGRESS: { label: "In progress", short: "Work" },
      QUALITY_CHECK: { label: "QC", short: "QC" },
      READY_TO_SHIP: { label: "Ready", short: "Ready" },
      IN_TRANSIT: { label: "Shipping", short: "Ship" },
      DELIVERED: { label: "Delivered", short: "Done" },
    },
    statusShipmentLabels: {
      CREATED: "Created",
      IN_PROGRESS: "In progress",
      QUALITY_CHECK: "Quality check",
      READY_TO_SHIP: "Ready to ship",
      IN_TRANSIT: "In transit",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
    },
  },
} as const;

export type TrackDict = (typeof dict)["id"];

export function getTrackDict(locale: TrackLocale): TrackDict {
  return dict[locale] as TrackDict;
}

export function formatRelativeLocale(
  date: Date | string | null | undefined,
  locale: TrackLocale
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (locale === "en") {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
  } else {
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const LOCALE_COOKIE = "track_locale";
