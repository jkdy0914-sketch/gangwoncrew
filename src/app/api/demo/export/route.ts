import { readStore } from "@/lib/store";
import { buildDashboard } from "@/lib/dashboard";
import { fmtDateTime, fmtDuration } from "@/lib/time";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const store = await readStore();
  const { event, rows } = buildDashboard(store);

  const header = ["이름", "휴대폰 뒷자리", "출근", "퇴근", "근무시간", "예상 급여(원)", "명단 여부", "동일 기기 경고"];
  const lines = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const wage = r.workMinutes != null ? Math.round((r.workMinutes / 60) * event.hourlyWage) : "";
    lines.push(
      [
        csvCell(r.name),
        csvCell(r.phoneLast4),
        csvCell(r.checkInAt ? fmtDateTime(r.checkInAt) : ""),
        csvCell(r.checkOutAt ? fmtDateTime(r.checkOutAt) : ""),
        csvCell(r.workMinutes != null ? fmtDuration(r.workMinutes) : ""),
        csvCell(wage === "" ? "" : String(wage)),
        csvCell(r.inRoster ? "명단" : "명단 외"),
        csvCell(r.sharedDevice ? "동일 기기 주의" : ""),
      ].join(","),
    );
  }

  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다.
  const csv = "﻿" + lines.join("\r\n");
  const fileName = `강원크루_${event.date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
