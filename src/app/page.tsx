import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-navy">축제 크루 출퇴근</h1>
      <p className="text-lg leading-relaxed text-slate-600">
        현장에 있는 <strong className="text-brand">QR 코드</strong>를<br />
        휴대폰 카메라로 스캔해 주세요.
      </p>
      <p className="text-sm text-slate-400">앱 설치 없이 바로 출근·퇴근이 기록됩니다.</p>
      <Link href="/admin" className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500">
        관리자 화면 →
      </Link>
    </div>
  );
}
