export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  bananaApiKey: process.env.BANANA_API_KEY ?? "",
};
