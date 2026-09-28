import { missingEnv } from "@/lib/env";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 연결 상태 점검용: 키 값은 절대 응답에 넣지 않고, 비어 있는 항목 "이름"만 알려준다.
export async function GET() {
  const missing = missingEnv();
  if (missing.length > 0) {
    return Response.json({ ok: false, step: "env", message: ".env.local 에 비어 있는 값이 있습니다.", missing }, { status: 500 });
  }

  const tables = ["events", "roster", "attendances", "used_tickets", "admin_login_attempts", "attendance_stats"];
  const results: Record<string, string> = {};
  for (const t of tables) {
    const { error } = await db().from(t).select("*", { count: "exact", head: true });
    results[t] = error ? `오류: ${error.message}` : "정상";
  }
  const ok = Object.values(results).every((v) => v === "정상");
  return Response.json(
    { ok, step: "db", message: ok ? "Supabase 연결 및 테이블 확인 완료" : "일부 테이블에 접근할 수 없습니다. schema.sql 을 실행했는지 확인하세요.", tables: results },
    { status: ok ? 200 : 500 },
  );
}
