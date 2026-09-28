import { readStore } from "@/lib/store";
import { buildDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return Response.json(buildDashboard(store));
}
