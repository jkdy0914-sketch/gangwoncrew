// 모든 화면·CSV 시각은 한국시간으로 표시한다. (DB는 UTC 저장)
// 서버가 어느 시간대에서 돌든 결과가 같도록 항상 timeZone 을 명시한다.
export const TZ = "Asia/Seoul";

type DateInput = Date | string | number;

function parts(d: DateInput) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(d));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** "09:02" */
export function fmtTime(d: DateInput): string {
  const x = parts(d);
  return `${x.h}:${x.min}`;
}

/** "2026-10-03 09:02" */
export function fmtDateTime(d: DateInput): string {
  const x = parts(d);
  return `${x.y}-${x.m}-${x.d} ${x.h}:${x.min}`;
}

/** 한국 기준 오늘 날짜 "2026-10-03" */
export function todayKST(now: DateInput = Date.now()): string {
  const x = parts(now);
  return `${x.y}-${x.m}-${x.d}`;
}

/** 분 → "8시간 12분" */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}분`;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}
