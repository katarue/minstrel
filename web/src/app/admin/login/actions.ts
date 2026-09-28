"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const validUser = process.env.ADMIN_USERNAME ?? "";
  const validPass = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";

  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");

  if (username !== validUser || password !== validPass) {
    // Brute-force delay on failure
    await new Promise((r) => setTimeout(r, 1000));
    const params = new URLSearchParams({ error: "1" });
    if (next) params.set("next", next);
    redirect(`/admin/login?${params}`);
  }

  const token = await createSessionToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  // Only redirect to /admin/* paths (never external URLs)
  const safeNext =
    next.startsWith("/admin") && !next.startsWith("/admin/login")
      ? next
      : "/admin";
  redirect(safeNext);
}
