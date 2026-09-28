"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type TokenData = { eventName: string; remainingSeconds: number; lanUrl: string | null; localUrl: string };

export default function QrDisplayPage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/demo/qr-token");
      if (!alive || !res.ok) return;
      const json: TokenData = await res.json();
      setData(json);
      setCountdown(json.remainingSeconds);
    };
    load();
    const refresh = setInterval(load, 5000);
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => {
      alive = false;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, []);

  const url = data?.lanUrl ?? data?.localUrl ?? "";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-lg flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">데모 모드</span>
      <h1 className="text-xl font-bold text-navy">{data?.eventName ?? "불러오는 중…"}</h1>
      <p className="text-slate-500">휴대폰 카메라로 아래 QR을 스캔해주세요</p>

      <div className="rounded-3xl border-4 border-navy bg-white p-6 shadow-xl">{url ? <QRCodeSVG value={url} size={280} /> : <div className="h-[280px] w-[280px]" />}</div>

      <p className="text-sm text-slate-400">다음 갱신까지 {countdown}초</p>

      <div className="w-full rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-500">QR이 안 찍히면 휴대폰 브라우저에 직접 입력하세요</p>
        <p className="mt-1 break-all font-mono text-sm text-navy">{url || "-"}</p>
        {!data?.lanUrl && data && <p className="mt-2 text-xs text-red-500">같은 와이파이의 IP를 찾지 못했어요. 노트북이 와이파이에 연결되어 있는지 확인해주세요.</p>}
      </div>
    </div>
  );
}
