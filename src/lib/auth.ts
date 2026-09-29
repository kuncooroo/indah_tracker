import type { Session } from "next-auth";
import type { AdminRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { getAuthSecret, isProduction } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // 8 jam — cukup untuk shift lapangan, kurangi risiko session panjang
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin || !admin.active) return null;

        const ok = await bcrypt.compare(password, admin.password);
        if (!ok) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      // Refresh role/active dari DB saat update session atau tiap request JWT revalidate
      if (token.id && (trigger === "update" || !token.role)) {
        const fresh = await prisma.admin.findUnique({
          where: { id: String(token.id) },
          select: { role: true, active: true, name: true, email: true },
        });
        if (!fresh || !fresh.active) {
          token.role = undefined;
          token.id = undefined;
        } else {
          token.role = fresh.role;
          token.name = fresh.name;
          token.email = fresh.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: getAuthSecret(),
  useSecureCookies: isProduction(),
};

export async function getAdminSession() {
  return getServerSession(authOptions);
}

export function sessionRole(session: Session | null): AdminRole | null {
  const role = session?.user?.role;
  if (role === "SUPERADMIN" || role === "ADMIN") return role;
  return null;
}

export function isSuperAdmin(session: Session | null) {
  return sessionRole(session) === "SUPERADMIN";
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Re-check active + role di DB untuk aksi server (hindari JWT usang setelah revoke)
  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, active: true, name: true, email: true },
  });
  if (!admin || !admin.active) throw new Error("Unauthorized");

  session.user.role = admin.role;
  session.user.name = admin.name;
  session.user.email = admin.email;
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAdmin();
  if (!isSuperAdmin(session)) throw new Error("Forbidden");
  return session;
}

export async function requireRole(roles: AdminRole[]) {
  const session = await requireAdmin();
  const role = sessionRole(session);
  if (!role || !roles.includes(role)) throw new Error("Forbidden");
  return session;
}
