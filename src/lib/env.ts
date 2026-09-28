import "server-only";

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "ADMIN_PASSWORD",
  "APP_SECRET",
] as const;

type EnvName = (typeof REQUIRED)[number];

/** 비어 있는 환경변수 이름 목록 (값은 절대 노출하지 않음) */
export function missingEnv(): EnvName[] {
  return REQUIRED.filter((k) => !process.env[k]?.trim());
}

export function env(name: EnvName): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`환경변수 ${name} 이(가) 비어 있습니다. .env.local 을 확인하세요.`);
  return v;
}
