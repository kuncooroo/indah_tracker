export type ActionResult = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  trackingNumber?: string;
  id?: string;
};

export function ok(message: string, extra?: Partial<ActionResult>): ActionResult {
  return { success: true, message, ...extra };
}

export function fail(message: string, extra?: Partial<ActionResult>): ActionResult {
  return { success: false, message, ...extra };
}

export async function runAdminAction(
  fn: () => Promise<ActionResult | void>,
  successMessage: string
): Promise<ActionResult> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "success" in result) return result;
    return ok(successMessage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
    if (message === "Unauthorized") return fail("Anda harus login sebagai admin.");
    if (message === "Forbidden") {
      return fail("Akses ditolak — fitur ini hanya untuk SUPERADMIN.");
    }
    return fail(message);
  }
}
