# الملحق التنفيذي — منصة راصد البيانات
# Developer Addendum — RASID Data Platform

**الإصدار:** 1.0
**التاريخ:** 16 مارس 2026
**المرجع:** يُكمّل وثيقة التسليم الرئيسية `RASID_Developer_Handoff.md`
**الغرض:** تحويل المرجع التصميمي إلى عقود تنفيذية واضحة لفريق التطوير

---

## جدول المحتويات

1. [UI to Runtime / Contract Mapping](#1-ui-to-runtime--contract-mapping)
2. [State Matrix](#2-state-matrix)
3. [Action Map](#3-action-map)
4. [Drag and Drop Matrix](#4-drag-and-drop-matrix)
5. [Context Switching Map](#5-context-switching-map)
6. [Missing Clarifications](#6-missing-clarifications)

---

## 1. UI to Runtime / Contract Mapping

This section maps every major UI area to its runtime responsibilities. Each component is described in terms of what data objects it touches, what operations it performs, and what backend contracts it depends on.

### 1.1 Core Shell Components

| UI Area | Component | Functional Role | Read / Mutate | Runtime Operations |
|---------|-----------|----------------|---------------|-------------------|
| Header | `NotebookHeader` | Navigation, branding, global actions | Read-only (user info) | Navigate between views, open search, toggle theme/compact/sound, open settings/share/analytics dialogs |
| Data Panel (Right) | `DataPanel` | Data source browser and drag origin | Read + Mutate | List files (`trpc.files.list`), filter by type/status, drag items to ChatCanvas, context menu actions (rename, delete, favorite) |
| Chat Canvas (Center) | `ChatCanvas` | AI conversation + wizard host + drop target | Read + Mutate | Send messages (`trpc.ai.chat`), activate engine wizards, receive dropped data items, switch between `chat` / `wizard` / `ai-presentation` / `states-demo` modes |
| Studio Panel (Left) | `StudioPanel` | Output browser and engine launcher | Read-only (outputs list) | List studio outputs (dashboards, reports, presentations), click tool to activate wizard in ChatCanvas |
| Workspace Tabs | `WorkspaceTabs` (inside `Home`) | Context switcher between workspace views | Read-only | Switch `activeView` state via `WorkspaceContext`, trigger `AnimatedWorkspace` transitions |

### 1.2 Workspace View Engines

Each workspace tab renders a dedicated engine component via `WorkspaceView`. The table below maps each engine to its runtime contracts.

| Workspace Tab | Engine Component | Artifact Type | Backend Procedures (tRPC) | Operations |
|---------------|-----------------|---------------|--------------------------|------------|
| المحادثة (Chat) | `ChatCanvas` | Chat messages | `ai.chat` (mutation), `chat.history` (query), `chat.addMessage` (mutation) | Create, Read |
| بياناتي (Data) | `WorkspaceView` (data view) | Files | `files.list` (query), `files.create` (mutation), `files.update` (mutation), `files.delete` (mutation), `files.toggleFavorite` (mutation) | Create, Read, Update, Delete |
| عروضي (Presentations) | `PresentationsEngine` | Presentations, Slides | `presentations.list` (query), `presentations.create` (mutation), `presentations.update` (mutation), `presentations.delete` (mutation), `presentations.share` (mutation), `ai.generateSlides` (mutation), `ai.generatePresentation` (mutation), `ai.generateHtmlPresentation` (mutation), `ai.generateSlidesFromContent` (mutation) | Create, Read, Update, Delete, Export, Share |
| تقاريري (Reports) | `ReportsEngine` | Reports | `reports.list` (query), `reports.create` (mutation), `reports.update` (mutation), `reports.delete` (mutation), `ai.generateReport` (mutation), `ai.generateReportSections` (mutation) | Create, Read, Update, Delete, Export (PDF) |
| لوحاتي (Dashboards) | `DashboardEngine` | Dashboards, Widgets | `dashboards.list` (query), `dashboards.create` (mutation), `dashboards.update` (mutation), `dashboards.delete` (mutation), `ai.analyzeDashboard` (mutation), `ai.generateDashboardWidgets` (mutation) | Create, Read, Update, Delete |
| تفريغ (Extraction) | `ExtractionEngine` | Extracted texts | `extractions.list` (query), `extractions.create` (mutation), `ai.extractFromImage` (mutation), `ai.extractFromFile` (mutation), `ai.uploadFile` (mutation), `ai.summarize` (mutation) | Create, Read, Export (text) |
| ترجمة (Translation) | `TranslationEngine` | Translations | `translations.list` (query), `translations.create` (mutation), `ai.translate` (mutation) | Create, Read, Export |
| مطابقة (Matching) | `VisualMatchEngine` | Match results → Dashboards/Reports/Presentations/Spreadsheets | `ai.visualMatch` (mutation), `ai.chat` (mutation), `dashboards.create`, `reports.create`, `presentations.create`, `spreadsheets.create` | Create (cross-artifact) |
| مكتبتي (Library) | `LibraryEngine` | Library items, User files | `library.items` (query), `files.list` (query) | Read |

### 1.3 Canvas Surface Overlays

These components appear as overlays on top of the main canvas area. They are not separate pages — they are contextual panels triggered by specific actions.

| UI Overlay | Component | Functional Role | Trigger | Data Contract |
|-----------|-----------|----------------|---------|---------------|
| Inspector | `InspectorPanel` | View properties, actions, and lineage of a selected artifact | Click on data item or artifact | Receives `InspectorTarget` with `properties: Record<string, string>`, `actions[]`, `lineage[]`, `warnings[]` |
| Evidence Drawer | `EvidenceDrawer` | View evidence entries and audit trail for a completed job | Click on job result or evidence button | Receives `EvidenceData` with `entries[]` (input-snapshot, output-snapshot, diff, metric, log, verification) and `auditTrail[]` |
| Execution Timeline | `ExecutionTimeline` | Show running/queued/completed jobs with stage progress | Displayed when jobs are active | Receives `TimelineJob[]` with `status` (queued/running/verifying/completed/failed/paused), `stages[]`, `progress` |
| Compare View | `CompareView` | Side-by-side comparison of source vs output | Click compare action | Receives `leftTitle`, `rightTitle` |

### 1.4 Dialog Components

| Dialog | Component | Trigger | Purpose | Mutating? |
|--------|-----------|---------|---------|-----------|
| Add Source | `AddSourceDialog` | "+" button in DataPanel or header | Upload files (PDF, Excel, Word, CSV) via drag-drop or file picker | Yes — creates file records |
| Share | `ShareDialog` | Share button in header | Copy link, set permissions, invite collaborators | Yes — creates shared links |
| Analytics | `AnalyticsDialog` | Analytics button in header | View usage statistics and platform metrics | Read-only |
| Settings | `SettingsMenu` | Settings button in header | Platform preferences (language, notifications, display) | Yes — updates user preferences |
| Command Palette | `CommandPalette` | `Ctrl+K` or search button | Fuzzy search across all workspace sections, quick actions | Read-only (navigation) |

### 1.5 Wizard System (Inside ChatCanvas)

When a user clicks a studio tool or types a trigger keyword, the ChatCanvas switches to wizard mode. The wizard is rendered by `WizardEngine` which provides a multi-step configuration flow.

| Engine ID | Wizard Title | Steps | Output Artifact | Backend Procedure |
|-----------|-------------|-------|-----------------|-------------------|
| `report` | تقرير | report-type → sections → data-source → style | Report document | `ai.generateReport`, `ai.generateReportSections`, `reports.create` |
| `presentation` | عرض تقديمي | content-source → brand → slide-count → style → slide-types | Presentation slides | `ai.generatePresentation`, `ai.generateHtmlPresentation`, `presentations.create` |
| `dashboard` | لوحة مؤشرات | dashboard-type → widgets → data-source → layout | Dashboard | `ai.analyzeDashboard`, `ai.generateDashboardWidgets`, `dashboards.create` |
| `matching` | مطابقة بصرية | source-type → target → comparison-mode | Match result | `ai.visualMatch` |
| `arabization` | تعريب | source-text → domain → style | Arabized text | `ai.translate` (with arabization mode) |
| `extraction` | تفريغ | file-upload → extraction-type → output-format | Extracted text | `ai.extractFromImage`, `ai.extractFromFile` |
| `translation` | ترجمة | source-text → target-language → domain | Translated text | `ai.translate` |
| `excel` | جداول بيانات | data-source → analysis-type → output-format | Spreadsheet | `ai.analyzeData`, `ai.analyzeExcelData`, `spreadsheets.create` |

### 1.6 Admin Panel Mapping

The Admin Panel (`/admin`) is a separate page with its own sidebar navigation. It is accessible only to users with `role === 'admin'`.

| Admin Section | Sidebar ID | Data Source | Operations |
|--------------|-----------|-------------|------------|
| لوحة التحكم (Dashboard) | `dashboard` | `trpc.admin.stats` (query) | Read — KPI cards, Chart.js charts |
| التحليلات (Analytics) | `analytics` | `trpc.admin.stats` (query) | Read — usage trends |
| إدارة المحتوى (Content) | `content` | `trpc.admin.allContent` (query) | Read — list all files, reports, presentations |
| الوسائط (Media) | `media` | `trpc.admin.allContent` (query) | Read — media files |
| القوالب (Templates) | `templates` | `trpc.admin.allContent` (query) | Read — template management |
| مكتبة عناصر العروض (Slide Library) | `slide-library` | `SlideLibraryAdmin` component | Create, Read, Update, Delete — slide elements, categories, usage rules |
| الأعضاء (Members) | `members` | `trpc.admin.users` (query) | Read — user list with roles |
| الأدوار والصلاحيات (Roles) | `roles` | Static `ROLES_CONFIG` + `ALL_PERMISSIONS` | Read — role definitions (admin, editor, analyst, viewer) |
| الدعوات (Invitations) | `invitations` | Local state | Create — invitation codes |
| الإعدادات (Settings) | `settings` | Local state | Update — platform settings |
| سجل النشاط (Logs) | `logs` | `trpc.admin.recentActivity` (query) | Read — activity log |

### 1.7 Authentication & User Pages

| Page | Route | Component | Backend Procedures | Operations |
|------|-------|-----------|-------------------|------------|
| Login | `/login` | `Login` | `trpc.auth.login` (mutation) | Authenticate |
| Register | `/register` | `Register` | `trpc.auth.register` (mutation) | Create user |
| Forgot Password | `/forgot-password` | `ForgotPassword` | — (UI only) | — |
| Profile | `/profile` | `Profile` | `trpc.auth.me` (query) | Read user info, usage stats, activity history, sessions |
| About | `/about` | `About` | — (static) | Read — NDMO vision/mission |
| Shared Presentation | `/shared/:token` | `SharedPresentation` | `trpc.presentations.getShared` (query) | Read — public view |

---

## 2. State Matrix

This matrix defines every visual state that appears in the current design, where it appears, how it looks, what actions are available, and what the user should expect.

### 2.1 Global UI States

| State | Where It Appears | Visual Treatment | Enabled Actions | Disabled Actions | User Expectation |
|-------|-----------------|-----------------|-----------------|------------------|-----------------|
| **Loading** | All engine views, data lists, admin panels | `RasedLoader` skeleton with golden shimmer animation; animated Rasid character with pulsing dots | None — all actions disabled | All CRUD actions, navigation within engine | Content is being fetched; wait for completion |
| **Empty** | ChatCanvas (no messages), engine views (no items), data panel (no files) | `EmptyState` component: Rasid character illustration, descriptive text, suggested quick actions | Quick action buttons (create first item), drag-drop zone active | Edit, delete, export, share | No content yet; user should create or upload something |
| **Idle / Ready** | All views after data loads | Normal rendering with full interactivity | All applicable CRUD actions, drag, export, share | None | Content is loaded and ready for interaction |

### 2.2 Job Execution States

| State | Where It Appears | Visual Treatment | Enabled Actions | Disabled Actions | User Expectation |
|-------|-----------------|-----------------|-----------------|------------------|-----------------|
| **Job Running** | `ExecutionTimeline`, `RunningState` in ChatCanvas | Animated progress bar per stage; stage icons cycle through pending→running→completed; pulsing blue border; percentage counter | Cancel (if supported), view details | Edit output, export, share, start new job on same data | AI is processing; stages complete sequentially; wait for all stages |
| **Verifying** | `ExecutionTimeline` (stage status), `EvidenceDrawer` | Stage shows "تحقق" with spinning verification icon; evidence entries accumulate in drawer | View evidence entries, view audit trail | Approve, export, modify | System is validating output against source data |
| **Approval Pending** | `EvidenceDrawer` (status: `pending`) | Yellow/warning badge "قيد التحقق"; evidence drawer shows pending icon | View evidence, request re-run | Publish, export as final | Output needs human or automated approval before publication |
| **Success** | `SuccessState` in ChatCanvas, `ExecutionTimeline` (status: `completed`) | Green checkmark animation; "تم بنجاح" label; output preview card with thumbnail; action buttons appear | View output, export (PDF/PPTX/CSV), share, open in editor, start new job | Re-run (grayed out) | Job completed successfully; output is ready for use |
| **Success with Warnings** | `WarningState` in ChatCanvas | Amber/yellow border; warning icon; list of warning items; "تم مع تحذيرات" label | View output, export, acknowledge warnings, request fix | Auto-publish (requires acknowledgment first) | Output is generated but has quality concerns that should be reviewed |
| **Degraded** | Not explicitly implemented as a separate state | Falls under `WarningState` treatment | Same as warning | Same as warning | Partial success — some data sources unavailable or some stages skipped |
| **Failed** | `FailureState` in ChatCanvas, `ExecutionTimeline` (status: `failed`) | Red border; error icon; error message text; "فشل" label; retry button | Retry, modify input, view error details, go back | Export, share, publish | Job failed; user should retry with different parameters or report issue |
| **Fix & Retry** | `FixRetryState` in ChatCanvas | Shows original error + suggested fix; editable input area; retry button with modified parameters | Edit parameters, retry, cancel | Export, share | System suggests a fix; user can modify and retry |

### 2.3 Content Lifecycle States

| State | Where It Appears | Visual Treatment | Enabled Actions | Disabled Actions | User Expectation |
|-------|-----------------|-----------------|-----------------|------------------|-----------------|
| **Published** | `SharedPresentation` page, share dialog | Green "منشور" badge; public URL displayed; QR code option | View, copy link, revoke access, update | Delete (requires unpublish first) | Content is publicly accessible via shared link |
| **Read-Only** | Shared presentations (viewer role), library items | Subtle lock icon; edit buttons hidden; "عرض فقط" indicator | View, copy, download | Edit, delete, rename | User can view but not modify this content |
| **Permission-Restricted** | Admin panel (non-admin users), role-gated actions | Redirect to home for non-admin routes; individual actions hidden based on `ROLES_CONFIG` permissions | Actions matching user's permission set | Actions outside user's role | User sees only what their role allows |

### 2.4 Data Item States (DataPanel)

| Status | Badge Label | Badge Color | Visual Treatment | Meaning |
|--------|------------|-------------|-----------------|---------|
| `ready` | جاهز | Green (`#059669`) | Green dot indicator, full interactivity | Data is processed and ready for use |
| `processing` | قيد المعالجة | Amber (`#d97706`) | Amber dot, pulsing animation | Data is being processed by the system |
| `review` | يحتاج مراجعة | Blue (`#2563eb`) | Blue dot indicator | Data needs human review before use |
| `failed` | فشل | Red (`#dc2626`) | Red dot indicator | Processing failed; needs re-upload or fix |
| `merged` | مدمج | Purple (`#7c3aed`) | Purple dot indicator | Multiple sources merged into one |

### 2.5 ChatCanvas Mode States

| Mode | Trigger | Visual Change | Available Actions | Back Navigation |
|------|---------|--------------|-------------------|-----------------|
| `chat` | Default, or click "المحادثة" | Message list + input bar + quick actions (when empty) | Send message, use quick actions, receive drops | — (default) |
| `wizard` | Studio tool click, or keyword trigger in chat | Multi-step wizard form replaces chat area; progress indicator at top | Navigate steps, select options, execute | "رجوع" button → returns to `chat` |
| `ai-presentation` | Click "عرض" tool, or type presentation keyword | `AIPresentationCreator` replaces chat area; full slide editor | Create slides, edit, preview, export | "رجوع" button → returns to `chat` |
| `states-demo` | Chat menu → "حالات العرض" | Renders specific `ChatState` component (empty, loading, success, etc.) | Navigate between states, view demos | "رجوع" button → returns to `chat` |

---

## 3. Action Map

This section documents every user-triggerable action in the current design, its location, trigger mechanism, and expected runtime behavior.

### 3.1 Data Management Actions

| Action | Location | Trigger | Requires Approval | Runtime Effect | Output Type | Success State | Warning State | Failure State |
|--------|----------|---------|-------------------|---------------|-------------|---------------|---------------|---------------|
| Upload File | DataPanel → "+" button → `AddSourceDialog` | Click + file select or drag-drop | No | `trpc.files.create` → S3 upload → DB record | File record | File appears in DataPanel with `ready` status | — | Toast error "فشل رفع الملف" |
| Delete File | DataPanel → context menu → "حذف" | Click | No (immediate) | `trpc.files.delete` | — | File removed from list | — | Toast error |
| Rename File | DataPanel → context menu → "إعادة تسمية" | Click | No | `trpc.files.update` | Updated file | Title updated in-place | — | Toast error |
| Toggle Favorite | DataPanel → context menu → "تعيين كمفضل" | Click | No | `trpc.files.toggleFavorite` | Updated file | Star icon toggles | — | Toast error |
| Filter Data | DataPanel → dropdown filter | Select filter option | No | Client-side filter (no API call) | Filtered list | List updates instantly | — | — |

### 3.2 AI Generation Actions

| Action | Location | Trigger | Requires Approval | Runtime Effect | Output Type | Success State | Warning State | Failure State |
|--------|----------|---------|-------------------|---------------|-------------|---------------|---------------|---------------|
| Send Chat Message | ChatCanvas → input bar | Type + Enter or click send | No | `trpc.ai.chat` mutation → LLM response | AI message | Response appears in chat with markdown rendering | — | Error message in chat bubble |
| Generate Report | ReportsEngine or Wizard | Click "إنشاء" after wizard steps | No | `trpc.ai.generateReport` → `trpc.reports.create` | Report document | Report appears in editor with sections | Partial sections generated | "فشل إنشاء التقرير" with retry |
| Generate Presentation | PresentationsEngine or Wizard | Click "إنشاء" after wizard steps | No | `trpc.ai.generatePresentation` → `trpc.presentations.create` | Slide deck | Slides appear in editor | Some slides may be empty | "فشل إنشاء العرض" with retry |
| Generate HTML Presentation | PresentationsEngine (HTML mode) | Toggle "HTML Templates" + click generate | No | `trpc.ai.generateHtmlPresentation` → template matching → content population | HTML slides | Slides render with matched templates | Fallback to AI-generated HTML if no template match | Error toast |
| Analyze Dashboard | DashboardEngine or Wizard | Click "تحليل" | No | `trpc.ai.analyzeDashboard` → `trpc.dashboards.create` | Dashboard with widgets | Dashboard renders with Chart.js widgets | Partial widgets | Error toast |
| Extract from File | ExtractionEngine | Upload file + click "تفريغ" | No | `trpc.ai.uploadFile` → `trpc.ai.extractFromFile` or `trpc.ai.extractFromImage` | Extracted text | Text appears in editor panel | Partial extraction | "فشل التفريغ" |
| Translate Text | TranslationEngine | Enter text + select language + click "ترجمة" | No | `trpc.ai.translate` | Translated text | Side-by-side source/target display | — | "فشل الترجمة" |
| Visual Match | VisualMatchEngine | Upload reference + click "مطابقة" | No | `trpc.ai.visualMatch` | Match analysis + generated artifact | Match result with similarity score | Low confidence match | "فشل المطابقة" |
| Analyze Excel Data | ExcelEngine | Load data + click "تحليل" | No | `trpc.ai.analyzeExcelData` | Analysis results | Charts and insights appear | Partial analysis | Error toast |
| Deep Research | ChatCanvas (via AI) | AI determines research is needed | No | `trpc.ai.deepResearch` | Research summary | Research results in chat | — | Error in chat |

### 3.3 Content Management Actions

| Action | Location | Trigger | Requires Approval | Runtime Effect | Output Type | Success State | Warning State | Failure State |
|--------|----------|---------|-------------------|---------------|-------------|---------------|---------------|---------------|
| Save Report | ReportsEngine → toolbar | Click "حفظ" | No | `trpc.reports.update` | Updated report | "تم الحفظ" toast | — | "فشل الحفظ" toast |
| Export Report as PDF | ReportsEngine → toolbar | Click PDF export button | No | Client-side: `window.print()` with print stylesheet | PDF file (browser download) | Browser print dialog opens | — | — |
| Save Presentation | PresentationsEngine → toolbar | Click "حفظ" | No | `trpc.presentations.update` | Updated presentation | "تم الحفظ" toast | — | "فشل الحفظ" toast |
| Share Presentation | PresentationsEngine → share button | Click "مشاركة" | No | `trpc.presentations.share` → generates token | Shared link | Link copied to clipboard | — | "فشل المشاركة" toast |
| Delete Presentation | PresentationsEngine → context menu | Click "حذف" | No | `trpc.presentations.delete` | — | Item removed from list | — | Toast error |
| Save Dashboard | DashboardEngine → toolbar | Click "حفظ" | No | `trpc.dashboards.update` | Updated dashboard | "تم الحفظ" toast | — | "فشل الحفظ" toast |
| Export Spreadsheet (CSV) | ExcelEngine → toolbar | Click CSV export | No | Client-side CSV generation + download | CSV file | Browser download starts | — | — |
| Save Extraction | ExtractionEngine → toolbar | Click "حفظ" | No | `trpc.extractions.create` | Extraction record | "تم الحفظ" toast | — | Toast error |
| Save Translation | TranslationEngine → toolbar | Click "حفظ" | No | `trpc.translations.create` | Translation record | "تم الحفظ" toast | — | Toast error |

### 3.4 Navigation & UI Actions

| Action | Location | Trigger | Runtime Effect | Output |
|--------|----------|---------|---------------|--------|
| Open Command Palette | Header search button or `Ctrl+K` | Click or keyboard | Opens `CommandPalette` modal with fuzzy search | Navigation to selected item |
| Toggle Data Panel | Header or `Ctrl+D` | Click or keyboard | `dataOpen` state toggles; panel morphs with 400ms animation | Panel expands/collapses |
| Toggle Studio Panel | Header or `Ctrl+Shift+S` | Click or keyboard | `studioOpen` state toggles; panel morphs with 400ms animation | Panel expands/collapses |
| Toggle Both Panels | `Ctrl+B` | Keyboard | Both panels toggle simultaneously | Focus mode or full view |
| Toggle Compact Mode | Header button | Click | `CompactModeContext` updates; CSS density classes applied; saved to `localStorage` | UI density changes |
| Toggle Sound Effects | Header button | Click | `localStorage` key `rasid_sound_enabled` toggles | Sound on/off |
| Toggle Dark Mode | Header button | Click | `ThemeProvider` switches theme; `localStorage` persists | Theme changes |
| Switch Workspace Tab | Header workspace tabs | Click tab | `WorkspaceContext.setActiveView(tabId)` → `AnimatedWorkspace` transition | Canvas content changes with directional slide animation |
| Open Mobile Drawer | Hamburger menu (mobile) | Click | `mobileDrawer` state set to `'data'` or `'studio'` | Side drawer slides in |
| Start Onboarding Tour | First visit or manual trigger | Auto/click | `OnboardingTour` renders spotlight overlay with step-by-step tooltips | Guided tour through all features |

---

## 4. Drag and Drop Matrix

The platform implements HTML5 Drag and Drop with custom visual feedback. This matrix documents all drag-drop interactions in the current implementation.

### 4.1 Drag Sources

| Draggable Item | Source Component | Drag Data Format | Data Payload |
|---------------|-----------------|-----------------|--------------|
| Data Item (file, table, group, flow) | `DataPanel` → `DataItemRow` | `application/rasid-item` (JSON) | `{ id, title, type, status, icon }` |
| Workspace View items (in grid/list mode) | `WorkspaceView` | HTML5 default (no custom data) | — |
| File (external) | OS file system | `Files` (native) | File objects |

### 4.2 Drop Targets

| Drop Target | Component | Accepted Types | Visual Feedback on Drag Over |
|------------|-----------|---------------|------------------------------|
| Chat Canvas | `ChatCanvas` | `application/rasid-item`, `Files` | `drop-zone-active` class: blue dashed border, pulsing glow ring, centered drop icon with "أفلت هنا" label |
| Data Panel | `DataPanel` | `Files` (external only) | `drop-zone-active` class: border highlight |
| Add Source Dialog | `AddSourceDialog` | `Files` (external) | Drag-over state with bouncing upload icon |

### 4.3 Complete Drag-Drop Interaction Matrix

| Draggable Item | Drop Target | Allowed? | Result After Drop | Visual Feedback | Invalid Drop Behavior |
|---------------|------------|----------|-------------------|-----------------|----------------------|
| DataPanel item → ChatCanvas | ChatCanvas | **Yes** | Text "تحليل: {item.title}" injected into chat input field; `dropSnap` animation plays (blue border flash) | Glow ring appears around drop zone; snap animation on successful drop; sound effect `drop` plays | — |
| DataPanel item → DataPanel | DataPanel | **No** (same source) | No action | No drop zone indicator | Item returns to original position |
| DataPanel item → StudioPanel | StudioPanel | **No** | No action | No drop zone indicator | Item returns to original position |
| DataPanel item → Workspace View | WorkspaceView | **No** | No action | No drop zone indicator | Item returns to original position |
| External file → ChatCanvas | ChatCanvas | **Yes** | File name injected into chat input | Same as data item drop | — |
| External file → DataPanel | DataPanel | **Yes** | Triggers file upload flow | `drop-zone-active` border | — |
| External file → AddSourceDialog | AddSourceDialog | **Yes** | File added to upload queue | Bouncing upload icon, highlighted drop area | — |
| External file → StudioPanel | StudioPanel | **No** | No action | No visual feedback | File ignored |
| External file → Header | Header | **No** | No action | No visual feedback | File ignored |

### 4.4 Drag Visual States

| Phase | Visual Treatment | CSS Class / Animation |
|-------|-----------------|----------------------|
| Drag Start | Source item becomes semi-transparent (opacity 0.5) and slightly scaled down (scale 0.95) | `.dragging { opacity: 0.5; scale: 0.95; }` |
| Drag Over Valid Target | Target shows dashed blue border, pulsing glow ring, centered drop icon | `.drop-zone-active` + `drop-zone-pulse` keyframe animation |
| Drop Success | Blue border flash on target (2px solid rgba(100,160,255,0.5)), box-shadow glow; fades out over 600ms | `.drop-snap` class with fade-out animation |
| Drop Invalid | No visual change on target; dragged item snaps back to origin | Browser default behavior |
| Drag End (no drop) | Source item returns to normal opacity and scale | Remove `.dragging` class |

---

## 5. Context Switching Map

The platform uses a **Unified Canvas** model where all functionality exists within a single page (`/` route, `Home` component). Context switching happens through workspace tabs, not page navigation.

### 5.1 How the User Switches Contexts

| Switch Method | Mechanism | Animation |
|--------------|-----------|-----------|
| Click workspace tab in header | `WorkspaceContext.setActiveView(tabId)` | `AnimatedWorkspace`: directional slide (left/right based on tab position in RTL) + crossfade; 200ms exit + 280ms enter |
| Click studio tool | `chatCanvasRef.current.activateWizard(toolId)` → switches to chat tab first, then activates wizard mode | Tab switch animation + wizard slide-in |
| Type trigger keyword in chat | `handleSend()` detects keyword → sets `canvasMode` to `wizard` or `ai-presentation` | In-place mode switch within ChatCanvas |
| Click quick action in ChatCanvas | Sets appropriate engine or sends predefined prompt | In-place within ChatCanvas |
| `Ctrl+K` → select item | `CommandPalette` → `onNavigate(viewId)` | Tab switch animation |
| Drag data item to ChatCanvas | Drop handler injects text into input | No context switch (stays in current view) |
| Mobile bottom nav | `MobileBottomNav` → `setActiveView(tabId)` | Same directional slide animation |

### 5.2 What Changes Per Context

The table below shows exactly what UI regions change when the user switches between workspace contexts.

| UI Region | Chat | Data (بياناتي) | Presentations (عروضي) | Reports (تقاريري) | Dashboards (لوحاتي) | Extraction (تفريغ) | Translation (ترجمة) | Matching (مطابقة) | Library (مكتبتي) |
|-----------|------|------|------|------|------|------|------|------|------|
| **Header** | No change | No change | No change | No change | No change | No change | No change | No change | No change |
| **Active Tab Indicator** | "المحادثة" highlighted with sliding indicator | "بياناتي" highlighted | "عروضي" highlighted | "تقاريري" highlighted | "لوحاتي" highlighted | "تفريغ" highlighted | "ترجمة" highlighted | "مطابقة" highlighted | "مكتبتي" highlighted |
| **Data Panel (Right)** | No change — stays open/closed | No change | No change | No change | No change | No change | No change | No change | No change |
| **Studio Panel (Left)** | No change — stays open/closed | No change | No change | No change | No change | No change | No change | No change | No change |
| **Main Canvas Area** | `ChatCanvas` (full width) | `WorkspaceView` (data) + Chat sidebar | `WorkspaceView` (presentations) + Chat sidebar | `WorkspaceView` (reports) + Chat sidebar | `WorkspaceView` (dashboards) + Chat sidebar | `WorkspaceView` (extraction) + Chat sidebar | `WorkspaceView` (translation) + Chat sidebar | `WorkspaceView` (matching) + Chat sidebar | `WorkspaceView` (library) + Chat sidebar |
| **Chat Canvas Visibility** | Full-width center | Collapsible sidebar (360px open / 48px collapsed) | Collapsible sidebar | Collapsible sidebar | Collapsible sidebar | Collapsible sidebar | Collapsible sidebar | Collapsible sidebar | Collapsible sidebar |
| **Toolbar** | Chat input bar + options menu | WorkspaceView toolbar (view toggle, sort, filter) | WorkspaceView toolbar | WorkspaceView toolbar | WorkspaceView toolbar | WorkspaceView toolbar | WorkspaceView toolbar | WorkspaceView toolbar | WorkspaceView toolbar |

### 5.3 Context-Specific Canvas Content

Each workspace view renders different content in the main canvas area via the `WorkspaceView` component. Here is what each context displays:

| Context | Canvas Content | View Modes | Toolbar Actions | Rasid Mini Bar |
|---------|---------------|-----------|-----------------|----------------|
| **Data (بياناتي)** | Grid or list of all user files with type icons, status badges, dates | Grid / List toggle | Sort, filter by type, search within view | "اسأل راصد عن بياناتك..." |
| **Presentations (عروضي)** | Grid or list of all presentations with thumbnails, slide counts, dates | Grid / List toggle | Sort, filter, new presentation | "اسأل راصد عن عروضك..." |
| **Reports (تقاريري)** | Grid or list of all reports with type badges, page counts, dates | Grid / List toggle | Sort, filter, new report | "اسأل راصد عن تقاريرك..." |
| **Dashboards (لوحاتي)** | Grid or list of all dashboards with widget counts, dates | Grid / List toggle | Sort, filter, new dashboard | "اسأل راصد عن لوحاتك..." |
| **Extraction (تفريغ)** | Grid or list of extraction jobs with source file info, status | Grid / List toggle | Sort, filter, new extraction | "اسأل راصد عن التفريغ..." |
| **Translation (ترجمة)** | Grid or list of translation jobs with language pairs, status | Grid / List toggle | Sort, filter, new translation | "اسأل راصد عن الترجمة..." |
| **Matching (مطابقة)** | Grid or list of match results with similarity scores | Grid / List toggle | Sort, filter, new match | "اسأل راصد عن المطابقة..." |
| **Library (مكتبتي)** | Combined view of library items + user files organized by category | Grid / List toggle | Sort, filter by category | "ابحث في مكتبتك..." |

### 5.4 Engine Activation from Chat

When a user activates an engine from within ChatCanvas (via wizard or keyword), the canvas mode changes but the workspace tab does NOT change. The engine runs inside the ChatCanvas component.

| Activation Source | ChatCanvas Mode Change | Tab Change? | Side Panels Change? |
|------------------|----------------------|-------------|-------------------|
| Studio tool click | `chat` → `wizard` (with `activeEngine` set) | Yes — switches to Chat tab first | No |
| Keyword in chat input | `chat` → `wizard` or `ai-presentation` | No — already in Chat | No |
| Quick action button | Stays in `chat` (sends prompt) | No | No |
| States demo (menu) | `chat` → `states-demo` | No | No |
| Back from wizard | `wizard` → `chat` | No | No |

### 5.5 Scroll Position Preservation

The `AnimatedWorkspace` component preserves scroll positions when switching between workspace tabs. When the user returns to a previously visited tab, the scroll position is restored to where they left off. This is implemented via a `Map<string, number>` ref that stores `scrollTop` values keyed by view ID.

---

## 6. Missing Clarifications

The following items in the current design do not fully resolve implementation decisions. Each item describes what is unclear, why it blocks development, and what decision is needed.

### 6.1 Backend Integration Gaps

| # | Unclear Item | Why It Blocks Implementation | Decision Needed |
|---|-------------|------------------------------|-----------------|
| 1 | **File upload storage flow** | `AddSourceDialog` has UI for file upload but the actual upload-to-S3 flow is not wired in the dialog component. The `trpc.files.create` mutation exists but the dialog does not call it. | Decide: Should `AddSourceDialog` call `trpc.ai.uploadFile` (which handles S3) then `trpc.files.create`? Or should a dedicated `trpc.files.upload` procedure be created? |
| 2 | **Chat message persistence** | `ChatCanvas` stores messages in local `useState`. The `trpc.chat.history` and `trpc.chat.addMessage` procedures exist but are not called from the component. | Decide: Should chat messages persist to the database per conversation? If yes, when is `conversationId` created — on first message or on page load? |
| 3 | **Wizard execution output persistence** | When a wizard completes (e.g., report generation), the output is shown in ChatCanvas but the flow to save it as a permanent artifact is not always explicit. | Decide: Should wizard completion automatically create a DB record (report/presentation/dashboard), or should the user explicitly click "Save"? |
| 4 | **Real-time job status updates** | `ExecutionTimeline` shows job progress but there is no WebSocket or polling mechanism to receive real-time updates from the server. Jobs are currently simulated client-side. | Decide: Implement WebSocket for job status? Or use polling with `trpc` query + `refetchInterval`? What is the expected latency for status updates? |
| 5 | **Evidence and audit trail data source** | `EvidenceDrawer` and `InspectorPanel` receive data via props but there is no backend procedure to fetch evidence or audit trail data. Data is currently hardcoded in `Home.tsx`. | Decide: Create `trpc.jobs.getEvidence(jobId)` and `trpc.artifacts.getLineage(artifactId)` procedures? Define the database schema for evidence entries and audit trails. |

### 6.2 Permission & Authorization Gaps

| # | Unclear Item | Why It Blocks Implementation | Decision Needed |
|---|-------------|------------------------------|-----------------|
| 6 | **Role-based action gating in engines** | `ROLES_CONFIG` defines permissions (manage_users, manage_content, etc.) but engine components do not check permissions before allowing actions. All authenticated users can access all engines. | Decide: Which actions require which permissions? Should engines check `user.role` before showing action buttons? Provide a permission-to-action mapping table. |
| 7 | **Content ownership and sharing model** | Files, reports, presentations, and dashboards have `userId` foreign keys but there is no sharing model beyond presentations (which have `shared_presentations` table). | Decide: Can users share reports and dashboards with other users? If yes, define the sharing model (link-based, user-based, role-based). |
| 8 | **Admin panel write operations** | Admin panel sections (Members, Content, Media, Templates) display data but most lack mutation endpoints for admin actions (ban user, delete content, approve template). | Decide: Which admin actions should be implemented? Create corresponding `trpc.admin.*` mutation procedures. |

### 6.3 Data Model Gaps

| # | Unclear Item | Why It Blocks Implementation | Decision Needed |
|---|-------------|------------------------------|-----------------|
| 9 | **Job/Task entity missing from schema** | The UI shows `ExecutionTimeline` with jobs that have stages, progress, and status. But there is no `jobs` or `tasks` table in the database schema. | Decide: Create a `jobs` table with columns: `id`, `userId`, `capability`, `status`, `progress`, `stages` (JSON), `input` (JSON), `output` (JSON), `startedAt`, `completedAt`. |
| 10 | **Activity log schema** | Admin panel shows activity logs via `trpc.admin.recentActivity` but there is no `activity_logs` table in the schema. | Decide: Create an `activity_logs` table with: `id`, `userId`, `action`, `entityType`, `entityId`, `metadata` (JSON), `createdAt`. |
| 11 | **Notifications schema** | `NotificationContext` manages notifications client-side but there is no persistence layer. Notifications are lost on page refresh. | Decide: Create a `notifications` table? Or keep notifications ephemeral (session-only)? |
| 12 | **Spreadsheets content storage** | `ExcelEngine` manages cell data, formulas, and multiple sheets in local state. The `spreadsheets` table stores `title` and `content` (JSON) but the exact JSON structure for multi-sheet workbooks is not defined. | Decide: Define the JSON schema for `content` column: `{ sheets: [{ name, columns: [], rows: [][] }], activeSheet: number }`. |

### 6.4 UI Behavior Gaps

| # | Unclear Item | Why It Blocks Implementation | Decision Needed |
|---|-------------|------------------------------|-----------------|
| 13 | **Approval workflow** | The state matrix includes "approval pending" but there is no approval workflow in the current implementation. No approve/reject buttons exist in any component. | Decide: Is approval workflow needed for V1? If yes, define: Who approves? What artifacts need approval? What happens after approval/rejection? |
| 14 | **Publication/export flow** | `ExportState` in ChatStates shows an export progress animation but the actual export mechanism varies by engine (browser print for reports, CSV download for Excel, no export for dashboards). | Decide: Standardize export formats per artifact type. Define: Reports → PDF, Presentations → PPTX/PDF, Dashboards → PNG/PDF, Spreadsheets → CSV/XLSX. |
| 15 | **Compare view data source** | `CompareView` component accepts `leftTitle` and `rightTitle` but has no mechanism to receive actual content for comparison. | Decide: What is being compared? Source data vs. output? Two versions of the same artifact? Define the data contract for comparison content. |
| 16 | **Onboarding tour completion tracking** | `OnboardingTour` shows on first visit but there is no mechanism to track whether the user has completed the tour. | Decide: Store tour completion in `localStorage` (current implicit behavior) or in the user's database record? |
| 17 | **Mobile chat overlay behavior** | On mobile, when viewing non-chat tabs, a floating chat button appears. Clicking it switches to the chat tab. But this means the user loses their current workspace context. | Decide: Should mobile have a chat overlay/modal instead of switching tabs? Or is tab-switching the intended behavior? |
| 18 | **Template lock state** | `TemplateLockState` in ChatStates shows a locked template with "unlock" option but there is no backend concept of template locking. | Decide: Is template locking needed? If yes, define: What triggers a lock? Who can unlock? Is it time-based or permission-based? |

### 6.5 Integration Gaps

| # | Unclear Item | Why It Blocks Implementation | Decision Needed |
|---|-------------|------------------------------|-----------------|
| 19 | **Arabization vs. Translation distinction** | Both `arabization` and `translation` engines exist. Arabization uses `ai.translate` with arabization mode, but the exact difference in prompt/behavior is not defined in the backend. | Decide: Define the exact prompt difference. Is arabization = translation to Arabic with domain-specific terminology? Or is it content localization (adapting meaning, not just words)? |
| 20 | **Library element usage in AI generation** | `SlideLibraryAdmin` manages slide elements with `htmlTemplate`, `contentSlots`, and `usageRules`. The `generateHtmlPresentation` procedure attempts to match templates, but the matching algorithm and fallback behavior need specification. | Decide: Define matching priority: exact `triggerContext` match → category match → fallback to AI-generated HTML. What is the minimum `qualityRating` for a template to be used? |
| 21 | **Notification delivery mechanism** | `NotificationBell` in header shows notifications from `NotificationContext` but there is no server-push mechanism. Notifications are only generated client-side. | Decide: Implement server-sent events (SSE) or WebSocket for real-time notifications? Or poll `trpc.notifications.list` on interval? |

---

> **ملاحظة:** هذا الملحق مبني بالكامل على الكود الحالي والتصميم الموجود. لم يتم إضافة أي وظائف أو صفحات جديدة. كل بند في قسم "Missing Clarifications" يشير إلى قرار تنفيذي مطلوب لإكمال الربط بين الواجهة والخدمات الخلفية.
