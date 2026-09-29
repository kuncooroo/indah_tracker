"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PackageSearch,
  Phone,
  ChevronRight,
  ChevronDown,
  Mail,
  Share2,
  Copy,
  Check,
  Clock3,
  ImageIcon,
  AlertCircle,
  SearchX,
  ShieldAlert,
  ClipboardList,
  X,
  CheckCircle2,
  History,
} from "lucide-react";
import { formatDateId, cn } from "@/lib/utils";
import { formatRelativeId, stepperIndex, getTrackStepperSteps } from "@/lib/track-public";
import { TrackLocaleToggle, useTrackLocale } from "@/components/track/track-locale";
import { getTrackDict, type TrackDict, type TrackLocale } from "@/lib/track-i18n";

type Photo = { id: string; url: string; caption: string | null; childTitle?: string };
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
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  lastCompletedAt: string | null;
  lastCompletedTitle: string | null;
  remainingDays: number | null;
  remainingLabel: string | null;
  reminderKind: string | null;
  recentUpdates?: { text: string; at: string; relative: string }[];
  hasWbs: boolean;
  parents: Parent[];
};

type ErrorCode =
  | "NOT_FOUND"
  | "PHONE_REQUIRED"
  | "PHONE_MISMATCH"
  | "INVALID_PHONE"
  | "RATE_LIMITED"
  | "CODE_REQUIRED"
  | "NETWORK"
  | string;

function statusMeta(status: string, t: TrackDict) {
  if (status === "COMPLETED") return { label: t.taskDone, className: "bg-emerald-50 text-emerald-700" };
  if (status === "IN_PROGRESS") return { label: t.taskDoing, className: "bg-amber-50 text-amber-800" };
  return { label: t.taskTodo, className: "bg-neutral-100 text-neutral-600" };
}

function localizeRemaining(
  data: Pick<TrackData, "status" | "reminderKind" | "remainingDays" | "remainingLabel">,
  t: TrackDict
) {
  if (data.status === "DELIVERED") return t.remainingDone;
  if (data.status === "CANCELLED") return t.remainingCancelled;
  if (data.reminderKind === "overdue" && data.remainingDays != null) {
    return t.remainingOverdue(Math.abs(data.remainingDays));
  }
  if (data.remainingDays === 0) return t.remainingToday;
  if (data.remainingDays != null && data.remainingDays > 0) {
    return t.remainingDays(data.remainingDays);
  }
  return data.remainingLabel;
}

function parentPct(parent: Parent) {
  if (parent.children.length === 0) {
    return parent.status === "COMPLETED" ? 100 : parent.status === "IN_PROGRESS" ? 50 : 0;
  }
  const done = parent.children.filter((c) => c.status === "COMPLETED").length;
  return Math.round((done / parent.children.length) * 100);
}

function phasePhotos(parent: Parent): Photo[] {
  const list: Photo[] = [];
  for (const child of parent.children) {
    for (const ph of child.photos) {
      list.push({ ...ph, childTitle: child.title });
    }
  }
  return list;
}

function StatusStepper({ status, locale }: { status: string; locale: TrackLocale }) {
  const t = getTrackStepperSteps(locale);
  const labels = getTrackDict(locale);
  if (status === "CANCELLED") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {labels.cancelled}
      </div>
    );
  }
  const active = stepperIndex(status);
  return (
    <ol className="flex w-full items-start justify-between gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {t.map((step, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              {i > 0 ? (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    i <= active ? "bg-brand-blue" : "bg-neutral-200"
                  )}
                />
              ) : (
                <div className="flex-1" />
              )}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  done || current
                    ? "bg-brand-blue text-white"
                    : "bg-neutral-200 text-neutral-500"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </div>
              {i < t.length - 1 ? (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    i < active ? "bg-brand-blue" : "bg-neutral-200"
                  )}
                />
              ) : (
                <div className="flex-1" />
              )}
            </div>
            <span
              className={cn(
                "max-w-[4.5rem] text-center text-[10px] leading-tight sm:text-[11px]",
                current ? "font-semibold text-brand-blue" : "text-neutral-500"
              )}
            >
              <span className="sm:hidden">{step.short}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FeedbackBanner({
  kind,
  title,
  message,
  hint,
}: {
  kind: "error" | "info" | "warn";
  title: string;
  message: string;
  hint?: string;
}) {
  const Icon =
    kind === "error" ? SearchX : kind === "warn" ? ShieldAlert : AlertCircle;
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-sky-200 bg-sky-50 text-sky-950";
  const iconColor =
    kind === "error" ? "text-red-600" : kind === "warn" ? "text-amber-600" : "text-sky-600";

  return (
    <div className={cn("mt-4 rounded-xl border p-4", styles)}>
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm opacity-90">{message}</p>
          {hint ? <p className="mt-2 text-xs opacity-70">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function feedbackFromCode(
  code: ErrorCode | null,
  message: string | null,
  needsPhone: boolean,
  t: TrackDict
): { kind: "error" | "info" | "warn"; title: string; message: string; hint?: string } | null {
  if (!code && !message && !needsPhone) return null;
  if (code === "NOT_FOUND") {
    return {
      kind: "error",
      title: t.errNotFoundTitle,
      message: message ?? t.errNotFoundMsg,
      hint: t.errNotFoundHint,
    };
  }
  if (code === "PHONE_MISMATCH") {
    return {
      kind: "warn",
      title: t.errPhoneMismatchTitle,
      message: message ?? t.errPhoneMismatchTitle,
      hint: t.errPhoneMismatchHint,
    };
  }
  if (code === "PHONE_REQUIRED" || (needsPhone && !code)) {
    return {
      kind: "info",
      title: t.errPhoneRequiredTitle,
      message: message ?? t.errPhoneRequiredMsg,
      hint: t.errPhoneRequiredHint,
    };
  }
  if (code === "INVALID_PHONE") {
    return {
      kind: "warn",
      title: t.errInvalidPhoneTitle,
      message: message ?? t.errInvalidPhoneMsg,
    };
  }
  if (code === "RATE_LIMITED") {
    return {
      kind: "error",
      title: t.errRateTitle,
      message: message ?? t.errRateMsg,
    };
  }
  if (code === "NETWORK") {
    return {
      kind: "error",
      title: t.errNetworkTitle,
      message: message ?? t.errNetworkMsg,
    };
  }
  if (message) {
    return {
      kind: needsPhone ? "info" : "error",
      title: needsPhone ? t.errNeedVerifyTitle : t.errGenericTitle,
      message,
    };
  }
  return null;
}

export function TrackClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, setLocale, t } = useTrackLocale();
  const urlCode = (searchParams.get("code") ?? "").trim().toUpperCase();
  const urlPhone = (searchParams.get("phone") ?? searchParams.get("phoneLast4") ?? "")
    .replace(/\D/g, "")
    .slice(-4);

  const [code, setCode] = useState(urlCode);
  const [phoneLast4, setPhoneLast4] = useState(urlPhone);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<TrackData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const lookupKeyRef = useRef<string>("");

  const endLabel = useMemo(() => {
    if (!data?.estimatedEndDate) return null;
    return new Date(data.estimatedEndDate).toLocaleDateString(
      locale === "en" ? "en-GB" : "id-ID",
      { day: "numeric", month: "long", year: "numeric" }
    );
  }, [data, locale]);

  const feedback = feedbackFromCode(errorCode, errorMessage, needsPhone, t);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!data) return window.location.href;
    const params = new URLSearchParams({ code: data.trackingNumber });
    if (urlPhone) params.set("phone", urlPhone);
    return `${window.location.origin}${pathname}?${params.toString()}`;
  }, [data, pathname, urlPhone]);

  function syncTrackUrl(nextCode: string, nextPhone: string) {
    const params = new URLSearchParams();
    params.set("code", nextCode);
    if (nextPhone) params.set("phone", nextPhone);
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }

  async function lookup(nextCode: string, nextPhone: string) {
    const trimmedCode = nextCode.trim().toUpperCase();
    const trimmedPhone = nextPhone.replace(/\D/g, "").slice(-4);

    if (!trimmedCode) {
      setErrorCode("CODE_REQUIRED");
      setErrorMessage(t.errCodeRequired);
      return;
    }

    const key = `${trimmedCode}|${trimmedPhone}`;
    lookupKeyRef.current = key;

    setLoading(true);
    setErrorCode(null);
    setErrorMessage(null);

    const params = new URLSearchParams({ code: trimmedCode });
    if (trimmedPhone) params.set("phone", trimmedPhone);

    try {
      const res = await fetch(`/api/track?${params.toString()}`);
      const json = await res.json();
      if (lookupKeyRef.current !== key) return;

      if (json.needsPhone) {
        setNeedsPhone(true);
        setData(null);
        setErrorCode(json.errorCode ?? (trimmedPhone ? "PHONE_MISMATCH" : "PHONE_REQUIRED"));
        setErrorMessage(json.message ?? null);
        queueMicrotask(() => phoneInputRef.current?.focus());
        return;
      }
      if (!json.success) {
        setData(null);
        setNeedsPhone(false);
        setErrorCode(json.errorCode ?? (res.status === 404 ? "NOT_FOUND" : "NETWORK"));
        setErrorMessage(json.message ?? t.errNotFoundShort);
        return;
      }

      const payload = json.data as TrackData;
      setNeedsPhone(false);
      setErrorCode(null);
      setErrorMessage(null);
      setData(payload);
      const firstOpen =
        payload.parents.find((p) => p.status === "IN_PROGRESS")?.id ??
        payload.parents[0]?.id ??
        null;
      setOpenId(firstOpen);
      queueMicrotask(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch {
      if (lookupKeyRef.current !== key) return;
      setErrorCode("NETWORK");
      setErrorMessage(t.errServer);
      setData(null);
    } finally {
      if (lookupKeyRef.current === key) setLoading(false);
    }
  }

  useEffect(() => {
    setCode(urlCode);
    setPhoneLast4(urlPhone);
  }, [urlCode, urlPhone]);

  useEffect(() => {
    if (!urlCode) {
      setData(null);
      setNeedsPhone(false);
      setErrorCode(null);
      setErrorMessage(null);
      return;
    }
    void lookup(urlCode, urlPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, urlPhone]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedPhone = phoneLast4.replace(/\D/g, "").slice(-4);
    if (!trimmedCode) {
      setErrorCode("CODE_REQUIRED");
      setErrorMessage(t.errCodeRequired);
      return;
    }
    syncTrackUrl(trimmedCode, trimmedPhone);
    if (trimmedCode === urlCode && trimmedPhone === urlPhone) {
      void lookup(trimmedCode, trimmedPhone);
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareHint(t.shareHintOk);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareHint(t.shareHintFail);
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title:
            locale === "en"
              ? `Track ${data?.trackingNumber ?? "order"} — Indah Mesin`
              : `Lacak ${data?.trackingNumber ?? "pesanan"} — Indah Mesin`,
          text:
            locale === "en"
              ? `Indah Mesin order progress ${data?.trackingNumber ?? ""}`
              : `Progress pesanan Indah Mesin ${data?.trackingNumber ?? ""}`,
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancel / fallback */
      }
    }
    await copyShareUrl();
  }

  const remainingTone =
    data?.reminderKind === "overdue"
      ? "text-red-700 bg-red-50 border-red-200"
      : data?.reminderKind === "due_soon"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-emerald-800 bg-emerald-50 border-emerald-200";

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f8]">
      <div className="bg-black text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/90">
            <a
              href="mailto:info@indahmesin.com"
              className="inline-flex items-center gap-1.5 transition hover:text-brand-blue"
            >
              <Mail className="h-3 w-3 text-brand-blue" />
              <span className="hidden xs:inline sm:inline">info@indahmesin.com</span>
              <span className="sm:hidden">Email</span>
            </a>
            <a
              href="tel:+623417500445"
              className="inline-flex items-center gap-1.5 transition hover:text-brand-blue"
            >
              <Phone className="h-3 w-3 text-brand-blue" />
              (0341) 7500445
            </a>
          </div>
          <a
            href="https://www.indahmesin.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-white/70 transition hover:text-brand-yellow"
          >
            indahmesin.com
          </a>
        </div>
      </div>

      <header className="bg-brand-dark text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:py-5">
          <div>
            <p className="text-lg font-bold tracking-wide sm:text-xl">
              <span className="text-brand-blue">INDAH</span>{" "}
              <span className="text-brand-yellow">MESIN</span>
            </p>
            <h1 className="mt-0.5 text-base font-semibold tracking-tight text-white/95 sm:text-lg">
              {t.brandTrack}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <TrackLocaleToggle locale={locale} onChange={setLocale} />
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-blue">
              <PackageSearch className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <section className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm leading-relaxed text-neutral-600">{t.formIntro}</p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-neutral-800">
                {t.codeLabel}
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t.codePlaceholder}
                autoComplete="off"
                enterKeyHint="next"
                className="w-full rounded-md border border-neutral-300 px-3 py-3 text-base outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25 sm:py-2.5 sm:text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="phoneLast4"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-800"
              >
                <Phone className="h-4 w-4 text-brand-blue" />
                {t.phoneDigitsLabel}
              </label>
              <input
                ref={phoneInputRef}
                id="phoneLast4"
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(-4))}
                placeholder={t.phoneDigitsPlaceholder}
                maxLength={16}
                inputMode="numeric"
                autoComplete="tel"
                enterKeyHint="search"
                className={cn(
                  "w-full rounded-md border px-3 py-3 text-base outline-none transition focus:ring-2 sm:py-2.5 sm:text-sm",
                  needsPhone
                    ? "border-brand-blue focus:border-brand-blue focus:ring-brand-blue/25"
                    : "border-neutral-300 focus:border-brand-blue focus:ring-brand-blue/25"
                )}
              />
              <p className="mt-1.5 text-xs text-neutral-500">{t.phoneVerifyHint}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full rounded-md bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? t.loading : t.submit}
            </button>
          </form>

          {feedback ? (
            <FeedbackBanner
              kind={feedback.kind}
              title={feedback.title}
              message={feedback.message}
              hint={feedback.hint}
            />
          ) : null}
        </section>

        {data ? (
          <section ref={resultRef} className="mt-6 space-y-4 scroll-mt-4 sm:mt-8 sm:space-y-6">
            {/* Summary card — putih sama seperti status / WBS */}
            <div className="track-summary-card rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {t.trackingNumber}
                  </p>
                  <p className="mt-1 break-all font-mono text-base font-bold text-neutral-900 sm:text-lg">
                    {data.trackingNumber}
                  </p>
                  {data.orderNumber ? (
                    <p className="mt-1 text-sm text-neutral-600">PO: {data.orderNumber}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-neutral-600">
                    {[data.customerName, data.companyName].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-md bg-brand-blue px-3 py-1 text-xs font-semibold text-white">
                    {t.statusShipmentLabels[
                      data.status as keyof typeof t.statusShipmentLabels
                    ] ?? data.statusLabel}
                  </span>
                  <p className="mt-2 text-2xl font-bold text-brand-blue">{data.progressPercent}%</p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-brand-blue transition-all"
                  style={{ width: `${data.progressPercent}%` }}
                />
              </div>

              {/* ETA + last update */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {data.remainingLabel ? (
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      remainingTone
                    )}
                  >
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    {localizeRemaining(data, t)}
                    {endLabel ? ` · ${t.targetPrefix} ${endLabel}` : ""}
                  </div>
                ) : data.estimatedDays ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                    {t.estWorkDays(data.estimatedDays)}
                  </div>
                ) : null}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                  {t.updated} {formatRelativeId(data.lastActivityAt, locale)}
                  {data.lastCompletedTitle
                    ? ` · ${t.done}: ${data.lastCompletedTitle}`
                    : ""}
                </div>
              </div>

              {/* Share */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => void nativeShare()}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white sm:flex-none"
                >
                  <Share2 className="h-4 w-4" />
                  {t.share}
                </button>
                <button
                  type="button"
                  onClick={() => void copyShareUrl()}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 sm:flex-none"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? t.copied : t.copyLink}
                </button>
              </div>
              {shareHint ? (
                <p className="mt-2 text-xs text-neutral-500">{shareHint}</p>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">{t.bookmarkHint}</p>
              )}
            </div>

            {/* Stepper */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t.statusShipment}
              </p>
              <StatusStepper status={data.status} locale={locale} />
            </div>

            {/* Update terbaru (aman — hanya publicText) */}
            {data.recentUpdates && data.recentUpdates.length > 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-brand-blue" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {t.recentUpdates}
                  </p>
                </div>
                <ol className="space-y-3">
                  {data.recentUpdates.map((u, i) => (
                    <li
                      key={`${u.at}-${i}`}
                      className="flex gap-3 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-800">{u.text}</p>
                        <time
                          dateTime={u.at}
                          className="mt-0.5 block text-xs text-neutral-400"
                          title={formatDateId(u.at)}
                        >
                          {formatRelativeId(u.at, locale)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/* WBS / empty */}
            {!data.hasWbs || data.parents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-neutral-300" />
                <p className="mt-3 text-sm font-semibold text-neutral-800">
                  {t.noWbsTitle}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                  {t.noWbsBody}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  {t.workDetail}
                </h2>
                {data.parents.map((parent) => {
                  const open = openId === parent.id;
                  const pct = parentPct(parent);
                  const meta = statusMeta(parent.status, t);
                  const gallery = phasePhotos(parent);
                  return (
                    <div
                      key={parent.id}
                      className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-3.5 text-left active:bg-neutral-50 sm:p-4"
                        onClick={() => setOpenId(open ? null : parent.id)}
                        aria-expanded={open}
                      >
                        {open ? (
                          <ChevronDown className="h-5 w-5 shrink-0 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
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
                            {gallery.length > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-400">
                                <ImageIcon className="h-3 w-3" />
                                {gallery.length}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-brand-blue/85"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-neutral-500">
                            {pct}% {t.phasePct} · {t.weight} {parent.weightPercent}%
                          </p>
                        </div>
                      </button>

                      {open ? (
                        <div className="border-t border-neutral-100">
                          {/* Galeri digabung per fase */}
                          {gallery.length > 0 ? (
                            <div className="border-b border-neutral-50 bg-neutral-50/60 px-3 py-3 sm:px-4">
                              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                {t.phasePhotos}
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {gallery.map((ph, idx) => (
                                  <button
                                    key={ph.id}
                                    type="button"
                                    onClick={() => setLightbox({ photos: gallery, index: idx })}
                                    className="shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={ph.url}
                                      alt={ph.caption ?? ph.childTitle ?? parent.title}
                                      className="h-20 w-20 object-cover sm:h-16 sm:w-16"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <ul className="divide-y divide-neutral-50">
                            {parent.children.length === 0 ? (
                              <li className="px-4 py-3 pl-11 text-sm text-neutral-400">
                                {t.noSubtasks}
                              </li>
                            ) : (
                              parent.children.map((child) => {
                                const cm = statusMeta(child.status, t);
                                return (
                                  <li key={child.id} className="px-3 py-3 sm:px-4 sm:pl-11">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-800">
                                          {child.title}
                                        </p>
                                        <p className="mt-0.5 text-xs text-neutral-500">
                                          {child.estimatedHours ?? 8} {t.hoursEst}
                                          {child.actualHours != null
                                            ? ` · ${child.actualHours} ${t.hoursActual}`
                                            : ""}
                                          {child.completedAt
                                            ? ` · ${t.done} ${formatDateId(child.completedAt)}`
                                            : ""}
                                        </p>
                                        {child.note ? (
                                          <p className="mt-1 text-xs text-neutral-600">{child.note}</p>
                                        ) : null}
                                      </div>
                                      <span
                                        className={cn(
                                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                          cm.className
                                        )}
                                      >
                                        {cm.label}
                                      </span>
                                    </div>
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {data.note ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {t.note}
                </p>
                <p className="mt-1">{data.note}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {!data && !loading && !urlCode && !feedback ? (
          <div className="mt-8 rounded-xl border border-dashed border-neutral-200 bg-white/80 px-4 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-brand-blue/40" />
            <p className="mt-3 text-sm font-medium text-neutral-800">{t.emptyReadyTitle}</p>
            <p className="mt-1 text-sm text-neutral-500">{t.emptyReadyBody}</p>
          </div>
        ) : null}
      </main>

      <footer className="mt-auto bg-brand-charcoal text-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-sm font-bold tracking-wide">
            <span className="text-brand-blue">INDAH</span>{" "}
            <span className="text-brand-yellow">MESIN</span>
          </p>
          <p className="mt-2 text-sm text-white/70">{t.footerTagline}</p>
          <div className="mt-4 space-y-1 text-sm text-white/65">
            <p>
              <a href="mailto:info@indahmesin.com" className="hover:text-brand-blue">
                info@indahmesin.com
              </a>
              {" · "}
              <a href="tel:+6281217576760" className="hover:text-brand-blue">
                0812-1757-6760
              </a>
            </p>
            <p className="text-xs text-white/45">
              {t.contact}
            </p>
          </div>
        </div>
      </footer>

      {/* Lightbox mobile-friendly */}
      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex flex-col bg-black/90"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-3 text-white">
            <p className="min-w-0 truncate text-sm">
              {lightbox.photos[lightbox.index]?.caption ||
                lightbox.photos[lightbox.index]?.childTitle ||
                t.docs}
              <span className="ml-2 text-white/50">
                {lightbox.index + 1}/{lightbox.photos.length}
              </span>
            </p>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
              onClick={() => setLightbox(null)}
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2 pb-6">
            {lightbox.photos.length > 1 ? (
              <button
                type="button"
                className="absolute left-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
                onClick={() =>
                  setLightbox((cur) =>
                    cur
                      ? {
                          ...cur,
                          index: (cur.index - 1 + cur.photos.length) % cur.photos.length,
                        }
                      : cur
                  )
                }
                aria-label="Sebelumnya"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.photos[lightbox.index]?.url}
              alt={t.docs}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
              onClick={() => setLightbox(null)}
            />
            {lightbox.photos.length > 1 ? (
              <button
                type="button"
                className="absolute right-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
                onClick={() =>
                  setLightbox((cur) =>
                    cur
                      ? { ...cur, index: (cur.index + 1) % cur.photos.length }
                      : cur
                  )
                }
                aria-label="Berikutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
