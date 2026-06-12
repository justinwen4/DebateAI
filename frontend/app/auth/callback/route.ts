import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseRouteClient,
  safeNextPath,
} from "@/app/lib/supabase/server";

function authErrorRedirect(request: NextRequest, message: string, code?: string) {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("reason", message);
  if (code) {
    url.searchParams.set("code", code);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const successRedirect = NextResponse.redirect(new URL(next, request.url));
  const supabase = createSupabaseRouteClient(request, successRedirect);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return successRedirect;
    }
    return authErrorRedirect(request, error.message);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return successRedirect;
    }
    return authErrorRedirect(request, error.message);
  }

  return authErrorRedirect(request, "Invalid confirmation link. Please try signing up again.");
}
