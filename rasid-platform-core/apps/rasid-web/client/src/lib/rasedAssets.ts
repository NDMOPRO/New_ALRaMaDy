/**
 * Rased Character Assets Catalog
 * All character images uploaded to CDN for use across the platform
 */

const CDN_BASE = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB';

export const RASED_CHARS = {
  // Main Rased mascot poses
  waving: `${CDN_BASE}/Character_1_waving_transparent_51080300.webp`,
  shmagh: `${CDN_BASE}/Character_2_shmagh_transparent_949f43d0.webp`,
  darkBg: `${CDN_BASE}/Character_3_dark_bg_transparent_c7156007.webp`,
  darkBg2: `${CDN_BASE}/Character_3_dark_bg_transparent(1)_e274afde.webp`,
  sunglasses: `${CDN_BASE}/Character_4_sunglasses_transparent_0efb3c80.webp`,
  armsCrossed: `${CDN_BASE}/Character_5_arms_crossed_shmagh_transparent_9b8184d8.webp`,
  standing: `${CDN_BASE}/Character_6_standing_shmagh_transparent_115c1761.webp`,

  // Rased robot/icon poses
  robot1: `${CDN_BASE}/Rased(1)_transparent_239b5504.webp`,
  robot1Alt: `${CDN_BASE}/Rased(1)_transparent(1)_2d4c1de7.webp`,
  robot2: `${CDN_BASE}/Rased(2)_transparent(1)_7b8536be.webp`,
  robot3: `${CDN_BASE}/Rased(3)_transparent_9530fe39.webp`,
  robot3Alt: `${CDN_BASE}/Rased(3)_transparent(1)_c10c5a45.webp`,
  robot4: `${CDN_BASE}/Rased(4)_transparent_2f31d1ef.webp`,
  robot4Alt: `${CDN_BASE}/Rased(4)_transparent(1)_ecf7dfe2.webp`,
  robot5: `${CDN_BASE}/Rased(5)_transparent_de34c884.webp`,
  robot6: `${CDN_BASE}/Rased(6)_transparent_099ef3e0.webp`,
  robot7: `${CDN_BASE}/Rased(7)_transparent_fdf9ebc4.webp`,
} as const;

/**
 * Usage mapping — which character to use where
 */
export const RASED_USAGE = {
  // Onboarding tour
  onboardingWelcome: RASED_CHARS.waving,
  onboardingData: RASED_CHARS.robot5,
  onboardingChat: RASED_CHARS.robot1,
  onboardingPresentation: RASED_CHARS.robot6,
  onboardingReport: RASED_CHARS.robot3,
  onboardingDashboard: RASED_CHARS.robot7,
  onboardingExcel: RASED_CHARS.robot4,
  onboardingExtraction: RASED_CHARS.robot2,
  onboardingTranslation: RASED_CHARS.robot3Alt,
  onboardingLibrary: RASED_CHARS.robot4Alt,
  onboardingStudio: RASED_CHARS.robot1Alt,
  onboardingComplete: RASED_CHARS.sunglasses,

  // Loading screens
  loadingDefault: RASED_CHARS.robot5,
  loadingData: RASED_CHARS.robot1,
  loadingAI: RASED_CHARS.robot6,
  loadingPresentation: RASED_CHARS.robot7,
  loadingReport: RASED_CHARS.robot3,
  loadingDashboard: RASED_CHARS.robot4,
  loadingExcel: RASED_CHARS.robot2,
  loadingExtraction: RASED_CHARS.robot4Alt,
  loadingTranslation: RASED_CHARS.robot3Alt,

  // Admin dashboard
  adminWelcome: RASED_CHARS.standing,
  adminStats: RASED_CHARS.armsCrossed,

  // Chat
  chatGreeting: RASED_CHARS.waving,
  chatThinking: RASED_CHARS.robot5,

  // Login
  loginHero: RASED_CHARS.shmagh,

  // Empty states
  emptyState: RASED_CHARS.robot1,
  errorState: RASED_CHARS.darkBg,
} as const;

/** NDMO Office Logo */
export const NDMO_LOGO = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/ndmo-logo_f76ca342.png';

export type RasedCharKey = keyof typeof RASED_CHARS;
export type RasedUsageKey = keyof typeof RASED_USAGE;
