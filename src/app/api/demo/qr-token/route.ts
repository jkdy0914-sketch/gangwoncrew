import { readStore } from "@/lib/store";
import { issueToken, secondsLeftInBucket } from "@/lib/qrToken";
import { getLanIp } from "@/lib/network";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = await readStore();
  const url = new URL(req.url);
  const port = url.port || "3000";
  const lanIp = getLanIp();

  const now = Date.now();
  const token = issueToken(store.event.id, now);
  const remainingSeconds = secondsLeftInBucket(now);
  const qrPath = `/e/${store.event.id}?t=${token}`;

  return Response.json({
    eventName: store.event.name,
    remainingSeconds,
    lanUrl: lanIp ? `http://${lanIp}:${port}${qrPath}` : null,
    localUrl: `http://localhost:${port}${qrPath}`,
  });
}
