import { create } from "zustand";

export type Locale = "ar" | "en";
export type Theme = "light" | "dark";
export type ResourcePanelTab = "library" | "templates" | "history" | "export";

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Locale
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;

  // Active engine
  activeEngine: string | null;
  setActiveEngine: (engine: string | null) => void;

  // Global loading
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Resource panel (REQ-070)
  resourcePanelOpen: boolean;
  resourcePanelPinned: boolean;
  resourcePanelTab: ResourcePanelTab;
  setResourcePanelOpen: (open: boolean) => void;
  toggleResourcePanel: () => void;
  setResourcePanelPinned: (pinned: boolean) => void;
  toggleResourcePanelPinned: () => void;
  setResourcePanelTab: (tab: ResourcePanelTab) => void;

  // Initialize from localStorage
  initialize: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  theme: "light",
  locale: "ar",
  activeEngine: null,
  globalLoading: false,
  commandPaletteOpen: false,
  resourcePanelOpen: false,
  resourcePanelPinned: false,
  resourcePanelTab: "library" as ResourcePanelTab,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },

  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rasid_locale", locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
    set({ locale });
  },

  toggleLocale: () => {
    const next = get().locale === "ar" ? "en" : "ar";
    get().setLocale(next);
  },

  setActiveEngine: (engine) => set({ activeEngine: engine }),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setResourcePanelOpen: (open) => {
    set({ resourcePanelOpen: open });
    if (typeof window !== "undefined") {
      localStorage.setItem("rasid_resource_panel_open", String(open));
    }
  },
  toggleResourcePanel: () => {
    const next = !get().resourcePanelOpen;
    get().setResourcePanelOpen(next);
  },
  setResourcePanelPinned: (pinned) => {
    set({ resourcePanelPinned: pinned });
    if (typeof window !== "undefined") {
      localStorage.setItem("rasid_resource_panel_pinned", String(pinned));
    }
  },
  toggleResourcePanelPinned: () => {
    const next = !get().resourcePanelPinned;
    get().setResourcePanelPinned(next);
    if (next) get().setResourcePanelOpen(true);
  },
  setResourcePanelTab: (tab) => set({ resourcePanelTab: tab }),

  initialize: () => {
    if (typeof window === "undefined") return;

    const savedLocale = localStorage.getItem("rasid_locale") as Locale | null;
    const savedSidebar = localStorage.getItem("rasid_sidebar");

    if (savedLocale) {
      document.documentElement.lang = savedLocale;
      document.documentElement.dir = savedLocale === "ar" ? "rtl" : "ltr";
      set({ locale: savedLocale });
    }

    if (savedSidebar !== null) {
      set({ sidebarOpen: savedSidebar === "true" });
    }

    const savedPinned = localStorage.getItem("rasid_resource_panel_pinned");
    if (savedPinned === "true") {
      set({ resourcePanelPinned: true, resourcePanelOpen: true });
    }
  },
}));
