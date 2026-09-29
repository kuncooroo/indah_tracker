import Link from "next/link";

export default function AdminHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Alur kerja</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Generate tracking → apply WBS → update progress → kirim link customer.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">1. Generate tracking</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            Buka{" "}
            <Link href="/admin/shipments/new" className="font-medium text-brand-blue hover:underline">
              Shipments → Generate tracking
            </Link>
          </li>
          <li>Isi customer / PO / telepon (4 digit terakhir untuk verifikasi publik)</li>
          <li>Opsional: External Order ID jika sinkron dari ERP</li>
        </ol>
        <p className="text-xs text-neutral-500">
          API: <code className="rounded bg-neutral-100 px-1">POST /api/v1/shipments</code> dengan{" "}
          <code className="rounded bg-neutral-100 px-1">x-api-key</code>. Detail di{" "}
          <code className="rounded bg-neutral-100 px-1">docs/WORKFLOW.md</code>.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">2. Apply template WBS</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            Pastikan template aktif di{" "}
            <Link href="/admin/wbs-templates" className="font-medium text-brand-blue hover:underline">
              Template WBS
            </Link>
          </li>
          <li>Buka shipment → Update progress → Apply template</li>
          <li>Atau kirim <code className="rounded bg-neutral-100 px-1">applyTemplateId</code> saat create API</li>
        </ol>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">3. Update progress</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Desktop: detail shipment → progress + foto</li>
          <li>
            HP lapangan:{" "}
            <Link href="/admin/workshop" className="font-medium text-brand-blue hover:underline">
              Workshop PWA
            </Link>
          </li>
          <li>Progress % dari bobot WBS; status shipment bisa disarankan otomatis</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">4. Kirim link ke customer</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>Dari detail shipment: salin track URL atau WhatsApp</li>
          <li>
            Customer buka <code className="rounded bg-neutral-100 px-1">/track?code=…&amp;phone=…</code>
          </li>
          <li>Toggle bahasa ID / EN di header track</li>
        </ol>
      </section>

      <section className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">Monitoring</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Health: <code className="rounded bg-white px-1">GET /api/health</code>
          </li>
          <li>
            Error: set <code className="rounded bg-white px-1">SENTRY_DSN</code> (opsional)
          </li>
          <li>
            Backup: <code className="rounded bg-white px-1">npm run db:backup</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
