import { checkInOrOut } from "@/lib/store";
import { verifyToken } from "@/lib/qrToken";

export const dynamic = "force-dynamic";

type Body = {
  eventId?: string;
  token?: string;
  name?: string;
  phoneLast4?: string;
  deviceId?: string;
  consent?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  const { eventId, token, name, phoneLast4, deviceId, consent } = body;
  if (!eventId || !name || !phoneLast4) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!consent) {
    return Response.json({ error: "개인정보 수집·이용에 동의해주세요." }, { status: 400 });
  }
  if (!verifyToken(eventId, token)) {
    return Response.json({ error: "QR이 만료되었어요. 화면을 새로고침한 뒤 QR을 다시 스캔해주세요." }, { status: 400 });
  }

  const result = await checkInOrOut({ eventId, name, phoneLast4, deviceId: deviceId ?? null });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result);
}
