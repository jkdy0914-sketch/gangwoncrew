import { resetStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await resetStore();
  return Response.json({ ok: true, event: store.event });
}
