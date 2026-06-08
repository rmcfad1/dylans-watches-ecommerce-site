import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/ebay";

export async function GET() {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_RUNAME) {
    return NextResponse.json(
      { error: "EBAY_CLIENT_ID and EBAY_RUNAME must be set in environment variables." },
      { status: 503 }
    );
  }
  const url = getAuthorizationUrl();
  return NextResponse.redirect(url);
}
