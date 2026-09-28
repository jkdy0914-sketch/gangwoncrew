import crypto from "node:crypto";

// 데모 전용 고정 서명 키. QR 캡처 재사용을 "보여주기용"으로 막는 용도라 단순하게 유지한다.
// 실서비스로 전환할 때는 이 값 대신 APP_SECRET(.env.local)을 사용하도록 바꾼다.
const DEMO_SECRET = "gangwon-crew-demo-secret-2026";
const BUCKET_MS = 30_000;
// 이름 입력·동의에 시간이 걸려도 출근/퇴근이 실패하지 않도록 최근 5분(10버킷)까지 허용한다.
const ACCEPT_BUCKETS = 10;

function bucketOf(nowMs: number): number {
  return Math.floor(nowMs / BUCKET_MS);
}

function sign(eventId: string, bucket: number): string {
  return crypto.createHmac("sha256", DEMO_SECRET).update(`${eventId}:${bucket}`).digest("base64url").slice(0, 12);
}

/** QR 화면에 표시할 현재 토큰 발급 */
export function issueToken(eventId: string, nowMs = Date.now()): string {
  const bucket = bucketOf(nowMs);
  return `${bucket}.${sign(eventId, bucket)}`;
}

/** 크루가 스캔해 가져온 토큰이 유효한지 서버에서 검증 */
export function verifyToken(eventId: string, token: string | null | undefined, nowMs = Date.now()): boolean {
  if (!token) return false;
  const [bucketStr, sig] = token.split(".");
  const bucket = Number(bucketStr);
  if (!Number.isInteger(bucket) || !sig) return false;
  const age = bucketOf(nowMs) - bucket;
  if (age < 0 || age > ACCEPT_BUCKETS) return false;
  return sig === sign(eventId, bucket);
}

/** QR 화면 카운트다운용: 지금 버킷이 끝날 때까지 남은 초 */
export function secondsLeftInBucket(nowMs = Date.now()): number {
  return 30 - Math.floor((nowMs % BUCKET_MS) / 1000);
}
