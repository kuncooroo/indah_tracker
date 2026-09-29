/**
 * Environment helpers — bedakan local vs production dengan jelas.
 *
 * Wajib di semua environment:
 *   DATABASE_URL, AUTH_SECRET (atau NEXTAUTH_SECRET)
 *
 * Local (dev):
 *   NEXTAUTH_URL=http://localhost:3001
 *   NEXT_PUBLIC_APP_URL=http://localhost:3001
 *   Upload disimpan di public/uploads (filesystem lokal)
 *
 * Production:
 *   NEXTAUTH_URL / NEXT_PUBLIC_APP_URL = URL publik HTTPS
 *   AUTH_SECRET kuat & unik (jangan pakai nilai contoh)
 *   TRACKER_API_KEY kuat jika API PWA dipakai
 *   UPLOAD_PUBLIC_BASE_URL opsional jika file dilayani dari CDN/domain lain
 */

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`[env] ${name} wajib diisi. Lihat .env.example.`);
  }
  return value.trim();
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret?.trim()) {
    if (isProduction()) {
      throw new Error(
        "[env] AUTH_SECRET / NEXTAUTH_SECRET wajib di production. Session auth tidak boleh jalan tanpa secret."
      );
    }
    console.warn(
      "[env] AUTH_SECRET belum di-set — memakai secret dev (jangan pakai di production)."
    );
    return "dev-only-insecure-secret";
  }
  if (isProduction() && secret.trim().length < 32) {
    console.warn(
      "[env] AUTH_SECRET terlalu pendek — gunakan minimal ~32 karakter acak (openssl rand -base64 32)."
    );
  }
  return secret.trim();
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Base URL publik untuk file upload (tanpa trailing slash). Kosong = relative `/uploads/...`. */
export function getUploadPublicBaseUrl() {
  const base = process.env.UPLOAD_PUBLIC_BASE_URL?.trim() || getAppUrl();
  // Di local, relative path cukup; di production bisa absolute agar foto track tidak putus.
  if (!isProduction()) return "";
  return base.replace(/\/$/, "");
}

export function buildUploadPublicUrl(filename: string) {
  const base = getUploadPublicBaseUrl();
  const path = `/uploads/${filename}`;
  return base ? `${base}${path}` : path;
}

export function assertServerEnv() {
  required("DATABASE_URL", process.env.DATABASE_URL);
  if (isProduction()) {
    getAuthSecret();
    const appUrl = getAppUrl();
    if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL / NEXTAUTH_URL masih mengarah ke localhost di production."
      );
    }
  }
}

/** Rate limit tunables (bisa di-override via env). */
export function getTrackRateLimitConfig() {
  return {
    /** Max request /api/track per IP per window */
    ipLimit: Number(process.env.TRACK_RATE_LIMIT_IP ?? 60),
    ipWindowMs: Number(process.env.TRACK_RATE_LIMIT_IP_WINDOW_MS ?? 60_000),
    /** Max gagal verifikasi telepon per IP+code */
    phoneFailLimit: Number(process.env.TRACK_RATE_LIMIT_PHONE_FAIL ?? 8),
    phoneFailWindowMs: Number(process.env.TRACK_RATE_LIMIT_PHONE_WINDOW_MS ?? 15 * 60_000),
  };
}
