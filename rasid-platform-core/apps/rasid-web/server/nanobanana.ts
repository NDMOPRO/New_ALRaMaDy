/**
 * RASID NanoBanana Pro Service — Image Generation via NanoBanana API
 * Uses BANANA_API_KEY from ENV (mapped to BANANA_PRO_API_KEY)
 * Supports: text-to-image, image-to-image editing
 */

import { ENV } from "./_core/env";

const NANOBANANA_BASE_URL = "https://api.nanobananaapi.ai/api/v1";

function getApiKey(): string {
  const key = ENV.bananaApiKey || process.env.BANANA_PRO_API_KEY;
  if (!key) {
    throw new Error("BANANA_PRO_API_KEY / BANANA_API_KEY is not configured");
  }
  return key;
}

export interface NanoBananaGenerateOptions {
  prompt: string;
  type?: "TEXTTOIAMGE" | "IMAGETOIAMGE";
  numImages?: number;
  imageSize?: "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "3:2" | "2:3" | "5:4" | "4:5" | "21:9";
  imageUrls?: string[];
  watermark?: string;
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

/**
 * Submit image generation task to NanoBanana API
 * Returns a taskId — use pollTaskResult to get the final image
 */
export async function nanoBananaGenerate(
  options: NanoBananaGenerateOptions
): Promise<string> {
  const apiKey = getApiKey();
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

  if (imageUrls && imageUrls.length > 0) {
    body.imageUrls = imageUrls;
  }
  if (watermark) {
    body.watermark = watermark;
  }

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
    throw new Error(
      `NanoBanana API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data: { taskId: string };
  };

  if (result.code !== 200) {
    throw new Error(`NanoBanana API error: ${result.msg}`);
  }

  return result.data.taskId;
}

/**
 * Get task details / status
 */
export async function nanoBananaGetTask(
  taskId: string
): Promise<NanoBananaTaskResult> {
  const apiKey = getApiKey();

  const response = await fetch(
    `${NANOBANANA_BASE_URL}/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NanoBanana API error: ${response.status} ${response.statusText} — ${errorText}`
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

/**
 * Poll for task completion (with timeout)
 * Returns the result image URL when done
 */
export async function nanoBananaPollResult(
  taskId: string,
  maxWaitMs: number = 120000,
  intervalMs: number = 3000
): Promise<NanoBananaTaskResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const task = await nanoBananaGetTask(taskId);

    if (task.successFlag === 1) {
      return task;
    }
    if (task.successFlag === 2 || task.successFlag === 3) {
      throw new Error(
        `NanoBanana generation failed: ${task.errorMessage || "Unknown error"} (flag: ${task.successFlag})`
      );
    }

    // Still generating, wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("NanoBanana generation timed out after " + maxWaitMs + "ms");
}

/**
 * Get account credits balance
 */
export async function nanoBananaGetCredits(): Promise<number> {
  const apiKey = getApiKey();

  const response = await fetch(`${NANOBANANA_BASE_URL}/common/credit`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NanoBanana API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data: number;
  };

  if (result.code !== 200) {
    throw new Error(`NanoBanana API error: ${result.msg}`);
  }

  return result.data;
}

/**
 * Validate that the API key works by checking credits
 */
export async function validateNanoBananaKey(): Promise<boolean> {
  try {
    const credits = await nanoBananaGetCredits();
    return credits >= 0;
  } catch {
    return false;
  }
}
