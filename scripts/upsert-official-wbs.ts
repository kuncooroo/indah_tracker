/**
 * Tambah / perbarui template "WBS Resmi CV Indah Mesin" tanpa menghapus data lain.
 *   npx tsx scripts/upsert-official-wbs.ts
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import {
  OFFICIAL_WBS_TEMPLATE_NAME,
  officialWbsEstimatedDays,
  upsertOfficialWbsTemplate,
} from "../src/lib/official-wbs-template";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  try {
    const result = await upsertOfficialWbsTemplate(prisma);
    console.log(
      `${result}: ${OFFICIAL_WBS_TEMPLATE_NAME} (${officialWbsEstimatedDays()} hari kerja)`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
