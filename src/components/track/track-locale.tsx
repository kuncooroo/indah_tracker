"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getTrackDict,
  LOCALE_COOKIE,
  parseTrackLocale,
  type TrackLocale,
} from "@/lib/track-i18n";
import { cn } from "@/lib/utils";

function readStoredLocale(): TrackLocale {
  if (typeof window === "undefined") return "id";
  const fromCookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  if (fromCookie === "en" || fromCookie === "id") return fromCookie;
  try {
    const ls = localStorage.getItem(LOCALE_COOKIE);
    if (ls === "en" || ls === "id") return ls;
  } catch {
    /* ignore */
  }
  return "id";
}

export function useTrackLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlLang = parseTrackLocale(searchParams.get("lang"));
  const [locale, setLocaleState] = useState<TrackLocale>(urlLang);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    const next = searchParams.get("lang") ? urlLang : stored;
    setLocaleState(next);
    setReady(true);
    document.documentElement.lang = next;
  }, [searchParams, urlLang]);

  function setLocale(next: TrackLocale) {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(LOCALE_COOKIE, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { locale, setLocale, t: getTrackDict(locale), ready };
}

export function TrackLocaleToggle({
  locale,
  onChange,
}: {
  locale: TrackLocale;
  onChange: (l: TrackLocale) => void;
}) {
  const t = getTrackDict(locale);
  return (
    <div
      className="inline-flex rounded-lg border border-white/30 bg-white/10 p-0.5 text-xs font-semibold"
      role="group"
      aria-label="Language"
    >
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={cn(
            "rounded-md px-2.5 py-1 transition",
            locale === l ? "bg-white text-brand-blue" : "text-white/90 hover:bg-white/10"
          )}
        >
          {l === "id" ? t.langId : t.langEn}
        </button>
      ))}
    </div>
  );
}
