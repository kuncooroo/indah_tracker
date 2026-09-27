import Link from "next/link";
import { createShipmentAndRedirect } from "@/lib/admin-actions";

export default function NewShipmentPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/shipments" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Kembali
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
          Generate tracking
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Buat nomor tracking baru. Bagikan nomor ini ke customer.
        </p>
      </div>

      <form
        action={createShipmentAndRedirect}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <Field label="Nomor PO (opsional)" name="orderNumber" placeholder="PO-20260926-001" />
        <Field label="External Order ID" name="externalOrderId" placeholder="UUID dari katalog" />
        <Field label="Nama customer" name="customerName" placeholder="Budi Santoso" />
        <Field label="Perusahaan" name="companyName" placeholder="PT. Contoh" />
        <Field label="Telepon" name="phone" placeholder="081234567890" />
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Catatan</label>
          <textarea
            name="note"
            rows={3}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Generate nomor tracking
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />
    </div>
  );
}
