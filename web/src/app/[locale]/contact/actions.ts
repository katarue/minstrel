"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContact(formData: FormData): Promise<ContactResult> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const type = (formData.get("type") as string | null) ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!name || !email || !type || !message) {
    return { ok: false, error: "Please fill in all fields." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email address." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.from("contact_requests").insert({ name, email, type, message });
  if (error) {
    console.error("[contact] supabase error:", error);
    return { ok: false, error: "Failed to send. Please try again later." };
  }

  return { ok: true };
}
