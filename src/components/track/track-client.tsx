"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageSearch, Phone, ChevronRight, ChevronDown } from "lucide-react";
import { formatDateId, cn } from "@/lib/utils";

type Photo = { id: string; url: string; caption: string | null };
type Child = {
  id: string;
  title: string;
  status: string;
  weightPercent: number;
  estimatedHours: number | null;
  actualHours: number | null;
  completedAt: string | null;
  note: string | null;
  photos: Photo[];
};
type Parent = {
  id: string;
  title: string;
  status: string;
  weightPercent: number;
  estimatedDays: number | null;
  children: Child[];
};
type TrackData = {
  trackingNumber: string;
  orderNumber: string | null;
  customerName: string | null;
  companyName: string | null;
  status: string;
  statusLabel: string;
  progressPercent: number;
  note: string | null;
  estimatedDays: number | null;
  estimatedEndDate: string | null;
  parents: Parent[];
};

function statusMeta(status: string) {
  if (status === "COMPLETED") return { label: "Selesai", className: "bg-emerald-50 text-emerald-700" };
  if (status === "IN_PROGRESS") return { label: "Dikerjakan", className: "bg-amber-50 text-amber-800" };
  return { label: "Belum", className: "bg-neutral-100 text-neutral-600" };
}

function parentPct(parent: Parent) {
  if (parent.children.length === 0) {
    return parent.status === "COMPLETED" ? 100 : parent.status === "IN_PROGRESS" ? 50 : 0;
  }
  const done = parent.children.filter((c) => c.status === "COMPLETED").length;
  return Math.round((done / parent.children.length) * 100);
}

export function TrackClient() {
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get("code") ?? "").toUpperCase();
  const initialPhone = (searchParams.get("phone") ?? searchParams.get("phoneLast4") ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);

  const [code, setCode] = useState(initialCode);
  const [phoneLast4, setPhoneLast4] = useState(initialPhone);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [data, setData] = useState<TrackData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const autoTried = useRef(false);

  const endLabel = useMemo(() => {
    if (!data?.estimatedEndDate) return null;
    return new Date(data.estimatedEndDate).toLocaleDateString("id-ID");
  }, [data]);

  async function lookup(nextCode: string, nextPhone: string) {
    const trimmedCode = nextCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Nomor tracking wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    const params = new URLSearchParams({ code: trimmedCode });
    if (nextPhone.trim()) params.set("phoneLast4", nextPhone.trim());

    try {
      const res = await fetch(`/api/track?${params.toString()}`);
      const json = await res.json();

      if (json.needsPhone) {
        setNeedsPhone(true);
        setData(null);
        setInfo(
          json.message ??
            "Nomor tracking ditemukan. Masukkan 4 digit terakhir nomor telepon, lalu klik Lacak lagi."
        );
        queueMicrotask(() => phoneInputRef.current?.focus());
        return;
      }
      if (!json.success) {
        setData(null);
        setError(json.message ?? "Tidak ditemukan.");
        return;
      }

      const payload = json.data as TrackData;
      setNeedsPhone(false);
      setInfo(null);
      setData(payload);
      setOpenId(payload.parents[0]?.id ?? null);
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoTried.current) return;
    if (!initialCode) return;
    autoTried.current = true;
    void lookup(initialCode, initialPhone);
  }, [initialCode, initialPhone]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void lookup(code, phoneLast4);
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-track-red text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Indah Mesin
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Trace &amp; Track</h1>
          </div>
          <PackageSearch className="h-8 w-8 text-white/90" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            Masukkan nomor tracking dan 4 digit terakhir nomor telepon yang terdaftar pada PO.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Nomor tracking
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="IM-TRK-20260926-0001"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-track-red focus:ring-2 focus:ring-track-red/20"
                required
              />
            </div>
            <div>
              <label
                htmlFor="phoneLast4"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-800"
              >
                <Phone className="h-4 w-4 text-track-red" />
                4 digit terakhir nomor telepon
              </label>
              <input
                ref={phoneInputRef}
                id="phoneLast4"
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Contoh: 7890"
                maxLength={4}
                inputMode="numeric"
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2",
                  needsPhone
                    ? "border-track-red focus:border-track-red focus:ring-track-red/20"
                    : "border-neutral-300 focus:border-track-red focus:ring-track-red/20"
                )}
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Wajib diisi untuk verifikasi. Seed demo memakai telepon berakhiran 7890
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-track-red px-4 py-3 text-sm font-semibold text-white transition hover:bg-track-red-dark disabled:opacity-60"
            >
              {loading ? "Mencari…" : "Lacak sekarang"}
            </button>
          </form>
          {info ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {info}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg bg-track-red-soft px-3 py-2 text-sm text-track-red-dark">
              {error}
            </p>
          ) : null}
        </section>

        {data ? (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-track-red-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-track-red">
                    Nomor tracking
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-neutral-900">
                    {data.trackingNumber}
                  </p>
                  {data.orderNumber ? (
                    <p className="mt-1 text-sm text-neutral-600">PO: {data.orderNumber}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-neutral-600">
                    {[data.customerName, data.companyName].filter(Boolean).join(" · ")}
                  </p>
                  {data.estimatedDays ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Estimasi {data.estimatedDays} hari
                      {endLabel ? ` · target ${endLabel}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-track-red px-3 py-1 text-xs font-semibold text-white">
                    {data.statusLabel}
                  </span>
                  <p className="mt-2 text-2xl font-bold text-track-red">{data.progressPercent}%</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-track-red transition-all"
                  style={{ width: `${data.progressPercent}%` }}
                />
              </div>
            </div>

            {data.parents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
                Tim produksi belum menerapkan template WBS untuk tracking ini.
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Rincian pengerjaan
                </h2>
                {data.parents.map((parent) => {
                  const open = openId === parent.id;
                  const pct = parentPct(parent);
                  const meta = statusMeta(parent.status);
                  return (
                    <div
                      key={parent.id}
                      className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-4 text-left"
                        onClick={() => setOpenId(open ? null : parent.id)}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-neutral-900">{parent.title}</p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                meta.className
                              )}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-track-red/80"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-neutral-500">
                            {pct}% fase · bobot {parent.weightPercent}%
                          </p>
                        </div>
                      </button>

                      {open ? (
                        <ul className="divide-y divide-neutral-50 border-t border-neutral-100">
                          {parent.children.map((child) => {
                            const cm = statusMeta(child.status);
                            return (
                              <li key={child.id} className="px-4 py-3 pl-11">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium text-neutral-800">{child.title}</p>
                                    <p className="mt-0.5 text-xs text-neutral-500">
                                      {child.estimatedHours ?? 8} jam estimasi
                                      {child.actualHours != null
                                        ? ` · ${child.actualHours} jam aktual`
                                        : ""}
                                      {child.completedAt
                                        ? ` · selesai ${formatDateId(child.completedAt)}`
                                        : ""}
                                    </p>
                                    {child.note ? (
                                      <p className="mt-1 text-xs text-neutral-600">{child.note}</p>
                                    ) : null}
                                  </div>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                      cm.className
                                    )}
                                  >
                                    {cm.label}
                                  </span>
                                </div>
                                {child.photos.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {child.photos.map((ph) => (
                                      <button
                                        key={ph.id}
                                        type="button"
                                        onClick={() => setLightbox(ph.url)}
                                        className="overflow-hidden rounded-lg border border-neutral-100"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={ph.url}
                                          alt={ph.caption ?? child.title}
                                          className="h-16 w-16 object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </main>

      <footer className="mt-auto border-t border-neutral-100 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-neutral-500">
          <p className="font-medium text-neutral-700">Kontak Kami</p>
          <p className="mt-1">Butuh bantuan tracking? Hubungi tim Indah Mesin.</p>
        </div>
      </footer>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Dokumentasi" className="max-h-[90vh] max-w-full rounded-lg" />
        </button>
      ) : null}
    </div>
  );
}
