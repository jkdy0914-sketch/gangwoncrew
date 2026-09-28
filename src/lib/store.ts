import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { todayKST } from "./time";

// =====================================================================
// 데모 모드 데이터 저장소. 프로젝트 폴더의 data.json 파일 하나에 전부 저장한다.
// 나중에 Supabase로 옮길 때는 이 파일(store.ts)의 함수들만 DB 호출로 바꾸면 된다.
// (화면·API 코드는 이 파일의 함수만 호출하므로 다른 곳은 건드릴 필요 없음)
// =====================================================================

export type EventInfo = {
  id: string;
  name: string;
  date: string; // KST 기준 날짜 "2026-10-03"
  venue: string;
  radiusM: number;
  hourlyWage: number;
};

export type RosterEntry = { id: string; name: string; phoneLast4: string };

export type Attendance = {
  id: string;
  rosterId: string | null; // null = 명단 외
  name: string;
  phoneLast4: string;
  deviceId: string | null;
  consentAt: string; // ISO
  checkInAt: string; // ISO
  checkOutAt: string | null; // ISO
};

export type Store = {
  event: EventInfo;
  roster: RosterEntry[];
  attendances: Attendance[];
};

const DATA_PATH = path.join(process.cwd(), "data.json");
const MIN_MINUTES_BEFORE_CHECKOUT = 10;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function seedStore(): Store {
  const date = todayKST();
  const at = (h: number, m: number) => new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`).toISOString();

  const roster: RosterEntry[] = [
    { id: "r1", name: "김하늘", phoneLast4: "1001" },
    { id: "r2", name: "이도윤", phoneLast4: "1002" },
    { id: "r3", name: "박서연", phoneLast4: "1003" },
    { id: "r4", name: "최민준", phoneLast4: "1004" },
    { id: "r5", name: "정유나", phoneLast4: "1005" },
    { id: "r6", name: "강지호", phoneLast4: "1006" },
    { id: "r7", name: "조수아", phoneLast4: "1007" },
    { id: "r8", name: "윤도현", phoneLast4: "1008" },
    { id: "r9", name: "임채원", phoneLast4: "1009" },
    { id: "r10", name: "배시우", phoneLast4: "1010" },
  ];

  const mk = (
    id: string,
    rosterId: string | null,
    name: string,
    phoneLast4: string,
    deviceId: string | null,
    checkInAt: string,
    checkOutAt: string | null,
  ): Attendance => ({ id, rosterId, name, phoneLast4, deviceId, consentAt: checkInAt, checkInAt, checkOutAt });

  const attendances: Attendance[] = [
    mk("a1", "r1", "김하늘", "1001", "device-demo-1", at(9, 0), at(13, 10)), // 퇴근 완료
    mk("a2", "r2", "이도윤", "1002", "device-demo-2", at(9, 5), null),
    mk("a3", "r3", "박서연", "1003", "device-demo-3", at(9, 12), null),
    mk("a4", "r4", "최민준", "1004", "device-demo-shared", at(9, 20), null),
    mk("a5", "r5", "정유나", "1005", null, at(9, 30), null),
    // 명단에 없는 사람이 같은 기기로 최민준과 함께 온 것처럼 → "명단 외" + "동일 기기" 표시 예시
    mk("a6", null, "한지수", "2222", "device-demo-shared", at(9, 25), null),
  ];

  return {
    event: {
      id: "demo",
      name: "2026 춘천 가을축제 (데모)",
      date,
      venue: "춘천 공지천 일원",
      radiusM: 100,
      hourlyWage: 12000,
    },
    roster,
    attendances,
  };
}

async function readRaw(): Promise<Store> {
  try {
    const text = await fs.readFile(DATA_PATH, "utf8");
    return JSON.parse(text) as Store;
  } catch {
    const seeded = seedStore();
    await writeRaw(seeded);
    return seeded;
  }
}

async function writeRaw(store: Store): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

// 같은 프로세스 안에서 파일 읽기·수정·쓰기가 겹치지 않도록 순서를 맞춘다(간단한 동시성 방지).
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readStore(): Promise<Store> {
  return locked(readRaw);
}

export function resetStore(): Promise<Store> {
  return locked(async () => {
    const seeded = seedStore();
    await writeRaw(seeded);
    return seeded;
  });
}

function findAttendance(store: Store, name: string, phoneLast4: string): Attendance | undefined {
  return store.attendances.find((a) => a.name === name && a.phoneLast4 === phoneLast4);
}

export type CheckResult =
  | { ok: true; action: "checkin" | "checkout"; attendance: Attendance }
  | { ok: false; error: string };

/** 출근 또는 퇴근 처리. 기존 기록이 없으면 출근, 있으면 조건을 봐서 퇴근. */
export function checkInOrOut(input: {
  eventId: string;
  name: string;
  phoneLast4: string;
  deviceId: string | null;
}): Promise<CheckResult> {
  return locked(async () => {
    const store = await readRaw();
    if (store.event.id !== input.eventId) return { ok: false, error: "존재하지 않는 행사입니다." };

    const name = input.name.trim();
    const phoneLast4 = input.phoneLast4.trim();
    if (!name) return { ok: false, error: "이름을 입력해주세요." };
    if (!/^\d{4}$/.test(phoneLast4)) return { ok: false, error: "휴대폰 뒷자리 4자리를 입력해주세요." };

    const now = new Date();
    const existing = findAttendance(store, name, phoneLast4);

    if (!existing) {
      const rosterEntry = store.roster.find((r) => r.name === name && r.phoneLast4 === phoneLast4);
      const attendance: Attendance = {
        id: newId("a"),
        rosterId: rosterEntry?.id ?? null,
        name,
        phoneLast4,
        deviceId: input.deviceId,
        consentAt: now.toISOString(),
        checkInAt: now.toISOString(),
        checkOutAt: null,
      };
      store.attendances.push(attendance);
      await writeRaw(store);
      return { ok: true, action: "checkin", attendance };
    }

    if (existing.checkOutAt) {
      return { ok: false, error: "이미 퇴근 처리가 완료되었습니다." };
    }

    const minutesSinceCheckIn = (now.getTime() - new Date(existing.checkInAt).getTime()) / 60000;
    if (minutesSinceCheckIn < MIN_MINUTES_BEFORE_CHECKOUT) {
      const remain = Math.ceil(MIN_MINUTES_BEFORE_CHECKOUT - minutesSinceCheckIn);
      return { ok: false, error: `출근 후 ${MIN_MINUTES_BEFORE_CHECKOUT}분이 지나야 퇴근할 수 있어요. (${remain}분 남음)` };
    }

    existing.checkOutAt = now.toISOString();
    if (input.deviceId) existing.deviceId = existing.deviceId ?? input.deviceId;
    await writeRaw(store);
    return { ok: true, action: "checkout", attendance: existing };
  });
}

export type AttendanceStatus = {
  status: "not_checked_in" | "checked_in" | "checked_out";
  attendance: Attendance | null;
};

export async function getStatus(eventId: string, name: string, phoneLast4: string): Promise<AttendanceStatus> {
  const store = await readStore();
  if (store.event.id !== eventId) return { status: "not_checked_in", attendance: null };
  const existing = findAttendance(store, name.trim(), phoneLast4.trim());
  if (!existing) return { status: "not_checked_in", attendance: null };
  return { status: existing.checkOutAt ? "checked_out" : "checked_in", attendance: existing };
}
