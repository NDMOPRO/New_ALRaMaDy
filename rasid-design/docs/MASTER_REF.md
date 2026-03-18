# MASTER REFERENCE — RASID PLATFORM REBUILD

---

## A. CDN URLS

### A1. LOGOS
```
LIGHT_HEADER = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased5_light_header_46f09daa.webp
LIGHT_ALT    = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased4_light_alt_041c6a51.webp
DARK_HEADER  = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased7_dark_header_942fdefe.webp
DARK_ALT     = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased2_dark_alt_40be2c8a.webp
FAVICON      = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased6_favicon_a0d52dd8.webp
FAVICON_ALT  = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased4_favicon_b2cce5df.webp
NDMO_LOGO    = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/ndmo-logo_f76ca342.png
```

### A2. CHARACTERS (human)
```
CDN1 = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN
char1_waving       = {CDN1}/char1_waving_f35e1746.webp
char2_shmagh       = {CDN1}/char2_shmagh_85ac5571.webp
char3_dark         = {CDN1}/char3_dark_aa070f45.webp
char3b_dark        = {CDN1}/char3b_dark_0414f76c.webp
char4_sunglasses   = {CDN1}/char4_sunglasses_ce29dde5.webp
char5_arms_crossed = {CDN1}/char5_arms_crossed_cc65d2f4.webp
char6_standing     = {CDN1}/char6_standing_764eae9a.webp
```

### A3. CHARACTERS (robot)
```
CDN2 = https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB
waving      = {CDN2}/Character_1_waving_transparent_51080300.webp
shmagh      = {CDN2}/Character_2_shmagh_transparent_949f43d0.webp
darkBg      = {CDN2}/Character_3_dark_bg_transparent_c7156007.webp
darkBg2     = {CDN2}/Character_3_dark_bg_transparent(1)_e274afde.webp
sunglasses  = {CDN2}/Character_4_sunglasses_transparent_0efb3c80.webp
armsCrossed = {CDN2}/Character_5_arms_crossed_shmagh_transparent_9b8184d8.webp
standing    = {CDN2}/Character_6_standing_shmagh_transparent_115c1761.webp
robot1      = {CDN2}/Rased(1)_transparent_239b5504.webp
robot1Alt   = {CDN2}/Rased(1)_transparent(1)_2d4c1de7.webp
robot2      = {CDN2}/Rased(2)_transparent(1)_7b8536be.webp
robot3      = {CDN2}/Rased(3)_transparent_9530fe39.webp
robot3Alt   = {CDN2}/Rased(3)_transparent(1)_c10c5a45.webp
robot4      = {CDN2}/Rased(4)_transparent_2f31d1ef.webp
robot4Alt   = {CDN2}/Rased(4)_transparent(1)_ecf7dfe2.webp
robot5      = {CDN2}/Rased(5)_transparent_de34c884.webp
robot6      = {CDN2}/Rased(6)_transparent_099ef3e0.webp
robot7      = {CDN2}/Rased(7)_transparent_fdf9ebc4.webp
```

### A4. CHARACTER USAGE MAP
```
onboarding_welcome     → waving
onboarding_data        → robot5
onboarding_chat        → robot1
onboarding_presentation→ robot6
onboarding_report      → robot3
onboarding_dashboard   → robot7
onboarding_excel       → robot4
onboarding_extraction  → robot2
onboarding_translation → robot3Alt
onboarding_library     → robot4Alt
onboarding_studio      → robot1Alt
onboarding_complete    → sunglasses
loading_default        → robot5
loading_data           → robot1
loading_ai             → robot6
loading_presentation   → robot7
loading_report         → robot3
loading_dashboard      → robot4
loading_excel          → robot2
loading_extraction     → robot4Alt
loading_translation    → robot3Alt
admin_welcome          → standing
admin_stats            → armsCrossed
chat_greeting          → waving
chat_thinking          → robot5
login_hero             → shmagh
empty_state            → robot1
error_state            → darkBg
```

### A5. PRESENTATION CDN
```
ndmoTitleBg   = {CDN2}/ndmo-title-bg_f96b0f15.jpg
ndmoContentBg = {CDN2}/ndmo-content-bg_e5c58b79.jpg
sdaiaLogo     = {CDN2}/sdaia-logo-full_2bb1df51.png
sdaiaGeometric= {CDN2}/sdaia-geometric_aae10cbd.png
```

### A6. FONT FILES
```
DIN_Next_Light   = {CDN2}/din-next-lt-w23-light_8f5d463b.ttf
DIN_Next_Regular = {CDN2}/din-next-lt-w23-regular_82b9c63f.ttf
DIN_Next_Medium  = {CDN2}/din-next-lt-w23-medium_a10b3f02.ttf
Helv_Roman       = {CDN2}/HelveticaNeueLTArabic-Roman_80180c45.ttf
Helv_Bold        = {CDN2}/HelveticaNeueLTArabic-Bold_7f43d237.ttf
Helv_Light       = {CDN2}/HelveticaNeueLTArabic-Light_5bf5d706.ttf
Obj_Regular      = {CDN2}/Objectivity-Regular_0eb1f24d.woff2
Obj_Bold         = {CDN2}/Objectivity-Bold_31101271.woff2
Obj_Medium       = {CDN2}/Objectivity-Medium_e7edec15.woff2
Obj_Light        = {CDN2}/Objectivity-Light_2461cc5c.woff2
Google_Symbols   = https://fonts.gstatic.com/s/googlesymbols/v410/HhzZU5Ak9u-oMExPeInvcuEmPosC9zS3FYkFU68cPrjdKM1XMoDZlWmzc3IiWvF1SbxVhQidBnv_C_ar1J9g0sLBUv3G8taXmBpH-Bw.woff2
Tajawal_CSS      = https://fonts.googleapis.com/css2?family=Tajawal:wght@200;300;400;500;700;800;900&display=swap
MaterialSymbols  = https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap
```

---

## B. COLOR SYSTEM (OKLCH)

### B1. LIGHT THEME (:root)
```
--background:             oklch(0.98 0.002 240)
--foreground:             oklch(0.16 0.03 250)
--card:                   oklch(1 0 0)
--card-foreground:        oklch(0.16 0.03 250)
--popover:                oklch(1 0 0)
--popover-foreground:     oklch(0.16 0.03 250)
--primary:                oklch(0.28 0.09 250)      ← Royal Dark Blue
--primary-foreground:     oklch(1 0 0)
--secondary:              oklch(0.97 0.003 250)
--secondary-foreground:   oklch(0.32 0.02 250)
--muted:                  oklch(0.965 0.003 250)
--muted-foreground:       oklch(0.50 0.012 250)
--accent:                 oklch(0.96 0.006 250)
--accent-foreground:      oklch(0.16 0.03 250)
--destructive:            oklch(0.55 0.22 25)
--destructive-foreground: oklch(0.985 0 0)
--border:                 oklch(0.925 0.004 250)
--input:                  oklch(0.925 0.004 250)
--ring:                   oklch(0.28 0.09 250)
--canvas-bg:              oklch(0.965 0.004 250)
--panel-bg:               oklch(1 0 0)
--glow:                   oklch(0.28 0.09 250 / 0.10)
--success:                oklch(0.55 0.17 155)
--warning:                oklch(0.65 0.17 65)
--danger:                 oklch(0.55 0.22 25)
--info:                   oklch(0.55 0.15 240)
--gold:                   oklch(0.72 0.14 75)
--radius:                 0.75rem
```

### B2. DARK THEME (.dark)
```
--background:             oklch(0.14 0.022 250)
--foreground:             oklch(0.93 0.004 250)
--card:                   oklch(0.18 0.018 250)
--card-foreground:        oklch(0.93 0.004 250)
--popover:                oklch(0.18 0.018 250)
--popover-foreground:     oklch(0.93 0.004 250)
--primary:                oklch(0.56 0.14 250)
--primary-foreground:     oklch(1 0 0)
--secondary:              oklch(0.21 0.018 250)
--secondary-foreground:   oklch(0.82 0.004 250)
--muted:                  oklch(0.23 0.018 250)
--muted-foreground:       oklch(0.60 0.008 250)
--accent:                 oklch(0.25 0.022 250)
--accent-foreground:      oklch(0.93 0.004 250)
--destructive:            oklch(0.62 0.2 25)
--destructive-foreground: oklch(0.985 0 0)
--border:                 oklch(0.27 0.018 250)
--input:                  oklch(0.27 0.018 250)
--ring:                   oklch(0.56 0.14 250)
--canvas-bg:              oklch(0.12 0.018 250)
--panel-bg:               oklch(0.18 0.018 250)
--glow:                   oklch(0.56 0.14 250 / 0.15)
--success:                oklch(0.62 0.15 155)
--warning:                oklch(0.72 0.15 65)
--danger:                 oklch(0.62 0.2 25)
--info:                   oklch(0.62 0.13 240)
--gold:                   oklch(0.78 0.12 75)
--card-rgb:               20,25,40
```

### B3. SLIDE THEMES (for presentations)
```
NDMO:     primary=#0f2744  secondary=#d4af37  accent=#1a73e8  bg=#ffffff  gradientStart=#0f2744 gradientEnd=#1a3a6b
SDAIA:    primary=#1a73e8  secondary=#0f766e  accent=#6366f1  bg=#ffffff  gradientStart=#1a73e8 gradientEnd=#0f766e
MODERN:   primary=#6366f1  secondary=#8b5cf6  accent=#ec4899  bg=#ffffff  gradientStart=#6366f1 gradientEnd=#a855f7
MINIMAL:  primary=#1f2937  secondary=#6b7280  accent=#3b82f6  bg=#ffffff  gradientStart=#1f2937 gradientEnd=#374151
CREATIVE: primary=#dc2626  secondary=#f59e0b  accent=#10b981  bg=#fffbeb  gradientStart=#dc2626 gradientEnd=#f59e0b
```

---

## C. FONT SYSTEM

### C1. HIERARCHY
```
font-sans (body default) = 'Tajawal', sans-serif
headings (institutional) = 'DIN Next Arabic', 'Tajawal', sans-serif
english text             = 'Objectivity', sans-serif
alternative body         = 'Helvetica Neue Arabic', 'Tajawal', sans-serif
icons                    = 'Google Symbols' (Material Symbols Outlined)
```

### C2. TAJAWAL WEIGHTS
```
200=ExtraLight  300=Light  400=Regular  500=Medium  700=Bold  800=ExtraBold  900=Black
```

### C3. DIN NEXT ARABIC WEIGHTS
```
300=Light  400=Regular  500=Medium
```

### C4. ICON USAGE
```
Component: MaterialIcon
Props: icon(string), size(number=24), className(string), filled(boolean), style(CSSProperties)
Font: "Google Symbols"
fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
```

---

## D. COMPONENT ARCHITECTURE

### D1. PAGE STRUCTURE
```
App.tsx
├── ThemeProvider (defaultTheme="dark", switchable=true)
│   └── AuthProvider
│       └── WorkspaceProvider
│           └── CompactModeProvider
│               └── NotificationProvider
│                   └── Router (Wouter)
│                       ├── /        → Home (protected)
│                       ├── /login   → Login
│                       ├── /about   → About
│                       ├── /profile → Profile (protected)
│                       └── /admin   → AdminPanel (protected, admin/editor only)
```

### D2. HOME PAGE LAYOUT (3-column)
```
┌──────────────────────────────────────────────────────┐
│ NotebookHeader (h=56px, fixed, z-50)                 │
├──────────┬──────────────────────┬────────────────────┤
│ DataPanel│ Center Content       │ StudioPanel        │
│ (right)  │                      │ (left)             │
│ 260-340px│ ┌──────────────────┐ │ 180-300px          │
│          │ │ WorkspaceTabs    │ │                    │
│ 5 tabs:  │ │ (chat/data/lib)  │ │ 7 tools:          │
│ all      │ ├──────────────────┤ │ dashboard          │
│ files    │ │ if chat:         │ │ report             │
│ tables   │ │   ChatCanvas     │ │ presentation       │
│ groups   │ │ else:            │ │ matching           │
│ flows    │ │   WorkspaceView  │ │ arabization        │
│          │ │   (Excel/Library)│ │ extraction         │
│ collaps- │ └──────────────────┘ │ translation        │
│ ible     │                      │                    │
│          │                      │ collapsible        │
├──────────┴──────────────────────┴────────────────────┤
│ MobileBottomNav (< 768px only)                       │
└──────────────────────────────────────────────────────┘
```

### D3. PANELS COLLAPSE BEHAVIOR
```
- Both panels collapsible via toggle buttons
- Collapsed state: thin rail with vertical icons
- Panel transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1)
- Collapsed class: width:0, opacity:0, padding:0, overflow:hidden, pointer-events:none
- onToggleBoth in header toggles both panels simultaneously
```

### D4. WORKSPACE VIEWS (only 3)
```
chat    → ChatCanvas (forwardRef with sendMessage handle)
data    → ExcelEngine
library → LibraryEngine
```

### D5. WORKSPACE CONTEXT
```
activeView: string (default 'chat')
setActiveView(view): updates view + adds to history
navigateTo(payload): {targetView, itemId?, itemType?, data?, label?}
pendingNavigation: NavigationPayload | null
navigationHistory: array of {view, label, timestamp, payload?} (max 20)
goBack(): pops history stack
canGoBack: boolean
```

---

## E. COMPONENT DETAILS

### E1. NotebookHeader
```
height: 56px
background: dark navy gradient (#0f2744 → slightly lighter)
gold accent line: 1px at bottom
elements:
  - hamburger menu (mobile)
  - logo (LOGOS.dark_header always used)
  - editable title (default: "مساحة العمل الرئيسية")
  - PlatformStatus indicator
  - search button (opens CommandPalette)
  - theme toggle (with animation)
  - sound toggle
  - compact mode toggle
  - share button
  - settings button
  - analytics button
  - NotificationBell
  - user avatar + dropdown menu
user menu items:
  - الملف الشخصي → /profile
  - لوحة الإدارة → /admin (admin/editor only)
  - من نحن → /about
  - تسجيل الخروج
```

### E2. ChatCanvas
```
type: forwardRef<ChatCanvasHandle>
handle: { sendMessage(text: string) }
state:
  - messages: ChatMessage[] (id, role, content, time, isStreaming?, actions?, stages?, artifacts?)
  - input: string
  - isTyping: boolean
  - pendingIntent: null | {type, step(0-7), topic, style, contentSource, slideCount, brandId, language, imageStyle, colorScheme, fontFamily, templateId}
  - dragOver/dropSnap for file drop
features:
  - empty state: character waving + quick actions grid (6 items)
  - quick actions: analyze, dashboard, report, compare, clean, merge
  - intent wizard: 7 steps (topic→style→source→count→brand→imageStyle→language→EXECUTE)
  - message actions: dynamic buttons below messages
  - execution stages: pending/running/completed/failed with progress
  - artifacts: dashboard/report/presentation/data/match outputs
  - file drag & drop with visual feedback
  - auto-scroll to bottom
  - chat menu: save, rename, favorite, export, clear
```

### E3. ChatStates (15 states)
```
empty, loading, multi-file, suggested-actions, plan, running, success, warning, failure, compare, evidence, inspector, export, template-lock, fix-retry
```

### E4. DataPanel
```
tabs: all(apps), files(description), tables(table_chart), groups(folder), flows(account_tree)
statuses: ready(green), processing(orange), review(blue), failed(red), merged(purple)
context menu: rename, sort, favorite, pin, workspace, hide, delete
```

### E5. StudioPanel
```
tools:
  dashboard → color:#1e40af icon:dashboard
  report    → color:#059669 icon:description
  presentation → color:#d97706 icon:slideshow
  matching  → color:#7c3aed icon:compare
  arabization → color:#0891b2 icon:g_translate
  extraction → color:#dc2626 icon:text_snippet
  translation → color:#4f46e5 icon:translate
```

### E6. ExcelEngine
```
- spreadsheet-like data viewer
- column headers with sort/filter
- row selection
- cell editing
- data status indicators
- merge/clean/analyze actions
- import/export
```

### E7. DashboardEngine
```
- widget grid layout
- chart types: bar, line, pie, area, donut, gauge
- KPI cards
- drag & drop widget arrangement
- real-time data binding
- export to image/PDF
```

### E8. ReportsEngine
```
sections: cover, summary(ملخص تنفيذي), methodology(منهجية), results(نتائج), tables, charts, recommendations(توصيات)
actions: save, approve(اعتماد), export, share, review(إرسال للمراجعة)
```

### E9. PresentationsEngine
```
- Gamma.app-like slide creator
- 3-phase generation: outline → progress → cards
- 5 themes: ndmo, sdaia, modern, minimal, creative
- layouts: title, toc, executive-summary, pillars, chart, table, infographic, kpi, timeline, closing, content, two-column, quote
- brands: NDMO, SDAIA
- export: PPTX (pptxgenjs), PDF (jsPDF + html2canvas)
- per-slide edit
- content sources: AI, user text, library, file upload
actions: save, export, present(عرض), share, review
```

### E10. WizardEngine
```
engine IDs: dashboard, report, presentation, matching, arabization, extraction, translation, excel
each engine has: title, icon, color, steps(WizardStep[]), outputSlides(ExecutionSlide[])
step types: select, multi-select, upload, input, range, confirm
execution: slides cascade with progress animation
```

### E11. CommandPalette
```
trigger: Ctrl+K or search button
categories: navigation, engine, analysis, action, recent
fuzzy matching with score + highlighted indices
keyboard navigation: up/down/enter/escape
recent searches persisted
```

### E12. OnboardingTour
```
multi-step guided tour
each step: character image + title + description + highlight target
steps cover: welcome, data, chat, presentation, report, dashboard, excel, extraction, translation, library, studio, complete
```

### E13. MobileBottomNav (< 768px)
```
main items: chat(المحادثة), data(بياناتي), presentations(عروضي), reports(تقاريري), more(المزيد)
more items: dashboard(لوحاتي), extraction(تفريغ), translation(ترجمة), matching(مطابقة), library(مكتبتي)
bounce animation on tap
```

### E14. RasedLoader
```
types: default, data, ai, presentation, report, dashboard
each type has 4 rotating Arabic messages
character image based on type (from RASED_USAGE map)
golden shimmer effect
```

### E15. ModeSwitcher
```
two modes: easy(سهل) / advanced(متقدم)
pill toggle with icons: auto_awesome / tune
used by all engines
```

### E16. SettingsMenu
```
sections:
  1: theme toggle, output language(العربية), font size(متوسط)
  2: fullscreen, notifications, keyboard shortcuts
  3: help, feedback, about, licenses
footer: راصد البيانات v2.0 — NDMO
```

### E17. PlatformStatus
```
3 states:
  loading → yellow pulse "جاري الاتصال..."
  connected → green pulse "المنصة متصلة (X/Y)" + cloud_done icon
  disconnected → red "غير متصل" + cloud_off icon
tooltip shows each engine status
```

---

## F. CONTEXTS

### F1. AuthContext
```
user: {id, userId, displayName, email, mobile, role, department, avatar, status, permissions[], createdAt, lastSignedIn}
roles: admin, editor, viewer, analyst, user
methods: login(userId, password), register({userId, password, displayName, email?, mobile?, department?}), logout(), forgotPassword(email), resetPassword(token, password), updateProfile(partial)
auth via tRPC: auth.login, auth.register, auth.logout, auth.me
JWT in httpOnly cookies
```

### F2. ThemeContext
```
theme: 'light' | 'dark'
toggleTheme: () => void (only if switchable=true)
switchable: boolean
persists to localStorage key "theme"
adds/removes .dark class on <html>
```

### F3. WorkspaceContext
```
(detailed in D5 above)
```

### F4. NotificationContext
```
notifications: RasidNotification[] (max 50, persisted localStorage key "rasid_notifications")
RasidNotification: {id, title, message, type(success|info|warning|error), timestamp, read}
methods: addNotification, markRead(id), markAllRead, clearAll
unreadCount computed
on add: plays sound + shows toast (sonner)
```

### F5. CompactModeContext
```
isCompact: boolean (persisted localStorage key "rasid-compact-mode")
toggleCompact(): adds compact-transition class for 400ms, toggles
setCompact(value): same with explicit value
adds/removes .compact-mode class on <html>
```

---

## G. HOOKS

### G1. useAI (8 sub-hooks)
```
useAIStatus()      → {status:{available,source}, isLoading, error}
useAIChat()        → {messages, sendMessage(content, context?), clearMessages, isStreaming, error, source}
useAISlides()      → {generateSlides(prompt, slideCount?, style?), isLoading, error, data}
useAIReport()      → {generateReport(prompt, reportType?), isLoading, error, data}
useAIDashboard()   → {analyzeDashboard(prompt, currentWidgets?), isLoading, error, data}
useAIAnalyze()     → {analyzeData(prompt, data?, columns?), isLoading, error, data}
useAIMatch()       → {matchSuggest(prompt, sourceData?, targetData?), isLoading, error, data}
useAITranslate()   → {translate(text, from?, to?), isLoading, error, data}
useAISummarize()   → {summarize(text, maxLength?), isLoading, error, data}
```

### G2. usePlatformHealth
```
returns: {connected: boolean, engines: Record<string, {connected, url}>, isLoading}
calls tRPC platform.health
```

### G3. usePlatformEngines
```
discovers available engines from backend
```

### G4. useWebSocket (useJobWebSocket)
```
JobUpdateEvent: {jobId, status, progress, message, result?}
real-time job progress updates
```

---

## H. tRPC PROCEDURES

### H1. auth
```
auth.login({userId, password}) → {success, user?} | {success:false, error}
auth.register({userId, password, displayName, email?, mobile?, department?}) → same
auth.logout() → void
auth.me() → User | null
```

### H2. data
```
data.list() → DataItem[]
data.upload(file) → DataItem
data.delete(id) → void
data.rename(id, name) → void
data.merge(ids[]) → DataItem
data.clean(id, options) → DataItem
data.analyze(id, type) → AnalysisResult
```

### H3. ai
```
ai.status() → {available, source}
ai.chat({messages, context?}) → {content, source}
ai.generateSlides({prompt, slideCount?, style?}) → SlideData[]
ai.generateReport({prompt, reportType?}) → ReportData
ai.analyzeDashboard({prompt, currentWidgets?}) → DashboardData
ai.analyzeData({prompt, data?, columns?}) → AnalysisResult
ai.matchSuggest({prompt, sourceData?, targetData?}) → MatchResult
ai.translate({text, from?, to?}) → {translated, source, target}
ai.summarize({text, maxLength?}) → {summary}
```

### H4. reports
```
reports.list, reports.create, reports.update, reports.delete, reports.generate
```

### H5. presentations
```
presentations.list, presentations.create, presentations.update, presentations.delete, presentations.generate
```

### H6. dashboards
```
dashboards.list, dashboards.create, dashboards.update, dashboards.delete, dashboards.generate
```

### H7. library
```
library.list, library.save, library.delete, library.search
```

### H8. admin
```
admin.users, admin.stats, admin.logs, admin.settings
```

### H9. platform
```
platform.health → {connected, engines}
platform.engines → EngineInfo[]
```

---

## I. AI BACKEND

### I1. OpenAI Layer
```
primary: OpenAI API (GPT-4o-mini) via OPENAI_API_KEY env
fallback: Forge LLM via BUILT_IN_FORGE_API_KEY + BUILT_IN_FORGE_API_URL
strategy: try OpenAI first → catch → try Forge
default: temperature=0.7, max_tokens=4096
supports: response_format for JSON mode
```

---

## J. CSS EFFECTS CATALOG

### J1. GLASSMORPHISM
```
.glass         → bg: white/0.78, backdrop-filter: blur(16px) saturate(1.2)
.glass (dark)  → bg: oklch(0.18 0.018 250 / 0.78)
.glass-strong  → bg: white/0.9, backdrop-filter: blur(24px) saturate(1.3)
```

### J2. GOLDEN BORDERS
```
.gold-border          → 1px solid rgba(212,175,55,0.3)
.gold-border-glow     → + box-shadow glow
.gold-border-animated → gradient border with flow animation (4s infinite)
.gold-shimmer         → sweep effect (3s infinite)
.gold-accent-line     → horizontal gradient line
```

### J3. CARD EFFECTS
```
.card-premium → hover: translateY(-2px) + shadow + gradient overlay
.card-hover   → hover: translateY(-2px) + increased shadow
```

### J4. BUTTON EFFECTS
```
.btn-premium    → hover: translateY(-1px) + light sweep
.btn-hover-lift → hover: translateY(-1px) + shadow, active: scale(0.97)
```

### J5. TEXT EFFECTS
```
.text-gradient-gold    → linear-gradient(135deg, #d4af37, #f0d060, #d4af37)
.text-gradient-primary → linear-gradient(135deg, royal-blue shades)
.hover-underline-gold  → underline expands from center on hover
```

### J6. GLOW EFFECTS
```
.glow-gold    → box-shadow gold
.glow-primary → box-shadow primary color
```

### J7. STATUS BADGES
```
.badge-success → green bg/text
.badge-warning → orange bg/text
.badge-danger  → red bg/text
.badge-info    → blue bg/text
```

---

## K. ANIMATION KEYFRAMES (complete list)

### K1. BASIC (15)
```
float, float-slow, pulse-glow, pulse-soft, logo-ring, fade-in-up, fade-in, fade-in-scale, slide-in-right, slide-in-left, slide-card-enter, slide-up, slide-down, count-up, skeleton-pulse
```

### K2. STAGGER & SHIMMER (4)
```
stagger-in, shimmer, bounce-in, typing-dot
```

### K3. PANELS (6)
```
panel-expand, panel-collapse, dialog-backdrop, dialog-content, menu-pop, ripple
```

### K4. WORKSPACE (6)
```
icon-spin, workspace-switch, morph-in, rise, glow-pulse, char-wave
```

### K5. PROGRESS & SLIDE (3)
```
progress-bar, slide-in-bottom, page-enter, page-exit
```

### K6. COLLAPSED PANEL (5)
```
collapsed-panel-enter, collapsed-icon-breathe, collapsed-bar-scan, collapsed-dot-orbit, gradient-shift
```

### K7. MESSAGE (2)
```
msg-slide-right, msg-slide-left
```

### K8. CHAT STATES (10)
```
float-particle, breathe, ping-slow, ping-slower, spin-slow, orbit, shimmer-bar, fade-switch, confetti-fall, success-ring, success-ring-2, success-check, scale-in, shake-gentle, count-up-number
```

### K9. WIZARD (8)
```
wizard-step-enter, wizard-option-enter, scale-pop, btn-glow-sweep, slide-active-pulse, glow-bar-scan, icon-pulse, icon-spin-gentle, progress-shimmer, wizard-complete-enter, wizard-success-ring, wizard-success-check, particle-burst, wizard-text-reveal
```

### K10. ADVANCED (10)
```
orbit-spin, radar-sweep, data-stream, slide-stack-in, morph-blob, shimmer-load, ripple-out, gradient-shift, ambient-drift, ambient-drift-reverse
```

### K11. HEADER & NAV (8)
```
logo-orbit, gold-line-flow, divider-glow, fade-out-down, tab-indicator, engine-enter, chat-sidebar-enter, fab-pulse
```

### K12. DRAG & DROP (4)
```
drag-ghost-enter, drop-zone-pulse, drop-glow-trail, drop-snap
```

### K13. MOBILE & MISC (4)
```
bounce-once, slide-down-reverse, icon-shake, rail-enter
```

### K14. WORKSPACE TRANSITIONS (6)
```
ws-exit-left, ws-exit-right, ws-exit-fade, ws-enter-left, ws-enter-right, ws-enter-fade
```

### K15. LOGO (3)
```
logo-ring-spin, logo-pulse, logo-entrance
```

---

## L. RESPONSIVE BREAKPOINTS

```
XS   < 480px   → phone portrait: everything compressed, grid 2-col actions, 85vw drawers, full-screen dialogs
SM   480-767px  → phone landscape: grid 3-col actions, 75vw drawers, 95vw dialogs
MD   768-1023px → tablet: data-panel 220px, studio 180px, inspector 340px, 85vw dialogs
LG   1024-1439px→ laptop: data-panel 260px, studio 220px, 720px dialogs
XL   1440-1919px→ desktop: data-panel 300px, studio 260px, chat max-w 900px, 800px dialogs
2XL  1920px+    → ultrawide: data-panel 340px, studio 300px, chat max-w 1000px

touch devices: min-height 44px, min-width 44px for tap targets
landscape phone (max-height 500px): compressed header/input
safe-area: padding for notched devices
print: hide header, panels, input; full-width content
reduced-motion: animation-duration 0.01ms
high-contrast: stronger borders, no glass
```

---

## M. BACKEND ENGINES (packages/)

```
ai-engine                        2,231 lines
arabic-localization-lct-engine  10,857 lines
artifacts                            8 lines (contract only)
audit-lineage                       16 lines (contract only)
brand-template                      13 lines (contract only)
canvas-contract                     24 lines (contract only)
capability-registry                141 lines
common                              28 lines (contract only)
connectors                           8 lines (contract only)
contracts                       11,726 lines (28 exported modules)
dashboard-engine                 2,825 lines
evidence                            15 lines (contract only)
excel-engine                    34,098 lines ← LARGEST
governance-engine                5,173 lines
jobs                                 8 lines (contract only)
library                              8 lines (contract only)
output-publication                   8 lines (contract only)
permissions                         25 lines (contract only)
presentations-engine            12,060 lines
report-engine                   12,916 lines
runtime                             56 lines
strict-replication-engine       30,177 lines ← 2nd LARGEST
transcription-extraction-engine  2,861 lines
```

---

## N. CONTRACTS (28 modules exported from packages/contracts/src/index.ts)

```
common, canonical, dashboard, artifact, job, action, excel, tool-registry, evidence, audit-lineage, library, brand-template, permissions, connectors, canvas, degrade, publication, report, presentation, schedule, localization, strict, ai, transcription, governance, registry, seed-types
```

---

## O. DATA DEFINITIONS

### O1. STUDIO_TOOLS
```
dashboard  → label:لوحة مؤشرات  icon:dashboard      color:#1e40af
report     → label:تقرير        icon:description     color:#059669
presentation→label:عرض          icon:slideshow       color:#d97706
matching   → label:مطابقة       icon:compare         color:#7c3aed
arabization→ label:تعريب        icon:g_translate     color:#0891b2
extraction → label:تفريغ        icon:text_snippet    color:#dc2626
translation→ label:ترجمة        icon:translate       color:#4f46e5
```

### O2. DATA_TABS
```
all    → label:الكل       icon:apps
files  → label:الملفات    icon:description
tables → label:الجداول    icon:table_chart
groups → label:المجموعات  icon:folder
flows  → label:التدفقات   icon:account_tree
```

### O3. DATA_STATUSES
```
ready      → label:جاهز            color:#059669  bg:#ecfdf5
processing → label:قيد المعالجة    color:#d97706  bg:#fffbeb
review     → label:يحتاج مراجعة   color:#2563eb  bg:#eff6ff
failed     → label:فشل            color:#dc2626  bg:#fef2f2
merged     → label:مدمج           color:#7c3aed  bg:#f5f3ff
```

### O4. QUICK_ACTIONS
```
analyze   → تحليل البيانات     icon:analytics
dashboard → إنشاء لوحة مؤشرات icon:dashboard
report    → إنشاء تقرير       icon:description
compare   → مقارنة جهات       icon:compare
clean     → تنظيف البيانات    icon:cleaning_services
merge     → دمج الجداول       icon:merge_type
```

### O5. ANALYSIS_TYPES
```
compliance     → تحليل الامتثال     icon:verified
classification → تحليل التصنيف     icon:category
personal       → البيانات الشخصية   icon:person_search
quality        → جودة البيانات     icon:fact_check
gaps           → تحليل الفجوات     icon:troubleshoot
comparison     → مقارنة            icon:compare_arrows
```

### O6. REPORT_SECTIONS
```
cover          → الغلاف            icon:image
summary        → الملخص التنفيذي   icon:summarize
methodology    → المنهجية          icon:science
results        → النتائج           icon:assessment
tables         → الجداول           icon:table_chart
charts         → الرسوم البيانية   icon:bar_chart
recommendations→ التوصيات          icon:lightbulb
```

### O7. ACTIONS (per output type)
```
REPORT:       save, approve(اعتماد), export, share, review(إرسال للمراجعة)
PRESENTATION: save, export, present(عرض), share, review
DASHBOARD:    save, publish(نشر), share, export, analyze(تحليل مباشر)
CHAT:         save(حفظ المحادثة), rename(تغيير العنوان), favorite(تعيين كمفضلة), export(تصدير), clear(مسح)
DATA_ITEM:    rename, sort, favorite, pin(تثبيت), workspace(عرض في مساحة العمل), hide(إخفاء), delete
```

### O8. WORKSPACE_VIEWS
```
chat    → label:راصد الذكي  icon:smart_toy
data    → label:بياناتي     icon:table_chart
library → label:مكتبتي      icon:folder_open
```

---

## P. LOGIN PAGE

```
- RTL Arabic layout
- left side: form (userId + password + remember me + forgot password + register link)
- right side: hero with character (shmagh) + floating particles + brand messaging
- logo: LOGOS.dark_header at top
- gradient background: royal blue to dark
- gold accents on focus/active states
- animated character entrance
- tRPC auth.login on submit
- redirect to / on success
```

---

## Q. ABOUT PAGE

```
- hero section with parallax
- NDMO logo + vision + mission
- stat cards with count-up animation (useCountUp hook)
- intersection observer for scroll reveal (useInView hook)
- objective cards (numbered, with hover effects)
- character image (standing)
- gold gradient accents
- back button to home
```

---

## R. SECURITY MODEL

```
- JWT via httpOnly cookies
- 5 roles: admin, editor, viewer, analyst, user
- tRPC middleware checks session
- password hashing: bcrypt
- CORS restricted
- admin routes: role check in component (isAdmin = admin || editor)
```

---

## S. LOADING MESSAGES (per type)

```
default:      جاري التحميل... | لحظات وأكون جاهز! | أحضّر لك كل شيء... | راصد يعمل بجد!
data:         جاري تحميل البيانات... | أقرأ الملفات... | أحلل المحتوى... | البيانات في الطريق!
ai:           الذكاء الاصطناعي يفكر... | أحلل طلبك... | أعمل على النتائج... | لحظات وتكون النتيجة جاهزة!
presentation: أصمم العرض التقديمي... | أختار أفضل التصاميم... | أنسق الشرائح... | عرضك قارب على الجهوزية!
report:       أكتب التقرير... | أجمع البيانات والرسوم... | أنسق الأقسام... | التقرير شبه جاهز!
dashboard:    أبني لوحة المؤشرات... | أحسب الإحصائيات... | أرسم الرسوم البيانية... | اللوحة جاهزة تقريباً!
```

---

## T. KEYBOARD SHORTCUTS

```
Ctrl+K → CommandPalette (search)
(additional shortcuts defined in Home.tsx useEffect keyboard handler)
```

---

## U. SOUND SYSTEM

```
sounds.ts: playSound(type), isSoundEnabled(), toggleSound()
types: notification, toggle, click (inferred from usage)
used in: NotificationContext (notification), NotebookHeader (toggle), CommandPalette (click)
```

---

## V. COMPACT MODE CSS

```
--compact-scale: 0.875
--compact-spacing: 0.75
header: padding 0.25rem, min-height 40px
tabs: padding 0.125rem 0.75rem, button font 0.625rem
panels: font-size 0.8125rem
panel items: padding 0.375rem 0.5rem
chat: padding 0.5rem, gap 0.375rem
buttons: font-size * compact-scale
cards: padding 0.5rem
transition: 0.3s ease on padding/font-size/gap/margin
```

---

## W. HTML TEMPLATE (index.html)

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <title>راصد البيانات</title>
  <link rel="icon" type="image/webp" href="{FAVICON_ALT}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="{Tajawal_CSS}" rel="stylesheet" />
  <link href="{MaterialSymbols}" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

---

## X. DEPENDENCIES (package.json)

```
Key frontend deps:
- react, react-dom (v19)
- wouter (routing)
- @tanstack/react-query (data fetching)
- @trpc/client, @trpc/react-query (tRPC)
- sonner (toasts)
- pptxgenjs (PPTX export)
- jspdf (PDF export)
- html2canvas (screenshot for PDF)
- tailwindcss (v4)

Key backend deps:
- express
- @trpc/server
- jsonwebtoken (JWT)
- bcryptjs (password hashing)
```

---

## Y. FILE COUNTS SUMMARY

```
Total engine code:          ~125,000 lines TypeScript
Frontend components:        20+ React components
Pages:                      5
Contexts:                   5
Custom hooks:               4 (with 8 AI sub-hooks)
tRPC procedures:            30+
CSS keyframes:              80+
CDN assets:                 30+ images/fonts
Slide themes:               5
User roles:                 5
CSS total:                  1,947 lines
Home.tsx:                   800+ lines
```
