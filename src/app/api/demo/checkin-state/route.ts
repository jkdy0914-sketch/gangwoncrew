import { getStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const name = url.searchParams.get("name") ?? "";
  const phoneLast4 = url.searchParams.get("phoneLast4") ?? "";
  if (!eventId || !name || !phoneLast4) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const result = await getStatus(eventId, name, phoneLast4);
  return Response.json(result);
}
