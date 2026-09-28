"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtTime, fmtDuration } from "@/lib/time";

type Row = {
  name: string;
  phoneLast4: string;
  inRoster: boolean;
  status: "checked_in" | "checked_out" | "no_show";
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  sharedDevice: boolean;
};

type Data = {
  event: { name: string; date: string; venue: string };
  counts: { total: number; checkedIn: number; checkedOut: number; notCheckedIn: number };
  rows: Row[];
};

function StatusBadge({ row }: { row: Row }) {
  if (row.status === "no_show") return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">노쇼 의심</span>;
  if (row.status === "checked_out") return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">퇴근</span>;
  return <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">출근중</span>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/demo/status");
      if (alive && res.ok) setData(await res.json());
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const reset = async () => {
    if (!confirm("데모 데이터를 초기 상태로 되돌릴까요? 지금까지의 출퇴근 기록이 사라집니다.")) return;
    setResetting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    setResetting(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">데모 모드</span>
          <h1 className="mt-2 text-2xl font-bold text-navy">{data?.event.name ?? "불러오는 중…"}</h1>
          <p className="text-sm text-slate-500">
            {data?.event.date} · {data?.event.venue}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/qr" className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white">
            QR 화면 열기
          </Link>
          <a href="/api/demo/export" className="rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand">
            CSV 다운로드
          </a>
          <button onClick={reset} disabled={resetting} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 disabled:opacity-50">
            데모 데이터 초기화
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <Tile label="전체" value={data?.counts.total} />
        <Tile label="출근" value={data?.counts.checkedIn} tone="brand" />
        <Tile label="미출근" value={data?.counts.notCheckedIn} tone="red" />
        <Tile label="퇴근" value={data?.counts.checkedOut} tone="slate" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">뒷자리</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">출근</th>
              <th className="px-3 py-2">퇴근</th>
              <th className="px-3 py-2">근무시간</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={`${r.name}_${r.phoneLast4}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {r.name}
                  {!r.inRoster && <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">명단 외</span>}
                  {r.sharedDevice && <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">동일 기기</span>}
                </td>
                <td className="px-3 py-2 text-slate-500">{r.phoneLast4}</td>
                <td className="px-3 py-2">
                  <StatusBadge row={r} />
                </td>
                <td className="px-3 py-2 text-slate-600">{r.checkInAt ? fmtTime(r.checkInAt) : "-"}</td>
                <td className="px-3 py-2 text-slate-600">{r.checkOutAt ? fmtTime(r.checkOutAt) : "-"}</td>
                <td className="px-3 py-2 text-slate-600">{r.workMinutes != null ? fmtDuration(r.workMinutes) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">3초마다 자동 새로고침됩니다.</p>
    </div>
  );
}

function Tile({ label, value, tone = "navy" }: { label: string; value?: number; tone?: "navy" | "brand" | "red" | "slate" }) {
  const colors = { navy: "text-navy", brand: "text-brand", red: "text-red-600", slate: "text-slate-500" } as const;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
      <p className={`text-3xl font-extrabold ${colors[tone]}`}>{value ?? "-"}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
