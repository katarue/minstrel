import { createClient } from "@supabase/supabase-js";

// サービスロールキー使用（サーバーサイド専用・クライアントに露出しないこと）
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
