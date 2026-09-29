import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAnalyticsPeriod, periodSince, toCsv } from "@/lib/analytics";
import { resolveEndDate } from "@/lib/shipment-links";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = parseAnalyticsPeriod(searchParams.get("period"));
  const since = periodSince(period);
  const format = searchParams.get("format") === "tsv" ? "tsv" : "csv";

  const shipments = await prisma.shipment.findMany({
    where: {
      deletedAt: null,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      wbsTemplate: { select: { name: true, estimatedDays: true } },
      progressTasks: {
        where: { parentId: null },
        select: {
          title: true,
          status: true,
          weightPercent: true,
          children: {
            select: { status: true },
          },
        },
      },
      _count: { select: { progressTasks: true } },
    },
  });

  const header = [
    "trackingNumber",
    "orderNumber",
    "customerName",
    "companyName",
    "phone",
    "status",
    "statusLabel",
    "progressPercent",
    "estimatedDays",
    "estimatedEndDate",
    "resolvedEndDate",
    "createdAt",
    "updatedAt",
    "deliveredAt",
    "actualLeadDays",
    "leadDeltaVsEstimate",
    "wbsTemplate",
    "parentPhases",
    "childTasksTotal",
    "childTasksDone",
    "note",
  ];

  const rows = shipments.map((s) => {
    const end = resolveEndDate(s);
    const actualLead =
      s.deliveredAt != null
        ? Math.max(
            0,
            Math.round(
              (s.deliveredAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : null;
    const delta =
      actualLead != null && s.estimatedDays != null && s.estimatedDays > 0
        ? actualLead - s.estimatedDays
        : null;

    let childTotal = 0;
    let childDone = 0;
    for (const p of s.progressTasks) {
      if (p.children.length === 0) {
        childTotal += 1;
        if (p.status === "COMPLETED") childDone += 1;
      } else {
        childTotal += p.children.length;
        childDone += p.children.filter((c) => c.status === "COMPLETED").length;
      }
    }

    const iso = (d: Date | null | undefined) =>
      d ? d.toISOString().slice(0, 19).replace("T", " ") : "";

    return [
      s.trackingNumber,
      s.orderNumber ?? "",
      s.customerName ?? "",
      s.companyName ?? "",
      s.phone ?? "",
      s.status,
      SHIPMENT_STATUS_LABEL[s.status] ?? s.status,
      Number(s.progressPercent),
      s.estimatedDays ?? "",
      iso(s.estimatedEndDate),
      iso(end),
      iso(s.createdAt),
      iso(s.updatedAt),
      iso(s.deliveredAt),
      actualLead ?? "",
      delta ?? "",
      s.wbsTemplate?.name ?? "",
      s.progressTasks.length,
      childTotal,
      childDone,
      (s.note ?? "").replace(/\r?\n/g, " "),
    ].map(String);
  });

  const sep = format === "tsv" ? "\t" : ",";
  const body =
    format === "tsv"
      ? [header, ...rows].map((r) => r.join(sep)).join("\r\n")
      : toCsv([header, ...rows]);

  // BOM supaya Excel Windows buka UTF-8 dengan benar
  const bom = "\uFEFF";
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `indah-shipments-${period}-${stamp}.${format === "tsv" ? "xls" : "csv"}`;

  return new NextResponse(bom + body, {
    status: 200,
    headers: {
      "Content-Type":
        format === "tsv"
          ? "application/vnd.ms-excel; charset=utf-8"
          : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
