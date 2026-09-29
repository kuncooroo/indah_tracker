import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackClient } from "@/components/track/track-client";
import { getAppUrl } from "@/lib/env";
import { parseTrackLocale } from "@/lib/track-i18n";

type PageProps = {
  searchParams: Promise<{ code?: string; phone?: string; lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const code = (sp.code ?? "").trim().toUpperCase();
  const lang = parseTrackLocale(sp.lang);
  const base = getAppUrl();
  const title = code
    ? lang === "en"
      ? `Track ${code}`
      : `Lacak ${code}`
    : lang === "en"
      ? "Trace & Track"
      : "Trace & Track";
  const description =
    lang === "en"
      ? "Track Indah Mesin order progress securely."
      : "Lacak progress pesanan mesin Indah Mesin secara aman.";

  const ogParams = new URLSearchParams();
  if (code) ogParams.set("code", code);
  ogParams.set("lang", lang);
  const ogImage = `${base}/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: code ? `${base}/track?code=${encodeURIComponent(code)}` : `${base}/track`,
      siteName: "Indah Tracker",
      locale: lang === "en" ? "en_GB" : "id_ID",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TrackPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const lang = parseTrackLocale(sp.lang);
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-neutral-500">
          {lang === "en" ? "Loading…" : "Memuat…"}
        </div>
      }
    >
      <TrackClient />
    </Suspense>
  );
}
