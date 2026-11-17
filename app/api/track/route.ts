import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Counts one page view for the visitor statistics in /admin/statistics.
 * Called by components/VisitTracker.tsx on every page of the public site.
 *
 * Only the visitor's country is used (from Vercel's x-vercel-ip-country
 * header) and only as +1 on that day's total — no IP address, cookie or
 * other per-visitor data is stored. See supabase/visitor-stats.sql.
 */
export const dynamic = "force-dynamic";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios/i;

export async function POST(request: NextRequest) {
  const noContent = new Response(null, { status: 204 });
  if (!isSupabaseConfigured) return noContent;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_PATTERN.test(userAgent)) return noContent;

  let entry = false;
  try {
    const body = await request.json();
    entry = body?.entry === true;
  } catch {
    // Empty or invalid body: count as a page view only.
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase.rpc("record_page_view", {
    p_country: request.headers.get("x-vercel-ip-country"),
    p_entry: entry,
  });
  if (error) console.error("track: could not record page view:", error.message);

  return noContent;
}
