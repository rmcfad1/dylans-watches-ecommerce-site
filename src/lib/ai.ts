import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ListingGenerationInput {
  item?: string;
  brand?: string;
  model?: string;
  category: string;
  condition: string;
  notes?: string;
  platform: "meta" | "ebay" | "mercari" | "direct";
  imageUrls?: string[];
}

export interface PhotoNote {
  index: number;
  note: string;
}

export interface PhotoAnalysis {
  qualityScore: number;
  recommendedOrder: number[];
  heroIndex: number;
  photoNotes: PhotoNote[];
}

export interface GeneratedListing {
  titles: {
    ebay: string;
    meta: string;
    mercari: string;
    direct: string;
  };
  /** @deprecated use titles.{platform} — kept so saveToInventory can pick the active platform title */
  title: string;
  description: string;
  suggestedPrice: number;
  tags: string[];
  photoAnalysis?: PhotoAnalysis;
}

export async function generateListing(
  input: ListingGenerationInput
): Promise<GeneratedListing> {
  const itemLabel =
    input.item ||
    `${input.brand || ""} ${input.model || ""}`.trim() ||
    "Unknown";

  const hasPhotos = (input.imageUrls?.length ?? 0) > 0;

  // Build content array — images first, then the text prompt
  type ContentBlock =
    | { type: "image"; source: { type: "url"; url: string } }
    | { type: "text"; text: string };

  const photoSection = hasPhotos
    ? `- Photos provided: ${input.imageUrls!.length} image(s) above — use visual details to enhance titles and description.`
    : "";

  const photoAnalysisSection = hasPhotos
    ? `
"photoAnalysis": {
  "qualityScore": <integer 1-5 overall quality>,
  "recommendedOrder": [<photo indices in best-to-worst order, 0-based>],
  "heroIndex": <index of best hero/thumbnail photo>,
  "photoNotes": [
    { "index": 0, "note": "<brief note e.g. 'good lighting', 'slightly blurry', 'shows damage clearly'>" }
  ]
},`
    : `"photoAnalysis": null,`;

  const textPrompt = `You are an expert reseller specializing in watches and consumer electronics. Generate a compelling product listing optimized for multiple platforms.

Item details:
- Product: ${itemLabel}
- Category: ${input.category}
- Condition: ${input.condition}
- Notes: ${input.notes || "None"}
${photoSection}

Generate FOUR platform-specific titles following these rules:
- eBay: max 80 chars, keyword-rich, include brand/model/condition/key specs, use searchable terms buyers type
- Meta (Facebook Marketplace): max 100 chars, conversational, local-buyer friendly, highlight the deal
- Mercari: max 40 chars, concise, lead with condition, pack in the most important keywords
- Direct (store listing): max 80 chars, clean and professional, brand-forward

Return ONLY valid JSON with this exact structure:
{
  "titles": {
    "ebay": "...",
    "meta": "...",
    "mercari": "...",
    "direct": "..."
  },
  ${photoAnalysisSection}
  "description": "...",
  "suggestedPrice": 0,
  "tags": ["tag1", "tag2"]
}

Rules:
- suggestedPrice: realistic used/resale USD price based on item and condition, not retail
- description: 2-3 paragraphs covering item details, condition specifics, and what's included
- Enforce the character limits strictly — titles must not exceed their platform max${
    hasPhotos
      ? `
- photoAnalysis: analyze all provided photos for quality, composition, lighting, focus, and resale value. Score overall quality 1 (very poor) to 5 (excellent). Recommend the best order for a listing (most appealing first). Identify the best hero/thumbnail image.`
      : ""
  }`;

  const content: ContentBlock[] = [
    ...(input.imageUrls ?? []).map(
      (url): ContentBlock => ({
        type: "image",
        source: { type: "url", url },
      })
    ),
    { type: "text", text: textPrompt },
  ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content }],
  });

  const responseContent = message.content[0];
  if (responseContent.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = responseContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<GeneratedListing, "title">;

  // Derive the legacy `title` field from the requested platform for backwards compat
  const platformKey = input.platform === "direct" ? "direct" : input.platform;
  const legacyTitle = parsed.titles[platformKey] ?? parsed.titles.direct;

  return { ...parsed, title: legacyTitle };
}
