import { NextResponse } from "next/server";
import { getTrackRateLimitConfig } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { resolveEndDate } from "@/lib/shipment-links";
import { getSoonDays } from "@/lib/reminder-config";
import { SHIPMENT_STATUS_LABEL } from "@/lib/tracking";
import { daysUntil, getDeadlineReminder } from "@/lib/utils";
import { getPublicActivityFeed } from "@/lib/activity-log";

function normalizePhoneLast4(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-4);
}

function jsonError(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit
) {
  return NextResponse.json(body, { status, headers });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const phoneLast4 = normalizePhoneLast4(
    searchParams.get("phoneLast4") ?? searchParams.get("phone")
  );

  const ip = clientIpFromRequest(request);
  const cfg = getTrackRateLimitConfig();

  const ipLimit = rateLimit(`track:ip:${ip}`, {
    limit: cfg.ipLimit,
    windowMs: cfg.ipWindowMs,
  });
  if (!ipLimit.ok) {
    return jsonError(
      {
        success: false,
        errorCode: "RATE_LIMITED",
        message: "Terlalu banyak permintaan. Coba lagi beberapa saat.",
      },
      429,
      rateLimitHeaders(ipLimit)
    );
  }

  if (!code) {
    return jsonError(
      {
        success: false,
        errorCode: "CODE_REQUIRED",
        message: "Nomor tracking wajib diisi.",
      },
      400,
      rateLimitHeaders(ipLimit)
    );
  }

  if (phoneLast4 != null && phoneLast4.length !== 4) {
    return jsonError(
      {
        success: false,
        needsPhone: true,
        errorCode: "INVALID_PHONE",
        message: "Masukkan tepat 4 digit terakhir nomor telepon.",
      },
      400,
      rateLimitHeaders(ipLimit)
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: code },
    include: {
      progressTasks: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            orderBy: { sortOrder: "asc" },
            include: { photos: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
    },
  });

  if (!shipment || shipment.deletedAt) {
    return jsonError(
      {
        success: false,
        errorCode: "NOT_FOUND",
        message: "Nomor tracking tidak ditemukan. Periksa ulang kode Anda.",
      },
      404,
      rateLimitHeaders(ipLimit)
    );
  }

  if (shipment.phoneLast4) {
    if (!phoneLast4 || phoneLast4 !== shipment.phoneLast4) {
      const phoneFail = rateLimit(`track:phone-fail:${ip}:${code}`, {
        limit: cfg.phoneFailLimit,
        windowMs: cfg.phoneFailWindowMs,
      });
      if (!phoneFail.ok) {
        return jsonError(
          {
            success: false,
            needsPhone: true,
            errorCode: "RATE_LIMITED",
            message:
              "Terlalu banyak percobaan verifikasi telepon. Coba lagi nanti.",
          },
          429,
          rateLimitHeaders(phoneFail)
        );
      }

      const missing = !phoneLast4;
      return jsonError(
        {
          success: false,
          needsPhone: true,
          errorCode: missing ? "PHONE_REQUIRED" : "PHONE_MISMATCH",
          message: missing
            ? "Nomor tracking ditemukan. Masukkan 4 digit terakhir nomor telepon untuk verifikasi."
            : "4 digit telepon tidak cocok. Pastikan memakai nomor yang terdaftar pada PO.",
          remainingAttempts: phoneFail.remaining,
        },
        403,
        rateLimitHeaders(phoneFail)
      );
    }
  }

  // Last activity: shipment.updatedAt atau task child terakhir selesai
  let lastCompletedAt: Date | null = null;
  let lastCompletedTitle: string | null = null;
  for (const parent of shipment.progressTasks) {
    for (const child of parent.children) {
      if (child.completedAt) {
        if (!lastCompletedAt || child.completedAt > lastCompletedAt) {
          lastCompletedAt = child.completedAt;
          lastCompletedTitle = child.title;
        }
      }
    }
    if (parent.completedAt) {
      if (!lastCompletedAt || parent.completedAt > lastCompletedAt) {
        lastCompletedAt = parent.completedAt;
        lastCompletedTitle = parent.title;
      }
    }
  }

  const lastActivityAt =
    lastCompletedAt && lastCompletedAt > shipment.updatedAt
      ? lastCompletedAt
      : shipment.updatedAt;

  const endDate = resolveEndDate({
    estimatedEndDate: shipment.estimatedEndDate,
    estimatedDays: shipment.estimatedDays,
    createdAt: shipment.createdAt,
  });
  const soonDays = await getSoonDays();
  const reminder =
    shipment.status === "DELIVERED" || shipment.status === "CANCELLED"
      ? null
      : getDeadlineReminder(endDate, { soonDays });

  const remainingDays = endDate ? daysUntil(endDate) : null;
  let remainingLabel: string | null = null;
  if (shipment.status === "DELIVERED") {
    remainingLabel = "Pesanan sudah selesai / terkirim";
  } else if (shipment.status === "CANCELLED") {
    remainingLabel = "Pesanan dibatalkan";
  } else if (remainingDays == null) {
    remainingLabel = null;
  } else if (remainingDays < 0) {
    remainingLabel = `Telat ${Math.abs(remainingDays)} hari dari target`;
  } else if (remainingDays === 0) {
    remainingLabel = "Target selesai hari ini";
  } else {
    remainingLabel = `±${remainingDays} hari lagi`;
  }

  const recentUpdates = await getPublicActivityFeed(shipment.id, 8);

  return NextResponse.json(
    {
      success: true,
      data: {
        trackingNumber: shipment.trackingNumber,
        orderNumber: shipment.orderNumber,
        customerName: shipment.customerName,
        companyName: shipment.companyName,
        status: shipment.status,
        statusLabel: SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status,
        progressPercent: Number(shipment.progressPercent),
        note: shipment.note,
        estimatedDays: shipment.estimatedDays,
        estimatedEndDate: shipment.estimatedEndDate,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
        lastActivityAt,
        lastCompletedAt,
        lastCompletedTitle,
        remainingDays,
        remainingLabel,
        reminderKind: reminder?.kind ?? null,
        recentUpdates,
        hasWbs: shipment.progressTasks.length > 0,
        parents: shipment.progressTasks.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          weightPercent: Number(p.weightPercent),
          estimatedDays: p.estimatedDays,
          children: p.children.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            weightPercent: Number(c.weightPercent),
            estimatedHours: c.estimatedHours,
            actualHours: c.actualHours,
            completedAt: c.completedAt,
            note: c.note,
            photos: c.photos.map((ph) => ({
              id: ph.id,
              url: ph.url,
              caption: ph.caption,
            })),
          })),
        })),
      },
    },
    { headers: rateLimitHeaders(ipLimit) }
  );
}
