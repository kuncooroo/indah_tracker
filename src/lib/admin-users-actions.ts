"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import type { AdminRole } from "@prisma/client";
import { fail, ok, runAdminAction, type ActionResult } from "@/lib/action-result";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function revalidateUsers() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
}

function requireTrimmed(
  raw: FormDataEntryValue | null,
  field: string,
  label: string,
  opts: { min?: number; max?: number } = {}
): { ok: true; value: string } | { ok: false; result: ActionResult } {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { ok: false, result: fail(`${label} wajib diisi.`, { fieldErrors: { [field]: "Wajib" } }) };
  }
  if (opts.min && value.length < opts.min) {
    return { ok: false, result: fail(`${label} minimal ${opts.min} karakter.`) };
  }
  if (opts.max && value.length > opts.max) {
    return { ok: false, result: fail(`${label} maksimal ${opts.max} karakter.`) };
  }
  return { ok: true, value };
}

function parseRole(raw: FormDataEntryValue | null): AdminRole {
  return String(raw) === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";
}

export async function createAdminUser(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    await requireSuperAdmin();
    const name = requireTrimmed(formData.get("name"), "name", "Nama", { min: 2, max: 120 });
    if (!name.ok) return name.result;
    const emailRaw = requireTrimmed(formData.get("email"), "email", "Email", { min: 5, max: 190 });
    if (!emailRaw.ok) return emailRaw.result;
    const email = emailRaw.value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Format email tidak valid.");
    }
    const password = requireTrimmed(formData.get("password"), "password", "Password", {
      min: 8,
      max: 128,
    });
    if (!password.ok) return password.result;

    const exists = await prisma.admin.findUnique({ where: { email } });
    if (exists) return fail("Email sudah terdaftar.");

    const hash = await bcrypt.hash(password.value, 12);
    await prisma.admin.create({
      data: {
        name: name.value,
        email,
        password: hash,
        role: parseRole(formData.get("role")),
        active: true,
      },
    });

    revalidateUsers();
    return ok("Admin dibuat.");
  }, "Admin dibuat.");
}

export async function updateAdminUser(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireSuperAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("ID tidak valid.");

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) return fail("Admin tidak ditemukan.");

    const name = requireTrimmed(formData.get("name"), "name", "Nama", { min: 2, max: 120 });
    if (!name.ok) return name.result;
    const emailRaw = requireTrimmed(formData.get("email"), "email", "Email", { min: 5, max: 190 });
    if (!emailRaw.ok) return emailRaw.result;
    const email = emailRaw.value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Format email tidak valid.");
    }

    const clash = await prisma.admin.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) return fail("Email sudah dipakai admin lain.");

    const nextRole = parseRole(formData.get("role"));
    if (existing.role === "SUPERADMIN" && nextRole !== "SUPERADMIN") {
      const supers = await prisma.admin.count({
        where: { role: "SUPERADMIN", active: true },
      });
      if (supers <= 1) {
        return fail("Tidak bisa menurunkan role — ini SUPERADMIN aktif terakhir.");
      }
    }

    const passwordRaw = String(formData.get("password") ?? "");
    const data: {
      name: string;
      email: string;
      role: AdminRole;
      password?: string;
    } = {
      name: name.value,
      email,
      role: nextRole,
    };
    if (passwordRaw.trim()) {
      if (passwordRaw.trim().length < 8) {
        return fail("Password baru minimal 8 karakter.");
      }
      data.password = await bcrypt.hash(passwordRaw.trim(), 12);
    }

    await prisma.admin.update({ where: { id }, data });
    revalidateUsers();
    return ok(
      session.user?.id === id ? "Profil diperbarui (login ulang jika role berubah)." : "Admin diperbarui."
    );
  }, "Admin diperbarui.");
}

export async function setAdminActive(id: string, active: boolean): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireSuperAdmin();
    if (session.user?.id === id && !active) {
      return fail("Tidak bisa menonaktifkan akun sendiri.");
    }
    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) return fail("Admin tidak ditemukan.");

    if (existing.role === "SUPERADMIN" && existing.active && !active) {
      const supers = await prisma.admin.count({
        where: { role: "SUPERADMIN", active: true },
      });
      if (supers <= 1) {
        return fail("Tidak bisa menonaktifkan SUPERADMIN aktif terakhir.");
      }
    }

    await prisma.admin.update({ where: { id }, data: { active } });
    revalidateUsers();
    return ok(active ? "Admin diaktifkan." : "Admin dinonaktifkan.");
  }, "Status admin diperbarui.");
}

export async function deleteAdminUser(id: string): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireSuperAdmin();
    if (session.user?.id === id) return fail("Tidak bisa menghapus akun sendiri.");

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) return fail("Admin tidak ditemukan.");

    if (existing.role === "SUPERADMIN") {
      const supers = await prisma.admin.count({
        where: { role: "SUPERADMIN", active: true },
      });
      if (supers <= 1 && existing.active) {
        return fail("Tidak bisa menghapus SUPERADMIN aktif terakhir.");
      }
    }

    await prisma.admin.delete({ where: { id } });
    revalidateUsers();
    return ok("Admin dihapus.");
  }, "Admin dihapus.");
}

/** Ganti password sendiri (ADMIN & SUPERADMIN). */
export async function changeOwnPassword(formData: FormData): Promise<ActionResult> {
  return runAdminAction(async () => {
    const session = await requireAdmin();
    const id = session.user?.id;
    if (!id) return fail("Unauthorized");

    const current = String(formData.get("currentPassword") ?? "");
    const next = String(formData.get("newPassword") ?? "").trim();
    if (!current || next.length < 8) {
      return fail("Password baru minimal 8 karakter.");
    }

    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) return fail("Admin tidak ditemukan.");
    const okPw = await bcrypt.compare(current, admin.password);
    if (!okPw) return fail("Password saat ini salah.");

    await prisma.admin.update({
      where: { id },
      data: { password: await bcrypt.hash(next, 12) },
    });
    return ok("Password diganti.");
  }, "Password diganti.");
}
