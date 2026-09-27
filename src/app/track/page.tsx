import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackClient } from "@/components/track/track-client";

export const metadata: Metadata = {
  title: "Trace & Track",
};

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-neutral-500">Memuat…</div>}>
      <TrackClient />
    </Suspense>
  );
}
