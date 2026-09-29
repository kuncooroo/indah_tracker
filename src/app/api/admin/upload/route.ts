import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getAdminSession } from "@/lib/auth";
import { buildUploadPublicUrl } from "@/lib/env";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Format harus JPEG, PNG, WebP, GIF, atau SVG" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maksimal 5 MB" }, { status: 400 });
  }

  const uploadRoot =
    process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadRoot, { recursive: true });

  const raw = Buffer.from(await file.arrayBuffer());

  // SVG: simpan apa adanya. Raster: rotate EXIF, resize max 1600px, WebP.
  if (file.type === "image/svg+xml") {
    const filename = `${randomUUID()}.svg`;
    await writeFile(path.join(uploadRoot, filename), raw);
    return NextResponse.json({ url: buildUploadPublicUrl(filename) });
  }

  try {
    const optimized = await sharp(raw)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    const filename = `${randomUUID()}.webp`;
    await writeFile(path.join(uploadRoot, filename), optimized);
    return NextResponse.json({ url: buildUploadPublicUrl(filename) });
  } catch {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
    const filename = `${randomUUID()}.${safeExt}`;
    await writeFile(path.join(uploadRoot, filename), raw);
    return NextResponse.json({ url: buildUploadPublicUrl(filename) });
  }
}
