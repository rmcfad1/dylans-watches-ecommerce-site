import { NextRequest, NextResponse } from "next/server";
import { generateListing } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const result = await generateListing({
      item: body.item,
      brand: body.brand,
      model: body.model,
      category: body.category,
      condition: body.condition,
      notes: body.notes,
      platform: body.platform ?? "meta",
      imageUrls: body.imageUrls ?? [],
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate listing" },
      { status: 500 }
    );
  }
}
