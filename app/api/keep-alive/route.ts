import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Keeps the Supabase Free project awake. Supabase pauses free projects
 * after a week without activity, so a Vercel cron job (see vercel.json)
 * calls this route once a day and it reads one row from site_settings.
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" with cron requests
 * when the CRON_SECRET env var is set; anything else gets 401.
 */
export const dynamic = "force-dynamic";

function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const got = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on different lengths, so check that first.
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured" }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("site_settings").select("id").limit(1);
  if (error) {
    console.error("keep-alive: could not read site_settings:", error.message);
    return NextResponse.json({ ok: false, error: "Supabase query failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
