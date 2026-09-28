import "server-only";
import type { Attendance, RosterEntry, Store } from "./store";

export type Row = {
  name: string;
  phoneLast4: string;
  inRoster: boolean;
  status: "checked_in" | "checked_out" | "no_show";
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  sharedDevice: boolean; // 다른 사람과 같은 기기로 출근한 경우
};

export type DashboardData = {
  event: Store["event"];
  counts: { total: number; checkedIn: number; checkedOut: number; notCheckedIn: number };
  rows: Row[];
};

export function buildDashboard(store: Store): DashboardData {
  const { attendances, roster, event } = store;

  const deviceCounts = new Map<string, Set<string>>(); // deviceId -> 그 기기로 기록된 사람(이름+뒷자리) 집합
  for (const a of attendances) {
    if (!a.deviceId) continue;
    const key = `${a.name}_${a.phoneLast4}`;
    if (!deviceCounts.has(a.deviceId)) deviceCounts.set(a.deviceId, new Set());
    deviceCounts.get(a.deviceId)!.add(key);
  }
  const isShared = (a: Attendance) => !!a.deviceId && (deviceCounts.get(a.deviceId)?.size ?? 0) > 1;

  const rosterRows: Row[] = roster.map((r: RosterEntry) => {
    const a = attendances.find((x) => x.rosterId === r.id);
    if (!a) {
      return {
        name: r.name,
        phoneLast4: r.phoneLast4,
        inRoster: true,
        status: "no_show",
        checkInAt: null,
        checkOutAt: null,
        workMinutes: null,
        sharedDevice: false,
      };
    }
    return toRow(a, true, isShared(a));
  });

  const walkInRows: Row[] = attendances.filter((a) => a.rosterId === null).map((a) => toRow(a, false, isShared(a)));

  const rows = [...rosterRows, ...walkInRows];
  const counts = {
    total: rows.length,
    checkedIn: rows.filter((r) => r.status === "checked_in").length,
    checkedOut: rows.filter((r) => r.status === "checked_out").length,
    notCheckedIn: rows.filter((r) => r.status === "no_show").length,
  };

  return { event, counts, rows };
}

function toRow(a: Attendance, inRoster: boolean, sharedDevice: boolean): Row {
  const workMinutes = a.checkOutAt
    ? Math.round((new Date(a.checkOutAt).getTime() - new Date(a.checkInAt).getTime()) / 60000)
    : null;
  return {
    name: a.name,
    phoneLast4: a.phoneLast4,
    inRoster,
    status: a.checkOutAt ? "checked_out" : "checked_in",
    checkInAt: a.checkInAt,
    checkOutAt: a.checkOutAt,
    workMinutes,
    sharedDevice,
  };
}
