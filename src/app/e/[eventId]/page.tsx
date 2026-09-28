"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fmtTime, fmtDuration } from "@/lib/time";

const PROFILE_KEY = "gangwon-crew-profile";
const DEVICE_KEY = "gangwon-crew-device";

type Profile = { name: string; phoneLast4: string };
type ApiStatus = { status: "not_checked_in" | "checked_in" | "checked_out"; attendance: { checkInAt: string; checkOutAt: string | null } | null };

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "no-storage";
  }
}

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* 저장 실패해도 이번 화면 동작에는 지장 없음 */
  }
}

export default function CrewCheckInPage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const eventId = params.eventId;
  const token = searchParams.get("t") ?? "";

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = 아직 확인 전
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; checkInAt: string; checkOutAt: string | null } | null>(null);

  useEffect(() => {
    // localStorage는 브라우저에만 있어서 서버 렌더링 중엔 읽을 수 없다. 마운트 후 한 번만 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 저장소(localStorage) 최초 동기화
    setProfile(loadProfile());
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!profile) return;
    const qs = new URLSearchParams({ eventId, name: profile.name, phoneLast4: profile.phoneLast4 });
    const res = await fetch(`/api/demo/checkin-state?${qs}`);
    if (res.ok) setStatus(await res.json());
  }, [profile, eventId]);

  useEffect(() => {
    // 이름 확인이 끝나면(=profile 확정) 서버에 현재 출근 상태를 물어본다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 상태 조회 결과 반영
    if (profile) refreshStatus();
  }, [profile, refreshStatus]);

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    const phone = phoneInput.trim();
    if (!name) return setError("이름을 입력해주세요.");
    if (!/^\d{4}$/.test(phone)) return setError("휴대폰 뒷자리 4자리 숫자를 입력해주세요.");
    if (!agree) return setError("개인정보 수집·이용에 동의해주세요.");
    setError(null);
    const p = { name, phoneLast4: phone };
    saveProfile(p);
    setProfile(p);
  };

  const doAction = async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          token,
          name: profile.name,
          phoneLast4: profile.phoneLast4,
          deviceId: getOrCreateDeviceId(),
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "처리 중 오류가 발생했어요.");
        return;
      }
      setResult({ action: data.action, checkInAt: data.attendance.checkInAt, checkOutAt: data.attendance.checkOutAt });
    } catch {
      setError("네트워크 오류가 발생했어요. 같은 와이파이에 연결되어 있는지 확인해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const switchProfile = () => {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {}
    setProfile(null);
    setStatus(null);
    setResult(null);
    setNameInput("");
    setPhoneInput("");
    setAgree(false);
  };

  const workMinutes = useMemo(() => {
    if (!result?.checkOutAt) return null;
    return Math.round((new Date(result.checkOutAt).getTime() - new Date(result.checkInAt).getTime()) / 60000);
  }, [result]);

  if (profile === undefined) return null; // 최초 렌더 깜빡임 방지

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col px-5 py-6">
      <div className="mb-4 self-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">데모 모드 (위치 확인 생략)</div>

      {!profile && (
        <form onSubmit={submitProfile} className="flex flex-1 flex-col gap-4">
          <h1 className="text-xl font-bold text-navy">처음이시군요! 👋</h1>
          <p className="text-sm text-slate-500">이름과 휴대폰 뒷자리 4자리만 입력하면, 다음부터는 이 휴대폰에서 자동으로 기억해요.</p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">이름</span>
            <input
              className="rounded-xl border border-slate-300 px-4 py-3 text-lg"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="홍길동"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">휴대폰 뒷자리 4자리</span>
            <input
              className="rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-widest"
              inputMode="numeric"
              maxLength={4}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
              placeholder="1234"
            />
          </label>

          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
            <p className="mb-1 font-semibold text-slate-600">개인정보 수집·이용 안내</p>
            <p>· 수집 항목: 이름, 휴대폰 뒷자리 4자리, 출퇴근 시각</p>
            <p>· 목적: 급여 정산 및 분쟁 대응</p>
            <p>· 보유 기간: 행사 종료 후 90일 보관 후 삭제 (익명 통계는 계속 보관)</p>
            <p>· 공식 임금 기록은 행사 운영사가 별도 보관합니다.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            위 내용에 동의합니다.
          </label>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button type="submit" className="mt-auto rounded-2xl bg-brand py-4 text-lg font-bold text-white active:bg-brand-dark">
            확인
          </button>
        </form>
      )}

      {profile && !result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div>
            <p className="text-slate-500">{profile.name}님, 반가워요</p>
            <h1 className="text-2xl font-bold text-navy">{status?.status === "checked_in" ? "퇴근하시겠어요?" : "출근하시겠어요?"}</h1>
          </div>

          {status?.status === "checked_out" ? (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-slate-600">오늘은 이미 퇴근 처리가 완료됐어요.</p>
          ) : (
            <button
              onClick={doAction}
              disabled={busy || status === null}
              className="h-40 w-40 rounded-full bg-brand text-2xl font-bold text-white shadow-lg active:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "처리중…" : status?.status === "checked_in" ? "퇴근" : "출근"}
            </button>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button onClick={switchProfile} className="text-xs text-slate-400 underline">
            다른 사람 이름으로 전환
          </button>
        </div>
      )}

      {profile && result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-5xl">{result.action === "checkin" ? "✅" : "👋"}</div>
          <h1 className="text-2xl font-bold text-navy">
            {profile.name}님 {fmtTime(result.action === "checkin" ? result.checkInAt : result.checkOutAt!)} {result.action === "checkin" ? "출근" : "퇴근"} 완료
          </h1>
          {result.action === "checkout" && workMinutes != null && <p className="text-slate-500">오늘 근무 시간: {fmtDuration(workMinutes)}</p>}
          <button onClick={switchProfile} className="mt-6 text-xs text-slate-400 underline">
            다른 사람 이름으로 전환
          </button>
        </div>
      )}
    </div>
  );
}
