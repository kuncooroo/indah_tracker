import "dotenv/config";
import bcrypt from "bcrypt";
import { access, mkdir } from "fs/promises";
import path from "path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { generateTrackingNumber, phoneLast4 } from "../src/lib/tracking";
import {
  applyWbsTemplateToShipment,
  recalculateShipmentProgress,
} from "../src/lib/shipment-progress";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

/** Foto dokumentasi realistis (retort / fabrikasi / piping cabang / panel / QC / packing). */
const SEED_PHOTOS = [
  {
    file: "doc-retort-fabrikasi.png",
    caption: "Fabrikasi body retort stainless — workshop Indah Mesin",
  },
  {
    file: "doc-welding-rangka.png",
    caption: "Welding rangka & shell retort selesai",
  },
  {
    file: "doc-piping-cabang.png",
    caption: "Instalasi piping & cabang (tee/valve) ke vessel",
  },
  {
    file: "doc-panel-listrik.png",
    caption: "Panel kontrol PLC retort terpasang & wiring",
  },
  {
    file: "doc-qc-retort.png",
    caption: "Hydrostatic / pressure test retort — hasil OK",
  },
  {
    file: "doc-packing-retort.png",
    caption: "Packaging retort siap kirim ke customer",
  },
] as const;

async function resolveSeedPhotos() {
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const urls: string[] = [];
  for (const photo of SEED_PHOTOS) {
    const full = path.join(dir, photo.file);
    try {
      await access(full);
      urls.push(`/uploads/${photo.file}`);
    } catch {
      throw new Error(
        `Foto seed tidak ditemukan: ${full}. Pastikan file PNG dokumentasi ada di public/uploads.`
      );
    }
  }
  return urls;
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@tracker.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const name = process.env.SEED_ADMIN_NAME ?? "Tracker Admin";

  const hash = await bcrypt.hash(password, 10);
  await prisma.admin.upsert({
    where: { email },
    update: { name, password: hash, role: "SUPERADMIN", active: true },
    create: { email, name, password: hash, role: "SUPERADMIN", active: true },
  });
  console.log(`Admin ready: ${email} / ${password}`);

  const photoUrls = await resolveSeedPhotos();
  console.log(`Dokumentasi foto realistis: ${photoUrls.length} file`);

  await prisma.progressPhoto.deleteMany();
  await prisma.progressTask.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.wbsTemplateItem.deleteMany();
  await prisma.wbsTemplate.deleteMany();

  const template = await prisma.wbsTemplate.create({
    data: {
      name: "Produksi Retort Standar",
      description:
        "Template WBS 30 hari untuk retort sterilizer — fabrikasi vessel, piping cabang, electrical, QC, packing.",
      estimatedDays: 30,
      active: true,
    },
  });

  const phases: { title: string; children: { title: string; hours: number }[] }[] = [
    {
      title: "Fabrikasi Vessel Retort",
      children: [
        { title: "Cutting & rolling shell", hours: 8 },
        { title: "Welding rangka body", hours: 8 },
        { title: "Door / cover assembly", hours: 8 },
        { title: "Insulation jacket", hours: 6 },
        { title: "Finishing permukaan stainless", hours: 4 },
      ],
    },
    {
      title: "Piping & Cabang Proses",
      children: [
        { title: "Instalasi pipa utama steam/air", hours: 8 },
        { title: "Cabang tee & mounting valve", hours: 6 },
        { title: "Flange, fitting & gasket", hours: 8 },
        { title: "Pressure test jalur piping", hours: 4 },
        { title: "Labeling jalur proses", hours: 2 },
      ],
    },
    {
      title: "Electrical & Instrument",
      children: [
        { title: "Panel kontrol PLC", hours: 8 },
        { title: "Wiring sensor suhu/tekanan", hours: 8 },
        { title: "Motor, pompa & actuator", hours: 6 },
        { title: "Grounding & safety interlock", hours: 4 },
        { title: "Uji kelistrikan panel", hours: 4 },
      ],
    },
    {
      title: "Testing & QC Retort",
      children: [
        { title: "Hydrostatic / pressure test", hours: 8 },
        { title: "Safety valve & relief check", hours: 4 },
        { title: "Kalibrasi sensor", hours: 6 },
        { title: "Dokumentasi QC & FAT prep", hours: 4 },
        { title: "Final inspection", hours: 8 },
      ],
    },
    {
      title: "Packing & Pengiriman",
      children: [
        { title: "Packaging & crate", hours: 8 },
        { title: "Loading forklift", hours: 4 },
        { title: "Dokumen pengiriman / SJ", hours: 2 },
        { title: "Dispatch ke customer", hours: 4 },
        { title: "Handover di lokasi", hours: 2 },
      ],
    },
  ];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const parent = await prisma.wbsTemplateItem.create({
      data: { templateId: template.id, title: phase.title, sortOrder: i },
    });
    for (let j = 0; j < phase.children.length; j++) {
      const child = phase.children[j];
      await prisma.wbsTemplateItem.create({
        data: {
          templateId: template.id,
          parentId: parent.id,
          title: child.title,
          sortOrder: j,
          estimatedHours: child.hours,
        },
      });
    }
  }
  console.log(`Template WBS: ${template.name}`);

  const phone = "081234567890";
  const trackingNumber = generateTrackingNumber(1);
  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      orderNumber: "PO-RETORT-2026-001",
      customerName: "Budi Santoso",
      companyName: "PT. Sejahtera Pangan Nusantara",
      phone,
      phoneLast4: phoneLast4(phone),
      status: "CREATED",
      progressPercent: 0,
      note: "PO retort sterilizer 1 unit — progress produksi dengan dokumentasi foto workshop.",
    },
  });

  await applyWbsTemplateToShipment(shipment.id, template.id);

  const parents = await prisma.progressTask.findMany({
    where: { shipmentId: shipment.id, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });

  // Mapping foto realistis ke tahap yang sesuai
  const docs: {
    parentIdx: number;
    childIdx: number;
    photo: string;
    caption: string;
    hours: number;
  }[] = [
    {
      parentIdx: 0,
      childIdx: 0,
      photo: photoUrls[0],
      caption: SEED_PHOTOS[0].caption,
      hours: 8,
    },
    {
      parentIdx: 0,
      childIdx: 1,
      photo: photoUrls[1],
      caption: SEED_PHOTOS[1].caption,
      hours: 8,
    },
    {
      parentIdx: 1,
      childIdx: 0,
      photo: photoUrls[2],
      caption: SEED_PHOTOS[2].caption,
      hours: 7,
    },
    {
      parentIdx: 1,
      childIdx: 1,
      photo: photoUrls[2],
      caption: "Cabang piping & valve terpasang ke vessel",
      hours: 6,
    },
    {
      parentIdx: 2,
      childIdx: 0,
      photo: photoUrls[3],
      caption: SEED_PHOTOS[3].caption,
      hours: 8,
    },
    {
      parentIdx: 3,
      childIdx: 0,
      photo: photoUrls[4],
      caption: SEED_PHOTOS[4].caption,
      hours: 6,
    },
    {
      parentIdx: 4,
      childIdx: 0,
      photo: photoUrls[5],
      caption: SEED_PHOTOS[5].caption,
      hours: 5,
    },
  ];

  for (const d of docs) {
    const child = parents[d.parentIdx]?.children[d.childIdx];
    if (!child) continue;
    await prisma.progressTask.update({
      where: { id: child.id },
      data: {
        status: "COMPLETED",
        actualHours: d.hours,
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * (24 - d.parentIdx * 3)),
        note: d.caption,
      },
    });
    await prisma.progressPhoto.create({
      data: { taskId: child.id, url: d.photo, caption: d.caption },
    });
  }

  const inProgress = parents[0]?.children[2];
  if (inProgress) {
    await prisma.progressTask.update({
      where: { id: inProgress.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        note: "Assembly door/cover retort sedang dikerjakan di workshop",
      },
    });
  }

  const progress = await recalculateShipmentProgress(shipment.id);
  console.log(`Sample tracking: ${trackingNumber}`);
  console.log(`Phone last4: ${phoneLast4(phone)}`);
  console.log(`Progress: ${Number(progress)}%`);
  console.log(`PO: PO-RETORT-2026-001 · PT. Sejahtera Pangan Nusantara`);
  console.log(`Public: http://localhost:3001/track?code=${trackingNumber}`);
  console.log(`Admin: http://localhost:3001/admin/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
