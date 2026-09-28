import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/** 서버 전용 Supabase 클라이언트 (Secret 키 사용 — 브라우저 코드에서 import 금지) */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
