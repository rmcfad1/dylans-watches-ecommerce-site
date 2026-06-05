import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ListingGenerationInput {
  brand?: string;
  model?: string;
  category: string;
  condition: string;
  notes?: string;
  platform: "meta" | "ebay" | "mercari";
}

export interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: number;
  tags: string[];
}

export async function generateListing(
  input: ListingGenerationInput
): Promise<GeneratedListing> {
  const platformGuidance = {
    meta: "Facebook/Instagram Shop. Conversational tone, highlight lifestyle appeal. Keep title under 100 chars.",
    ebay: "eBay marketplace. Include model number, condition code, key specs. Use searchable keywords. Title max 80 chars.",
    mercari: "Mercari marketplace. Casual but informative. Highlight deal value. Title max 40 chars.",
  };

  const prompt = `You are an expert reseller specializing in watches and consumer electronics. Generate a compelling product listing.

Item details:
- Brand: ${input.brand || "Unknown"}
- Model: ${input.model || "Unknown"}
- Category: ${input.category}
- Condition: ${input.condition}
- Notes: ${input.notes || "None"}
- Platform: ${platformGuidance[input.platform]}

Return ONLY valid JSON with this exact structure:
{
  "title": "...",
  "description": "...",
  "suggestedPrice": 0,
  "tags": ["tag1", "tag2"]
}

For suggestedPrice: estimate a fair used market price in USD based on the brand, model, and condition. Be realistic — used/refurbished pricing, not retail.
For description: write 2-3 paragraphs covering item details, condition specifics, and what's included.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as GeneratedListing;
}
