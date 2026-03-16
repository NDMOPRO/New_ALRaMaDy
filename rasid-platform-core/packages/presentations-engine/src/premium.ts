export type PremiumMode = "light" | "dark" | "high-contrast";

export type VisualDnaProfile = {
  canvasBg: string;
  panelBg: string;
  glow: string;
  shadow: string;
  logoMode: "light_header" | "light_alt" | "dark_header" | "dark_alt";
  characterRef:
    | "char1_waving"
    | "char2_shmagh"
    | "char3_dark"
    | "char3b_dark"
    | "char4_sunglasses"
    | "char5_arms_crossed"
    | "char6_standing";
  motionProfile: "none" | "subtle" | "moderate" | "cinematic";
  surfaceStyle: "glass" | "paper" | "gallery" | "studio";
};

export type PremiumTemplateDefinition = {
  name: "Vinyl" | "Whiteboard" | "Grove" | "Fresco" | "Easel" | "Diorama" | "Chromatic";
  themeId: string;
  brandKitId: string;
  category: "executive" | "strategy" | "workshop" | "technical" | "creative" | "investor" | "campaign";
  premiumLabel: string;
  description: string;
  industry: string;
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  font: string;
  layoutArchetypes: string[];
  componentStyles: string[];
  visualDna: VisualDnaProfile;
  modeOverrides: Partial<
    Record<
      PremiumMode,
      {
        primary?: string;
        secondary?: string;
        accent?: string;
        neutral?: string;
        font?: string;
        visualDna?: Partial<VisualDnaProfile>;
      }
    >
  >;
};

export const PREMIUM_BRAND_PACKS = [
  {
    brandKitId: "brand://rasid/premium-core",
    label: "Rasid Premium",
    description: "Royal dark blue with gold signal accents and structured executive hierarchy."
  },
  {
    brandKitId: "brand://rasid/executive-board",
    label: "Executive Board",
    description: "Tighter hierarchy and denser contrast for board-ready decks."
  },
  {
    brandKitId: "brand://rasid/field-ops",
    label: "Field Ops",
    description: "Warmer operational palette for dashboards, metrics, and weekly reviews."
  }
] as const;

export const PREMIUM_TEMPLATE_LIBRARY: PremiumTemplateDefinition[] = [
  {
    name: "Vinyl",
    themeId: "theme://premium/vinyl",
    brandKitId: "brand://rasid/premium-core",
    category: "executive",
    premiumLabel: "Board Signal",
    description: "Executive deck with deep ink canvas, warm copper emphasis, and strong headline hierarchy.",
    industry: "strategy",
    primary: "8C2F39",
    secondary: "0C1D3D",
    accent: "C98C2D",
    neutral: "F8F2EC",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-agenda", "premium-kpi-band", "premium-two-column", "premium-compare", "premium-closing"],
    componentStyles: ["signal-card", "board-table", "wide-chart", "executive-quote"],
    visualDna: {
      canvasBg: "#FBF6F0",
      panelBg: "#FFFFFF",
      glow: "rgba(140,47,57,0.18)",
      shadow: "0 22px 72px rgba(12,29,61,0.14)",
      logoMode: "light_header",
      characterRef: "char5_arms_crossed",
      motionProfile: "subtle",
      surfaceStyle: "glass"
    },
    modeOverrides: {
      dark: {
        secondary: "F8F2EC",
        neutral: "091224",
        accent: "F59E0B",
        visualDna: { canvasBg: "#091224", panelBg: "#10203D", glow: "rgba(245,158,11,0.18)", logoMode: "dark_header" }
      },
      "high-contrast": {
        primary: "5B1321",
        secondary: "111827",
        accent: "F97316",
        neutral: "FFFFFF"
      }
    }
  },
  {
    name: "Whiteboard",
    themeId: "theme://premium/whiteboard",
    brandKitId: "brand://rasid/executive-board",
    category: "workshop",
    premiumLabel: "Workshop Surface",
    description: "Clean studio-paper layout with annotation style blocks and strong visual spacing.",
    industry: "operations",
    primary: "102A43",
    secondary: "1F2937",
    accent: "2C7A7B",
    neutral: "FFFFFF",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-canvas", "premium-sticky-grid", "premium-flow", "premium-review", "premium-closing"],
    componentStyles: ["sticky-card", "markup-block", "evidence-rail", "timeline-band"],
    visualDna: {
      canvasBg: "#F8FAFC",
      panelBg: "#FFFFFF",
      glow: "rgba(16,42,67,0.12)",
      shadow: "0 18px 54px rgba(15,23,42,0.12)",
      logoMode: "light_alt",
      characterRef: "char1_waving",
      motionProfile: "moderate",
      surfaceStyle: "paper"
    },
    modeOverrides: {
      dark: {
        secondary: "E2E8F0",
        neutral: "0F172A",
        accent: "14B8A6",
        visualDna: { canvasBg: "#0F172A", panelBg: "#132238", glow: "rgba(20,184,166,0.18)", logoMode: "dark_alt" }
      },
      "high-contrast": {
        primary: "0F172A",
        secondary: "111827",
        accent: "0F766E",
        neutral: "FFFFFF"
      }
    }
  },
  {
    name: "Grove",
    themeId: "theme://premium/grove",
    brandKitId: "brand://rasid/field-ops",
    category: "strategy",
    premiumLabel: "Growth Review",
    description: "Organic structured review with layered greens for pipeline, delivery, and capacity stories.",
    industry: "growth",
    primary: "2D6A4F",
    secondary: "1B4332",
    accent: "D97706",
    neutral: "F4FBF6",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-metrics-grid", "premium-process", "premium-heatmap", "premium-comparison", "premium-closing"],
    componentStyles: ["growth-card", "process-rail", "metric-ribbon", "tree-grid"],
    visualDna: {
      canvasBg: "#F4FBF6",
      panelBg: "#FFFFFF",
      glow: "rgba(45,106,79,0.16)",
      shadow: "0 18px 58px rgba(27,67,50,0.12)",
      logoMode: "light_header",
      characterRef: "char6_standing",
      motionProfile: "subtle",
      surfaceStyle: "gallery"
    },
    modeOverrides: {
      dark: {
        secondary: "D8F3DC",
        neutral: "081C15",
        accent: "F59E0B",
        visualDna: { canvasBg: "#081C15", panelBg: "#16332A", glow: "rgba(245,158,11,0.16)", logoMode: "dark_header" }
      }
    }
  },
  {
    name: "Fresco",
    themeId: "theme://premium/fresco",
    brandKitId: "brand://rasid/premium-core",
    category: "creative",
    premiumLabel: "Narrative Canvas",
    description: "Story-first visual narrative with confident blue-red contrast and lighter editorial rhythm.",
    industry: "communications",
    primary: "0B3954",
    secondary: "0B3954",
    accent: "FF6663",
    neutral: "FEFFFE",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-hero-split", "premium-quote", "premium-storyline", "premium-gallery", "premium-closing"],
    componentStyles: ["hero-panel", "editorial-quote", "story-card", "visual-pair"],
    visualDna: {
      canvasBg: "#EEF5F9",
      panelBg: "#FFFFFF",
      glow: "rgba(11,57,84,0.16)",
      shadow: "0 22px 74px rgba(11,57,84,0.14)",
      logoMode: "light_alt",
      characterRef: "char2_shmagh",
      motionProfile: "moderate",
      surfaceStyle: "studio"
    },
    modeOverrides: {
      dark: {
        secondary: "E0FBFC",
        neutral: "082437",
        accent: "FF7B72",
        visualDna: { canvasBg: "#082437", panelBg: "#10334A", glow: "rgba(255,123,114,0.16)", logoMode: "dark_alt" }
      }
    }
  },
  {
    name: "Easel",
    themeId: "theme://premium/easel",
    brandKitId: "brand://rasid/field-ops",
    category: "technical",
    premiumLabel: "Field Brief",
    description: "Operational storytelling with warm data calls, framed captions, and report-grade clarity.",
    industry: "engineering",
    primary: "9A3412",
    secondary: "7C2D12",
    accent: "2563EB",
    neutral: "FFF7ED",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-caption-grid", "premium-ops-kpi", "premium-technical", "premium-evidence", "premium-closing"],
    componentStyles: ["caption-card", "ops-ribbon", "technical-table", "evidence-column"],
    visualDna: {
      canvasBg: "#FFF7ED",
      panelBg: "#FFFFFF",
      glow: "rgba(154,52,18,0.18)",
      shadow: "0 18px 60px rgba(124,45,18,0.14)",
      logoMode: "light_header",
      characterRef: "char4_sunglasses",
      motionProfile: "subtle",
      surfaceStyle: "paper"
    },
    modeOverrides: {
      dark: {
        secondary: "FDE68A",
        neutral: "1C1917",
        accent: "60A5FA",
        visualDna: { canvasBg: "#1C1917", panelBg: "#292524", glow: "rgba(96,165,250,0.15)", logoMode: "dark_header" }
      }
    }
  },
  {
    name: "Diorama",
    themeId: "theme://premium/diorama",
    brandKitId: "brand://rasid/executive-board",
    category: "investor",
    premiumLabel: "Investor Room",
    description: "Crisp investor-grade framing with restrained drama and strong comparative layouts.",
    industry: "investment",
    primary: "1D3557",
    secondary: "1D3557",
    accent: "E63946",
    neutral: "F1FAEE",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-investor-thesis", "premium-compare", "premium-market-map", "premium-proof-stack", "premium-closing"],
    componentStyles: ["thesis-card", "market-map", "proof-stack", "investor-metric"],
    visualDna: {
      canvasBg: "#F1FAEE",
      panelBg: "#FFFFFF",
      glow: "rgba(29,53,87,0.16)",
      shadow: "0 24px 76px rgba(29,53,87,0.14)",
      logoMode: "light_header",
      characterRef: "char3_dark",
      motionProfile: "cinematic",
      surfaceStyle: "glass"
    },
    modeOverrides: {
      dark: {
        secondary: "E0FBFC",
        neutral: "0B132B",
        accent: "FF4D6D",
        visualDna: { canvasBg: "#0B132B", panelBg: "#1C2541", glow: "rgba(255,77,109,0.16)", logoMode: "dark_header" }
      }
    }
  },
  {
    name: "Chromatic",
    themeId: "theme://premium/chromatic",
    brandKitId: "brand://rasid/premium-core",
    category: "campaign",
    premiumLabel: "Campaign Pulse",
    description: "High-energy premium deck with bolder color rhythm for launches, social, and mixed media.",
    industry: "marketing",
    primary: "5A189A",
    secondary: "3C096C",
    accent: "F72585",
    neutral: "F8F0FF",
    font: "Tajawal",
    layoutArchetypes: ["premium-cover", "premium-campaign-hero", "premium-stat-grid", "premium-social", "premium-mixed-media", "premium-closing"],
    componentStyles: ["campaign-card", "mixed-media", "social-proof", "pulse-metric"],
    visualDna: {
      canvasBg: "#F8F0FF",
      panelBg: "#FFFFFF",
      glow: "rgba(90,24,154,0.16)",
      shadow: "0 24px 78px rgba(60,9,108,0.16)",
      logoMode: "light_alt",
      characterRef: "char3b_dark",
      motionProfile: "cinematic",
      surfaceStyle: "studio"
    },
    modeOverrides: {
      dark: {
        secondary: "F3E8FF",
        neutral: "240046",
        accent: "FF4D8D",
        visualDna: { canvasBg: "#240046", panelBg: "#3C096C", glow: "rgba(255,77,141,0.18)", logoMode: "dark_alt" }
      },
      "high-contrast": {
        primary: "3C096C",
        secondary: "111827",
        accent: "DB2777",
        neutral: "FFFFFF"
      }
    }
  }
] as const;

const normalizeKey = (value: string | null | undefined): string =>
  `${value ?? ""}`.trim().toLowerCase().replace(/^template:\/\//, "").replace(/^theme:\/\//, "");

export const matchPremiumTemplate = (value: string | null | undefined): PremiumTemplateDefinition | null => {
  const normalized = normalizeKey(value);
  if (!normalized) return null;
  return (
    PREMIUM_TEMPLATE_LIBRARY.find(
      (template) =>
        normalizeKey(template.name) === normalized ||
        normalizeKey(template.themeId) === normalized ||
        normalizeKey(template.name).includes(normalized) ||
        normalized.includes(normalizeKey(template.name))
    ) ?? null
  );
};

export const resolvePremiumTemplate = (
  value: string | null | undefined,
  mode: PremiumMode = "light"
): PremiumTemplateDefinition & {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  font: string;
  visualDna: VisualDnaProfile;
} => {
  const base = matchPremiumTemplate(value) ?? PREMIUM_TEMPLATE_LIBRARY[0];
  const override = base.modeOverrides[mode] ?? {};
  return {
    ...base,
    primary: override.primary ?? base.primary,
    secondary: override.secondary ?? base.secondary,
    accent: override.accent ?? base.accent,
    neutral: override.neutral ?? base.neutral,
    font: override.font ?? base.font,
    visualDna: {
      ...base.visualDna,
      ...(override.visualDna ?? {})
    }
  };
};

export const templateLayoutFallback = (
  template: PremiumTemplateDefinition,
  role: "cover" | "agenda" | "content" | "data_story" | "comparison" | "closing",
  slideOrder: number
): string => {
  const map: Record<typeof role, number> = {
    cover: 0,
    agenda: 1,
    content: 3,
    data_story: 2,
    comparison: 4,
    closing: 5
  };
  const exact = template.layoutArchetypes[map[role]];
  if (exact) return exact;
  return template.layoutArchetypes[slideOrder % template.layoutArchetypes.length] ?? "premium-generic";
};
