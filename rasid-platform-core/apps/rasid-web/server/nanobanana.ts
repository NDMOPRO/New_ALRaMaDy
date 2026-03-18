/**
 * RASID Image Generation Service
 * ═══════════════════════════════════════════════════════════════
 * Priority chain:
 *   1. NanoBanana Pro  (/generate-pro)  — highest quality
 *   2. NanoBanana Std  (/generate)      — fallback
 *   3. Gemini Image    (gemini-2.0-flash-preview-image-generation) — last resort
 *      with Ultra Premium prompt for راصد البيانات
 * ═══════════════════════════════════════════════════════════════
 */

import { ENV } from "./_core/env";

const NANOBANANA_BASE_URL = "https://api.nanobananaapi.ai/api/v1";
const PLATFORM_NAME = "راصد البيانات";
const PLATFORM_URL = "https://alramady.vip/";

function getBananaApiKey(): string {
  const key =
    ENV.bananaApiKey ||
    process.env.BANANA_PRO_API_KEY ||
    process.env.BANANA_API_KEY ||
    process.env.NANOBANANA_API_KEY;
  if (!key) throw new Error("BANANA_API_KEY is not configured");
  return key;
}

function getGeminiApiKey(): string {
  const key = ENV.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

// ─── Types ───────────────────────────────────────────────────────

export interface NanoBananaGenerateOptions {
  prompt: string;
  type?: "TEXTTOIAMGE" | "IMAGETOIAMGE";
  numImages?: number;
  imageSize?:
    | "1:1"
    | "9:16"
    | "16:9"
    | "3:4"
    | "4:3"
    | "3:2"
    | "2:3"
    | "5:4"
    | "4:5"
    | "21:9";
  imageUrls?: string[];
  watermark?: string;
}

export interface NanoBananaProOptions {
  prompt: string;
  imageUrls?: string[];
  resolution?: "1K" | "2K" | "4K";
  aspectRatio?:
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9"
    | "auto";
}

export interface NanoBananaTaskResult {
  taskId: string;
  paramJson: string;
  completeTime: string;
  response: {
    originImageUrl: string;
    resultImageUrl: string;
  };
  successFlag: number; // 0=generating, 1=success, 2=create_failed, 3=generate_failed
  errorCode: number;
  errorMessage: string;
  createTime: string;
}

// ═══════════════════════════════════════════════════════════════
// 1. NanoBanana Standard Generate (/generate)
// ═══════════════════════════════════════════════════════════════

export async function nanoBananaGenerate(
  options: NanoBananaGenerateOptions
): Promise<string> {
  const apiKey = getBananaApiKey();
  const {
    prompt,
    type = "TEXTTOIAMGE",
    numImages = 1,
    imageSize = "16:9",
    imageUrls,
    watermark,
  } = options;

  const body: Record<string, unknown> = {
    prompt,
    type,
    numImages,
    image_size: imageSize,
    callBackUrl: "https://example.com/noop-callback",
  };

  if (imageUrls && imageUrls.length > 0) body.imageUrls = imageUrls;
  if (watermark) body.watermark = watermark;

  console.log(
    "[NanoBanana] Generating image (standard):",
    prompt.substring(0, 80)
  );

  const response = await fetch(`${NANOBANANA_BASE_URL}/nanobanana/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[NanoBanana] API error:", response.status, errorText);
    throw new Error(`NanoBanana API error: ${response.status} — ${errorText}`);
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data: { taskId: string };
  };

  if (result.code !== 200) {
    throw new Error(`NanoBanana API error: ${result.msg}`);
  }

  console.log("[NanoBanana] Task created:", result.data.taskId);
  return result.data.taskId;
}

// ═══════════════════════════════════════════════════════════════
// 2. NanoBanana Pro Generate (/generate-pro)
// ═══════════════════════════════════════════════════════════════

export async function nanoBananaGeneratePro(
  options: NanoBananaProOptions
): Promise<string> {
  const apiKey = getBananaApiKey();
  const {
    prompt,
    imageUrls,
    resolution = "2K",
    aspectRatio = "16:9",
  } = options;

  const body: Record<string, unknown> = {
    prompt,
    resolution,
    aspectRatio,
    callBackUrl: "https://example.com/noop-callback",
  };

  if (imageUrls && imageUrls.length > 0) body.imageUrls = imageUrls;

  console.log(
    "[NanoBanana Pro] Generating image:",
    prompt.substring(0, 80)
  );

  const response = await fetch(
    `${NANOBANANA_BASE_URL}/nanobanana/generate-pro`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[NanoBanana Pro] API error:", response.status, errorText);
    throw new Error(
      `NanoBanana Pro API error: ${response.status} — ${errorText}`
    );
  }

  const result = (await response.json()) as {
    code: number;
    message?: string;
    msg?: string;
    data: { taskId: string };
  };

  if (result.code !== 200) {
    throw new Error(
      `NanoBanana Pro API error: ${result.message || result.msg}`
    );
  }

  console.log("[NanoBanana Pro] Task created:", result.data.taskId);
  return result.data.taskId;
}

// ═══════════════════════════════════════════════════════════════
// 3. Get Task Details (/record-info)
// ═══════════════════════════════════════════════════════════════

export async function nanoBananaGetTask(
  taskId: string
): Promise<NanoBananaTaskResult> {
  const apiKey = getBananaApiKey();

  const response = await fetch(
    `${NANOBANANA_BASE_URL}/nanobanana/record-info?taskId=${encodeURIComponent(
      taskId
    )}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NanoBanana API error: ${response.status} — ${errorText}`
    );
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data: NanoBananaTaskResult;
  };

  if (result.code !== 200) {
    throw new Error(`NanoBanana API error: ${result.msg}`);
  }

  return result.data;
}

// ═══════════════════════════════════════════════════════════════
// 4. Poll for Result
// ═══════════════════════════════════════════════════════════════

export async function nanoBananaPollResult(
  taskId: string,
  maxWaitMs: number = 120000,
  intervalMs: number = 3000
): Promise<NanoBananaTaskResult> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    try {
      const task = await nanoBananaGetTask(taskId);

      if (task.successFlag === 1) {
        console.log(
          `[NanoBanana] Task ${taskId} completed after ${attempts} polls, URL: ${task.response?.resultImageUrl?.substring(0, 60)}...`
        );
        return task;
      }
      if (task.successFlag === 2 || task.successFlag === 3) {
        throw new Error(
          `NanoBanana generation failed: ${task.errorMessage || "Unknown error"} (flag: ${task.successFlag})`
        );
      }

      console.log(
        `[NanoBanana] Task ${taskId} still generating (attempt ${attempts})...`
      );
    } catch (err: any) {
      if (err.message?.includes("generation failed")) throw err;
      console.warn(
        `[NanoBanana] Poll error (attempt ${attempts}):`,
        err.message
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    "NanoBanana generation timed out after " + maxWaitMs + "ms"
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. Gemini Image Generation (Fallback)
//    Ultra Premium prompt for راصد البيانات
//    - 16:9 widescreen
//    - White background
//    - Royal Dark Blue dominant
//    - SDAIA-inspired accents
//    - 300% content density
// ═══════════════════════════════════════════════════════════════

function buildGeminiPremiumPrompt(userPrompt: string): string {
  return `
Create a premium presentation visual for ${PLATFORM_NAME} (${PLATFORM_URL}).

STRICT ART DIRECTION:
- Purpose: PowerPoint presentation slide visual
- Aspect ratio: 16:9 widescreen
- Background: pure white
- Overall quality: ultra premium, executive, polished, strategic, elite, institutional
- Visual style: high-end corporate / government-grade presentation design
- Dominant color: royal dark blue
- Supporting accents: refined tones inspired by SDAIA-like visual identity
- Tone: trustworthy, modern, data-driven, intelligent, official, elegant
- Composition: highly polished, presentation-ready, information-rich, analytically layered
- Lighting and detail: crisp, refined, premium

PLATFORM CONTEXT:
- Platform name: ${PLATFORM_NAME}
- Platform URL: ${PLATFORM_URL}
- This visual should feel relevant to data observability, analytics, AI, dashboards, executive reporting, digital transformation, and strategic insight delivery.

CONTENT:
- User request: ${userPrompt}

CONTENT DENSITY REQUIREMENT:
- Make the slide visually rich with approximately 300% of the usual corporate visual density
- Include significantly more structured visual elements than a standard slide
- Use layered composition with multiple premium visual zones
- Increase analytical richness, conceptual depth, and architectural detail
- Add more interconnected premium data-oriented structures, diagrams, abstract systems, grids, flows, nodes, dashboards, indicators, and strategic visual cues
- The slide should feel dense, intelligent, sophisticated, and high-value
- Despite high density, maintain elegance, order, hierarchy, and readability
- Dense does NOT mean cluttered
- Dense means rich, layered, precise, premium, and intentionally organized

VISUAL THEMES TO PREFER:
- data intelligence, analytics, AI systems, dashboard ecosystems
- strategic reporting, smart governance, executive insights
- decision intelligence, premium abstract data architecture
- modern geometric data patterns, national-scale digital transformation
- institutional innovation, connected information flows

COLOR SYSTEM:
- Main anchor color: royal dark blue
- Secondary accents: elegant blue tones, soft cyan, subtle cool gradients, refined luminous highlights
- White background must remain dominant and clean
- Accent colors may be inspired by SDAIA-like branding logic
- Keep royal dark blue as the main visual authority

LAYOUT RULES:
- 16:9 slide-ready composition
- High information density with luxury spacing discipline
- Multiple balanced visual clusters
- Strong hierarchy, institutional polish, premium abstraction
- Visually impressive but controlled
- Professional keynote quality
- Suitable for leadership and official presentations

NEGATIVE CONSTRAINTS:
- no dark background, no black dominant background
- no beige or warm dominant tones
- no casual social media aesthetic, no cheap marketing look
- no cluttered mess, no childish infographic style
- no random icons, no unnecessary device mockups
- no poster ad style, no chaotic layout
- no oversized empty whitespace, no low-end glossy effects

OUTPUT REQUIREMENTS:
- slide-ready, ultra premium, highly professional
- white background, dominant royal dark blue
- refined SDAIA-inspired cool accents
- visually dense at 300% richness
- elegant, ordered, strategic
- suitable for official executive PowerPoint use
`;
}

export async function geminiGenerateImage(
  prompt: string
): Promise<string | null> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    console.warn("[Gemini] No GEMINI_API_KEY configured, skipping Gemini fallback");
    return null;
  }

  console.log("[Gemini] Generating premium image:", prompt.substring(0, 80));

  try {
    // Use Gemini 2.0 Flash Preview Image Generation via REST API
    const MODEL = "gemini-2.0-flash-preview-image-generation";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const premiumPrompt = buildGeminiPremiumPrompt(prompt);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: premiumPrompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Gemini] API error:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    const candidate = result?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || "image/png";
        const base64 = part.inlineData.data;
        // Return as data URI that can be used directly in HTML
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log("[Gemini] Premium image generated successfully (data URI)");
        return dataUri;
      }
    }

    console.warn("[Gemini] No image found in response");
    return null;
  } catch (err: any) {
    console.error("[Gemini] Generation error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. HIGH-LEVEL: Generate Image and Wait for Result
//    Priority: NanoBanana Pro → NanoBanana Std → Gemini Premium
// ═══════════════════════════════════════════════════════════════

export async function generateImageAndWait(
  prompt: string,
  options?: {
    aspectRatio?: string;
    resolution?: string;
    usePro?: boolean;
    maxWaitMs?: number;
  }
): Promise<string> {
  const {
    aspectRatio = "16:9",
    resolution = "2K",
    usePro = true,
    maxWaitMs = 120000,
  } = options || {};

  // ─── Try NanoBanana (Pro → Standard) ───
  const hasBananaKey = !!(
    ENV.bananaApiKey ||
    process.env.BANANA_PRO_API_KEY ||
    process.env.BANANA_API_KEY ||
    process.env.NANOBANANA_API_KEY
  );

  if (hasBananaKey) {
    try {
      let taskId: string;

      if (usePro) {
        try {
          taskId = await nanoBananaGeneratePro({
            prompt,
            resolution: resolution as "1K" | "2K" | "4K",
            aspectRatio: aspectRatio as any,
          });
        } catch (proErr: any) {
          console.warn(
            "[NanoBanana] Pro failed, trying standard:",
            proErr.message
          );
          taskId = await nanoBananaGenerate({
            prompt,
            imageSize: aspectRatio as any,
          });
        }
      } else {
        taskId = await nanoBananaGenerate({
          prompt,
          imageSize: aspectRatio as any,
        });
      }

      // Poll for result
      const result = await nanoBananaPollResult(taskId, maxWaitMs);
      const imageUrl =
        result.response?.resultImageUrl || result.response?.originImageUrl;

      if (imageUrl) {
        return imageUrl;
      }
    } catch (bananaErr: any) {
      console.warn(
        "[NanoBanana] All NanoBanana attempts failed:",
        bananaErr.message
      );
    }
  }

  // ─── Fallback: Gemini Premium Image Generation ───
  console.log("[ImageGen] Falling back to Gemini premium image generation...");
  const geminiResult = await geminiGenerateImage(prompt);
  if (geminiResult) {
    return geminiResult;
  }

  throw new Error(
    "All image generation methods failed (NanoBanana Pro, Standard, and Gemini)"
  );
}

// ═══════════════════════════════════════════════════════════════
// 7. Account Credits
// ═══════════════════════════════════════════════════════════════

export async function nanoBananaGetCredits(): Promise<number> {
  let apiKey: string;
  try {
    apiKey = getBananaApiKey();
  } catch {
    return -1;
  }

  try {
    const response = await fetch(`${NANOBANANA_BASE_URL}/common/credit`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) return -1;

    const result = (await response.json()) as {
      code: number;
      msg: string;
      data: number;
    };

    return result.code === 200 ? result.data : -1;
  } catch {
    return -1;
  }
}

export async function validateNanoBananaKey(): Promise<boolean> {
  try {
    const credits = await nanoBananaGetCredits();
    return credits >= 0;
  } catch {
    return false;
  }
}
