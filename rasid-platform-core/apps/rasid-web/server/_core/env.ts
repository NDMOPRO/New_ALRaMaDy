export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  bananaApiKey: process.env.BANANA_API_KEY ?? process.env.BANANA_PRO_API_KEY ?? process.env.NANOBANANA_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};
