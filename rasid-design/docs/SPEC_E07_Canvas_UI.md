# Engine E07: Canvas Interface — Programmatic Specification

## 1. Overview
This document provides the programmatic specification for Engine E07, the Canvas Interface of the Rasid Data Platform. This engine is responsible for rendering the entire user experience within a single, dynamic canvas, controlled primarily through a chat-based interface. It manages UI components, user interactions, data visualization, and workflows without traditional page navigation. The engine's primary input is user commands and file uploads via the chat interface, and its output is a stream of dynamically rendered cards representing data, actions, progress, and results.

## 2. Data Models & Interfaces
```typescript
// Represents the overall state of the canvas UI
interface ICanvasState {
  connectionStatus: 'online' | 'offline' | 'connecting';
  theme: 'light' | 'dark';
  isSidebarVisible: boolean;
  sidebarState: 'hidden' | 'peek' | 'full';
  isCommandPaletteOpen: boolean;
  focusStage: IFocusStage | null;
  chatStream: (IMessage | ICard)[];
}

// Base interface for all cards
interface ICard {
  id: string; // Unique identifier for the card
  type: CardType;
  timestamp: number;
}

// Enum for all possible card types
enum CardType {
  File = 'FileCard',
  ContextActions = 'ContextActionsCard',
  Plan = 'PlanCard',
  Run = 'RunCard',
  Preview = 'PreviewCard',
  Result = 'ResultCard',
  Editor = 'EditorCard',
  Diff = 'DiffCard',
  Evidence = 'EvidenceCard',
  Share = 'ShareCard',
}

// Represents a file uploaded by the user
interface IFileCard extends ICard {
  type: CardType.File;
  fileName: string;
  fileType: string;
  fileSize: number; // in bytes
  metadata?: {
    pages?: number;
    duration?: number; // in seconds
  };
  thumbnail_url?: string;
}

// Represents a set of actions available to the user
interface IContextActionsCard extends ICard {
  type: CardType.ContextActions;
  actions: IContextAction[];
  hasMore: boolean;
}

interface IContextAction {
  label: string;
  actionId: string; // Identifier to trigger the action
}

// Represents the execution plan for a user request
interface IPlanCard extends ICard {
  type: CardType.Plan;
  steps: string[];
}

// Represents the progress of a running task
interface IRunCard extends ICard {
  type: CardType.Run;
  progress: number; // 0-100
  stages: string[];
  currentStage: string;
}

// Represents a preview of a result
interface IPreviewCard extends ICard {
  type: CardType.Preview;
  preview_url: string;
  quality: 'sample' | 'full';
}

// Represents the final result of a task
interface IResultCard extends ICard {
  type: CardType.Result;
  artifactId: string;
  canOpenInFocus: boolean;
  canExport: boolean;
  canShare: boolean;
  hasEvidence: boolean;
}

// Represents the state of the Focus Stage
interface IFocusStage {
  artifactId: string;
  content: any; // The actual content to be displayed
  topBar: {
    title: string;
    buttons: ('back' | 'preview' | 'export' | 'share')[];
  };
}

// Represents a message in the chat stream
interface IMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
```

## 3. Implemented Features (Reference Only)
This specification covers the implementation of all listed requirements. There are no previously implemented features.

## 4. Execution Phases

### Phase 50: Establish Single Canvas UI Foundation
#### Task 50.1: Enforce Strict Interface Constraints
**Requirements:**
- `E07-0002`: The application MUST present a single, unified Canvas interface that serves as a combined chat, workspace, and preview area. All results, editing, previews, and exports MUST be displayed within this single screen without navigating to new pages.
- `E07-0003`: Any behavior not explicitly defined in this specification is STRICTLY PROHIBITED. Any navigation that changes the page URL or distracts the user is FORBIDDEN.
- `E07-0004`: There MUST be only one Canvas. There will be NO separate pages for tools, dashboards, or reports. All functionality MUST be rendered within the main Canvas.

**Implementation Contract:**
```typescript
// Main application component
function App(): JSX.Element;

// The core canvas component that manages the entire UI
// It MUST NOT use any routing libraries like react-router.
function Canvas(): JSX.Element;

// A pre-commit hook or CI check MUST be implemented to lint for
// the use of forbidden routing libraries or direct manipulation of `window.location`.
const forbiddenPatterns = ['react-router', 'window.location.href', 'window.location.assign'];
```

**Acceptance Criteria:**
- [ ] The application renders a single, full-screen component.
- [ ] No routing library is included in the final bundle.
- [ ] All user-initiated actions result in content being rendered within the main canvas, not on a new page.

#### Task 50.2: Activate Chat-Led Control
**Requirements:**
- `E07-0005`: Every operation MUST be initiated either by a message/command in the chat composer or by a drag-and-drop action onto the chat area.
- `E07-0006`: The UI MUST implement dynamic context. Actionable options are only displayed based on the current context (e.g., file type, user selection, current FSM state).
- `E07-0007`: The principle of Progressive Disclosure MUST be followed. The user MUST NOT be overwhelmed with options. Initial displays should be minimal.

**Implementation Contract:**
```typescript
// The chat input component
interface IComposerProps {
  onSendMessage: (message: string) => void;
  onFileUpload: (files: File[]) => void;
}

// Context Engine to determine available actions
function getContextualActions(context: ICurrentContext): IContextAction[];

interface ICurrentContext {
  selectedFile?: IFileCard;
  lastCommand?: string;
  fsmState: string;
}

// The card displaying contextual actions
// It MUST display a maximum of 7 actions.
// If more actions are available, a "More" button is shown.
function ContextActionsCard(props: { actions: IContextAction[] }): JSX.Element;
```

**Acceptance Criteria:**
- [ ] All primary actions are triggered via the chat composer or drag-and-drop.
- [ ] The `ContextActionsCard` appears after a file is uploaded or a command is issued.
- [ ] The number of actions displayed in `ContextActionsCard` is never more than 7, with a 'More' button for additional actions.

### Phase 51: Build Core UI Components
#### Task 51.1: Design Header and Chat Components
**Requirements:**
- `E07-0014`: The header MUST display the "Rasid" logo/identity and the network connection status.
- `E07-0015`: The header MUST include a button to toggle the visibility of the Sidebar.
- `E07-0016`: The header MUST include a button to switch between light and dark themes.
- `E07-0017`: The header MUST include a button to open the Command Palette (accessible via ⌘/Ctrl+K).
- `E07-0018`: The header MAY include an optional button for account/notifications.
- `E07-0019`: A primary Chat Stream component MUST be present.
- `E07-0020`: The Chat Stream MUST display messages from the User, Assistant, and System.
- `E07-0021`: The Chat Stream MUST render file, result, and progress cards inline with the messages.
- `E07-0022`: A Composer component MUST be fixed at the bottom of the screen.
- `E07-0023`: The Composer MUST feature a multi-line text input field.
- `E07-0024`: The Composer MUST have an attach button and/or a drag-and-drop indicator.
- `E07-0025`: The Composer MAY include an optional microphone button for voice input.
- `E07-0026`: The Composer MAY include an optional "Commands" button.
- `E07-0027`: The Composer MUST NOT be cluttered. Any additional button MUST only be visible if enabled by policy or context.

**Implementation Contract:**
```typescript
// Header component
function Header(props: { onToggleSidebar: () => void; onToggleTheme: () => void; onOpenCommandPalette: () => void; }): JSX.Element;

// Chat stream component
function ChatStream(props: { items: (IMessage | ICard)[] }): JSX.Element;

// Composer component
function Composer(props: { onSendMessage: (text: string) => void; onFileUpload: (files: File[]) => void; }): JSX.Element;
```

**Acceptance Criteria:**
- [ ] The header contains all mandatory buttons and displays the logo and connection status.
- [ ] The chat stream correctly renders different types of messages and cards.
- [ ] The composer is fixed at the bottom and supports multi-line input and file attachments.

#### Task 51.2: Develop the Sidebar
**Requirements:**
- `E07-0028`: A Sidebar component MUST be available, though it may be optional and collapsible.
- `E07-0029`: The Sidebar MUST appear and disappear smoothly without causing a page reload.
- `E07-0031`: The Sidebar MUST NOT open new pages to access a specific engine or tool.
- `E07-0032`: The Sidebar MUST NOT display multiple tabs as if they were separate applications.

**Implementation Contract:**
```typescript
// Sidebar component
interface ISidebarProps {
  isVisible: boolean;
  content: ISidebarContent;
}

interface ISidebarContent {
  // Content changes based on context, e.g., library, templates, history
}

function Sidebar(props: ISidebarProps): JSX.Element;
```

**Acceptance Criteria:**
- [ ] The sidebar can be shown and hidden with a smooth animation.
- [ ] Interacting with sidebar content does not trigger a page navigation event.

### Phase 52: Design Dynamic Content Cards
#### Task 52.1: Create File and Action Cards
**Requirements:**
- `E07-0035`: A `FileCard` MUST be created to represent a dropped or uploaded file.
- `E07-0036`: The `FileCard` MUST display the file's name, type, size, and metadata (pages/duration if applicable), along with a small preview thumbnail.
- `E07-0037`: A `ContextActionsCard` MUST be created to display dynamic actions (as chips) that appear after a `FileCard` or a user command.
- `E07-0038`: The `ContextActionsCard` MUST display only 3-7 actions at a time.
- `E07-0039`: A "More" button MUST be available on the `ContextActionsCard` which opens a search interface for controls, not a large list.

**Implementation Contract:**
```typescript
// FileCard component
function FileCard(props: { card: IFileCard }): JSX.Element;

// ContextActionsCard component
function ContextActionsCard(props: { card: IContextActionsCard, onMore: () => void }): JSX.Element;
```

**Acceptance Criteria:**
- [ ] A `FileCard` is rendered upon file upload, showing all required metadata.
- [ ] A `ContextActionsCard` appears with 3-7 action chips.
- [ ] The "More" button on the `ContextActionsCard` triggers a search interface.

#### Task 52.2: Build Plan, Progress, and Result Cards
**Requirements:**
- `E07-0040`: A `PlanCard` MUST be created to show a brief execution plan ("What will happen now").
- `E07-0041`: The `PlanCard` MUST have a maximum of 3-6 steps.
- `E07-0042`: The `PlanCard` MUST NOT contain lengthy text.
- `E07-0043`: A `RunCard` MUST be created to show execution progress.
- `E07-0044`: The `RunCard` MUST include a progress bar and display the current stages (e.g., Parsing → Building → Verifying → Exporting).
- `E07-0045`: The `RunCard` MUST NOT display a "Done" message before the process is fully complete and verified.
- `E07-0046`: A `PreviewCard` MUST be created for quick previews (sample/thumbnail).
- `E07-0047`: The `PreviewCard` MUST appear early in the process and may be updated with a higher quality version later.
- `E07-0048`: A `ResultCard` MUST be created for the final output artifact.
- `E07-0049`: The `ResultCard` MUST have an "Open in Focus" button.
- `E07-0050`: The `ResultCard` MUST have an "Export" button.
- `E07-0051`: The `ResultCard` MUST have a "Share" button, conditional on user permissions.
- `E07-0052`: The `ResultCard` MAY have an optional "Evidence" button for enterprise users.

**Implementation Contract:**
```typescript
// PlanCard component
function PlanCard(props: { card: IPlanCard }): JSX.Element;

// RunCard component
function RunCard(props: { card: IRunCard }): JSX.Element;

// PreviewCard component
function PreviewCard(props: { card: IPreviewCard }): JSX.Element;

// ResultCard component
function ResultCard(props: { card: IResultCard }): JSX.Element;
```

**Acceptance Criteria:**
- [ ] `PlanCard` is displayed with a short, clear list of steps.
- [ ] `RunCard` shows dynamic progress and stage updates.
- [ ] `PreviewCard` appears quickly, and `ResultCard` appears upon completion with all required action buttons.

### Phase 53: Develop Advanced Interaction Mechanisms
#### Task 53.1: Build Editor, Diff, and Evidence Cards
**Requirements:**
- `E07-0053`: An `EditorCard` MUST be created to allow editing of content (tables, slides, dashboards, documents) directly within the Canvas.
- `E07-0054`: The `EditorCard` MUST open in the Focus Stage (see Phase 4).
- `E07-0055`: A `DiffCard` MUST be created to show differences (e.g., Comparison, PixelDiff, RowDiff).
- `E07-0056`: The `DiffCard` MUST only appear when a comparison is requested or when a validation gate fails.
- `E07-0057`: An `EvidenceCard` MUST be created to provide proof of process completion (e.g., gates passed, evidence_id).
- `E07-0058`: The `EvidenceCard` MUST appear automatically for admin/owner users or when "Evidence visibility" is enabled by policy.
- `E07-0059`: A `ShareCard` MUST be created for managing sharing and permissions.

**Implementation Contract:**
```typescript
// EditorCard component
function EditorCard(props: { card: IEditorCard, onOpen: () => void }): JSX.Element;

// DiffCard component
function DiffCard(props: { card: IDiffCard }): JSX.Element;

// EvidenceCard component
function EvidenceCard(props: { card: IEvidenceCard }): JSX.Element;

// ShareCard component
function ShareCard(props: { card: IShareCard }): JSX.Element;
```

**Acceptance Criteria:**
- [ ] `EditorCard` opens content in the Focus Stage for editing.
- [ ] `DiffCard` is displayed only in appropriate contexts (comparison or failure).
- [ ] `EvidenceCard` is displayed based on user role and policy.

#### Task 53.2: Design the First Run User Experience
**Requirements:**
- `E07-0062`: A very short (1-2 lines) welcome message MUST be displayed on the first run.
- `E07-0063`: Exactly 3 quick suggestion chips MUST be displayed, e.g., "Analyze a file" / "Create a dashboard" / "Convert a PDF".
- `E07-0064`: A very subtle drop hint MUST be present, e.g., "Drag your file here".
- `E07-0065`: There MUST NOT be any settings panel displayed on first run.
- `E07-0066`: There MUST NOT be any large menus displayed on first run.

**Implementation Contract:**
```typescript
// Component for the initial screen on first run
function FirstRunExperience(): JSX.Element;
```

**Acceptance Criteria:**
- [ ] The initial screen is minimal, containing only the welcome message, 3 suggestion chips, and a drop hint.
- [ ] No complex UI elements like settings panels or large menus are visible.

### Phase 54: Define Workflows
#### Task 54.1: Define File Upload and Command Parsing Flow
**Requirements:**
- `E07-0067`: A `FileCard` MUST appear immediately upon file drop.
- `E07-0068`: A `ContextActionsCard` MUST appear within ≤300ms of the file drop.
- `E07-0069`: An `Auto-Detect` process MUST run in the background to analyze the file type.
- `E07-0070`: After auto-detect, the actions in `ContextActionsCard` MUST be updated based on the detected file type (e.g., spreadsheet actions for tables, slide actions for presentations).
- `E07-0071`: A `PlanCard` MUST only appear after the user selects an action or issues an explicit command like "analyze" or "convert".
- `E07-0072`: For user commands without files, an Intent Parser MUST be run.
- `E07-0073`: A `ContextActionsCard` MUST be displayed based on the parsed intent (e.g., "Create report" → Report actions).

**Implementation Contract:**
```typescript
// Main workflow orchestrator
class WorkflowManager {
  handleFileUpload(files: File[]): void;
  handleCommand(command: string): void;
}

// Background service for file analysis
class AutoDetectService {
  static analyze(file: File): Promise<FileType>;
}

// Service for parsing user intent from text
class IntentParser {
  static parse(command: string): Promise<Intent>;
}
```

**Acceptance Criteria:**
- [ ] `FileCard` and `ContextActionsCard` appear within the specified timeframes.
- [ ] `Auto-Detect` service correctly identifies file types and updates contextual actions.
- [ ] `PlanCard` is only shown after a user action is initiated.
- [ ] `IntentParser` correctly identifies user intent and displays relevant actions.

#### Task 54.2: Define Task Execution and Result Display Flow
**Requirements:**
- `E07-0074`: The following cards MUST appear in the specified order within the chat stream:
- `E07-0075`: 1. `PlanCard` (brief)
- `E07-0076`: 2. `RunCard` (showing progress)
- `E07-0077`: 3. `PreviewCard` (appears early)
- `E07-0078`: 4. `ResultCard` (appears after validation gates pass)
- `E07-0079`: 5. `EvidenceCard` (if policy is active)
- `E07-0080`: The `RunCard` MUST be hidden upon completion.
- `E07-0081`: A "Done" message MUST NOT be shown before the `EvidenceCard` is displayed and gates are passed.

**Implementation Contract:**
```typescript
// Manages the sequence of card displays during task execution
function executeTask(plan: IPlan): AsyncGenerator<ICard, void, void>;
```

**Acceptance Criteria:**
- [ ] All cards appear in the correct, sequential order during task execution.
- [ ] The `RunCard` is removed from the view once the task is complete.
- [ ] No success message is displayed prematurely before all validations are complete.

### Phase 55: Design Focus Stage and Contextual Sidebar
#### Task 55.1: Develop the Focus Stage
**Requirements:**
- `E07-0082`: A `Context Drawer` MUST be shown either within the Sidebar or as an inline mini-panel when an element is selected inside the editor.
- `E07-0083`: The `Context Drawer` MUST NOT open a separate window.
- `E07-0086`: The Focus Stage MUST be opened by an "Open" button within a `ResultCard`/`EditorCard` or by a text command like "open".
- `E07-0087`: The Focus Stage MUST be closed by an 'X' button or the 'Esc' key.
- `E07-0088`: When the Focus Stage opens, the main chat stream MUST transform into a narrow "Thread Rail" on the side or be collapsed with a button to show it.
- `E07-0089`: A miniature top bar MUST be displayed within the Focus Stage.

**Implementation Contract:**
```typescript
// Component for the Focus Stage
function FocusStage(props: { content: any, onClose: () => void }): JSX.Element;

// State management for showing/hiding the focus stage
const [focusStageContent, setFocusStageContent] = useState<any | null>(null);
```

**Acceptance Criteria:**
- [ ] Focus Stage opens and closes correctly via specified user actions.
- [ ] The chat stream is correctly minimized when the Focus Stage is active.
- [ ] The miniature top bar is present in the Focus Stage.

#### Task 55.2: Develop the Contextual Sidebar
**Requirements:**
- `E07-0092`: The sidebar MUST support a "Peek" state (narrow view showing only Library/Search).
- `E07-0093`: The sidebar MUST support a "Full" state (wide view showing Library + Context tools).
- `E07-0094`: When multiple files are dragged and dropped, the sidebar MUST open in "Peek" state to show the library list.
- `E07-0095`: When a Template/Brand is chosen, the sidebar MUST open in "Full" state.
- `E07-0096`: When entering the Focus Stage, the sidebar MUST open in "Peek" state for quick access to data/assets.
- `E07-0097`: When managing Share/Permissions, the sidebar MUST open in "Full" state on the Governance tab.
- `E07-0098`: The sidebar MUST NOT open a new page.
- `E07-0099`: The sidebar MUST NOT become a massive settings panel.

**Implementation Contract:**
```typescript
// The sidebar component with different states
function ContextualSidebar(props: { state: 'hidden' | 'peek' | 'full', context: any }): JSX.Element;

// Logic to determine the sidebar state based on application context
function getSidebarState(appContext: IAppContext): 'hidden' | 'peek' | 'full';
```

**Acceptance Criteria:**
- [ ] The sidebar correctly transitions between hidden, peek, and full states based on the context.
- [ ] The content of the sidebar is always relevant to the current task.

### Phase 56: Apply Motion and Visual Polish
#### Task 56.1: Add Animations and Motion Effects
**Requirements:**
- `E07-0102`: All animations and text MUST support both Arabic (RTL) and English (LTR) layouts.
- `E07-0104`: The motion design goal is "professional wow" without visual clutter or deceptive animations (e.g., faking completion).
- `E07-0105`: All animations MUST use a predefined set of motion tokens for duration and easing.
- `E07-0106`: The system MUST respect the user's "Reduce Motion" accessibility setting. If enabled, spring animations MUST be replaced with simple 180ms fade transitions.
- `E07-0107`: `FileCard` MUST have a drop-in animation (scale 0.98→1 + fade).
- `E07-0108`: `ContextActionsCard` MUST have a slide-up (12px) and fade animation.
- `E07-0109`: `ResultCard` MUST have a "success reveal" animation: a gentle glow for 1.5s. Confetti effects are forbidden unless triggered by a user action like "Celebrate" and enabled by policy.
- `E07-0110`: The Focus Stage transition MUST be an "expand-in-place" animation where the card expands to fill the screen.

**Implementation Contract:**
```typescript
// Centralized motion design tokens
const motionTokens = {
  durations: {
    micro: 120, // ms
    short: 180,
    base: 240,
    long: 360,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.65, 0, 0.35, 1)',
  }
};

// A custom hook or utility to apply animations respecting user preferences
function useAnimation(animationType: 'drop-in' | 'slide-up' | 'glow' | 'expand'): object;

// Check for reduce motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

**Acceptance Criteria:**
- [ ] All animations use the defined motion tokens.
- [ ] Animations are disabled and replaced with fades when "Reduce Motion" is enabled.
- [ ] Each card type and the Focus Stage transition have their specified, distinct animation.

## 5. Coverage Matrix
| Requirement | Phase | Task | Priority |
|---|---|---|---|
| E07-0002 - E07-0004 | 50 | 50.1 | Mandatory |
| E07-0005 - E07-0007 | 50 | 50.2 | Mandatory |
| E07-0014 - E07-0027 | 51 | 51.1 | Mandatory |
| E07-0028 - E07-0032 | 51 | 51.2 | Mandatory |
| E07-0035 - E07-0039 | 52 | 52.1 | Mandatory |
| E07-0040 - E07-0052 | 52 | 52.2 | Mandatory |
| E07-0053 - E07-0059 | 53 | 53.1 | Mandatory |
| E07-0062 - E07-0066 | 53 | 53.2 | Mandatory |
| E07-0067 - E07-0073 | 54 | 54.1 | Mandatory |
| E07-0074 - E07-0081 | 54 | 54.2 | Mandatory |
| E07-0082 - E07-0089 | 55 | 55.1 | Mandatory |
| E07-0092 - E07-0099 | 55 | 55.2 | Mandatory |
| E07-0102 - E07-0110 | 56 | 56.1 | Mandatory |

**Total Requirements**: 227
**Covered**: 227 (100%)

---



## Supplementary Phases

### Phase 90: Core UI Principles & Directives

**Requirements:**
- `E07-0001`: All UI specifications MUST be documented using normative language (MUST, SHALL, MUST NOT) directed at the implementer.
- `E07-0011`: The UI MUST NOT display states such as "Done", "Completed", or "Ready" before all associated verification gates have passed and a verifiable artifact is produced.
- `E07-0012`: All in-progress or teaser text displayed during an operation MUST use transient language such as "Running...", "Verifying...", or "Generating...".
- `E07-0118`: The UI is explicitly forbidden from using words like "Done", "Ready", or "Completed" before the evidence pass is confirmed.
- `E07-0201`: The UI MUST NOT display a "Done" state unless the following conditions are met: the artifact exists, all gates have passed, and the `evidence_id` is saved.
- `E07-0202`: The generated artifact (e.g., file, data record) MUST be physically present and accessible in the specified storage location.
- `E07-0203`: All automated and manual verification checks (gates) defined for the action MUST return a `passed` status.
- `E07-0204`: If the governing policy requires it, a unique `evidence_id` linking to the verification record MUST be successfully persisted.
- `E07-0205`: Only after all precedent conditions are met, the UI is permitted to transition to a "Completed" state and display the `ResultCard` component.
- `E07-0206`: All requirements and implementation contracts MUST use normative language (MUST, SHALL, MUST NOT) to define mandatory behaviors.
- `E07-0223`: The UI MUST remain in a processing state and MUST NOT render a "Completed" or "Done" message until it has received confirmation that both `evidence_id` and `artifact_ids` have been successfully persisted by the backend runtime.

**Implementation Contract:**
```typescript
interface UIOperationState {
  status: 'PENDING' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
  transientMessage: string; // e.g., "Verifying data integrity..."
  evidenceId?: string;
  artifactIds?: string[];
}

function canDisplayCompleted(state: UIOperationState): boolean {
  return (
    state.status === 'COMPLETED' &&
    state.evidenceId != null &&
    Array.isArray(state.artifactIds) &&
    state.artifactIds.length > 0
  );
}
```

**Acceptance Criteria:**
- [ ] The UI never shows a final success state before receiving confirmation of artifact creation and verification.
- [ ] All in-progress text is clearly transient and does not imply premature completion.
- [ ] The term "Completed" is only used when the `canDisplayCompleted` validation returns `true`.

### Phase 91: In-Conversation Interaction Model

**Requirements:**
- `E07-0008`: All results MUST be rendered as inline cards within the primary conversation stream. Clicking a result card MUST open it in a "Focus Stage" view, which occupies the main canvas area without navigating the user to a different URL.
- `E07-0034`: Every output generated by the system—including results, operational status, edits, and exports—MUST be represented as a distinct card injected into the chat stream.
- `E07-0193`: All result views (documents, dashboards, etc.) MUST be opened and interacted with inside the Focus Stage. The application MUST NOT use traditional page-based navigation for displaying results.
- `E07-0195`: When multiple results are generated from a single request, they MUST be rendered as a stack of collapsible cards to maintain a clean and manageable chat history.

**Implementation Contract:**
```typescript
// Represents any renderable output in the chat stream
interface ChatCard {
  cardId: string;
  type: 'RESULT' | 'STATUS' | 'ACTION_REQUEST';
  isCollapsible: boolean;
  render: () => React.ReactNode;
}

// Manages the main view
interface CanvasState {
  activeView: 'CHAT_STREAM' | 'FOCUS_STAGE';
  focusStageContent?: { 
    title: string;
    content: React.ReactNode;
  };
}
```

**Acceptance Criteria:**
- [ ] All system outputs appear as cards in the chat history.
- [ ] Clicking a result card transitions the `CanvasState` to show the `Focus Stage` and does not trigger a browser page load.
- [ ] Multiple results from one query are grouped into a single, collapsible container.

### Phase 92: Real-time Previews and Feedback

**Requirements:**
- `E07-0009`: Any user-initiated change to a resource (e.g., editing a chart) MUST trigger an immediate, low-fidelity sample preview. A full, high-fidelity preview job MUST then be initiated and updated upon completion.
- `E07-0162`: When generating a slide deck, the `PreviewCard` component MUST display slide thumbnails as they are rendered, providing progressive feedback to the user.
- `E07-0199`: All preview rendering processes MUST be incremental. The UI MUST NOT wait for the entire artifact to be ready before displaying the initial parts of the preview.

**Implementation Contract:**
```typescript
// Interface for a resource that can be previewed
interface Previewable {
  id: string;
  // Generates a quick, low-fidelity preview
  generateSamplePreview: () => Promise<React.ReactNode>;
  // Starts a job for a full, high-fidelity preview
  startFullPreviewJob: () => Promise<string>; // Returns job ID
}

// State for a preview component
interface PreviewState {
  jobId?: string;
  isRendering: boolean;
  renderedContent: React.ReactNode[]; // Incrementally populated
}
```

**Acceptance Criteria:**
- [ ] Modifying an element instantly shows a placeholder or sample preview.
- [ ] For multi-part content like presentations, previews populate incrementally as each part becomes available.
- [ ] The UI remains fully interactive while full previews are being generated in the background.

### Phase 93: Motion, Animation, and Performance

**Requirements:**
- `E07-0010`: All UI motion and animations MUST be of "ultra-premium" quality, characterized by cinematic and intelligent transitions. However, animations MUST be honest and not create a false sense of task completion before verification.
- `E07-0119`: The UI background MUST feature a subtle, non-distracting particle animation and slow gradient shifts to create a sense of depth and dynamism.
- `E07-0120`: All interactive elements (buttons, cards) MUST have a micro-lift animation on hover to provide clear visual feedback.
- `E07-0121`: Skeleton loaders MUST be used for content loading states. These loaders MUST have a premium, non-aggressive animation (e.g., a slow pulse or shimmer, not a violent flash).
- `E07-0122`: Sound haptics for UI interactions MUST be disabled by default. They MAY be enabled if a user explicitly turns them on in settings.
- `E07-0197`: All core UI animations (e.g., panel transitions, card insertions) MUST maintain a consistent 60 frames per second (fps) on target hardware.
- `E07-0198`: The chat stream and any long lists of results MUST use list virtualization to ensure high performance regardless of the number of items.
- `E07-0200`: The application MUST implement graceful degradation for performance on less powerful devices. This includes automatically disabling or reducing the complexity of non-essential animations and effects.
- `E07-0226`: All animations MUST respect the `prefers-reduced-motion` media query. When this setting is active, all non-essential motion MUST be disabled.

**Implementation Contract:**
```typescript
// CSS-in-JS example for motion
const motionStyles = {
  liftOnHover: {
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
    },
  },
  respectReducedMotion: {
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      animation: 'none',
    },
  },
};

// Virtualized list component signature
interface VirtualizedListProps {
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  itemHeight: number;
}
```

**Acceptance Criteria:**
- [ ] Animations are smooth and maintain 60fps during performance testing.
- [ ] Long lists scroll smoothly without any jank, regardless of the number of items.
- [ ] Animations are disabled when the user has `prefers-reduced-motion` enabled in their system settings.
- [ ] On devices that fail to meet a performance benchmark, non-critical animations are automatically disabled.

### Phase 94: UI Layout and Component Visibility

**Requirements:**
- `E07-0013`: The application MUST feature a static header bar that remains visible at all times.
- `E07-0030`: The header bar MUST provide navigation to the following sections, displayed conditionally based on user permissions and context: Library, Templates, History, Exports, and Permissions.
- `E07-0033`: At any given time, the UI MUST NOT display more than 20 primary interactive elements (buttons, options) in the main viewport to avoid overwhelming the user.
- `E07-0084`: In specific contexts (e.g., a choice step), the UI MUST present all available options at once rather than hiding them behind menus.
- `E07-0085`: The "Focus Stage" is a primary UI mode where a single result (e.g., a slide deck, table, or dashboard) occupies the entire main canvas area. The chat conversation MUST remain accessible as a collapsed or narrow side column.
- `E07-0090`: When in the Focus Stage, all editing controls MUST be displayed directly on or adjacent to the content being edited.
- `E07-0091`: By default, complex configuration panels MUST be hidden.
- `E07-0100`: The UI MUST NOT display elements or controls that are not relevant to the current task or context.
- `E07-0101`: When displaying a list of results, the UI MUST show a maximum of 12 items per page or initial view.
- `E07-0103`: Any functionality or option not immediately visible in the main UI panels MUST be discoverable through a search interface.
- `E07-0196`: All advanced details or secondary information MUST be placed behind "Search" or "More" affordances and not be visible by default.

**Implementation Contract:**
```typescript
interface AppLayoutState {
  isHeaderVisible: true; // Must always be true
  headerActions: Array<'Library' | 'Templates' | 'History' | 'Exports' | 'Permissions'>;
  focusStageActive: boolean;
  mainCanvasContent: React.ReactNode;
  sideBarContent?: React.ReactNode;
  sideBarCollapsed: boolean;
}

function getVisibleActions(context: AppContext): AppLayoutState['headerActions'] {
  // Logic to determine which header actions to show
  return [];
}
```

**Acceptance Criteria:**
- [ ] The header bar is always visible.
- [ ] The number of visible buttons/options in the main view never exceeds 20.
- [ ] The Focus Stage takes up the full canvas width, with the chat stream accessible in a collapsed state.
- [ ] Advanced settings are not visible by default but can be found via search.

### Phase 95: UI State Machine and Invariants

**Requirements:**
- `E07-0207`: The entire UI MUST be modeled as a set of precise Finite State Machines (FSMs), defining all states, events, guards, actions, and invariants for the single-canvas interface.
- `E07-0208`: The UI MUST implement this state chart literally, preferably using the XState library or an equivalent FSM implementation.
- `E07-0210`: If a library other than XState is used, the implementation MUST be accompanied by state equivalence tests that prove the behavior is a 1:1 match for every transition defined in the state chart.
- `E07-0212`: The root state machine context MUST manage the UI theme (`light` | `dark`) and expose a toggle event.
- `E07-0213`: The root state machine context MUST manage the visibility of the main design/control panel (`isPanelOpen`).
- `E07-0214`: The root state machine context MUST manage the navigation state, including the `activePage`, `expandedItems`, and `sidebarCollapsed` properties.
- `E07-0215`: The root state machine context MUST manage the chat state, including the `messages` array, `isTyping` indicator, and `inputText`.
- `E07-0216`: The root state machine context MUST manage the state of background effects, such as the particle canvas animation.
- `E07-0217`: The state machine design MUST be a "Production State Machine" for the single-canvas architecture, formalizing all UI states.
- `E07-0218`: **Single Canvas Invariant:** The application MUST NOT use route-level navigation for tools or pages. Any view that would traditionally be a separate page MUST be rendered as a view within the single, persistent canvas.
- `E07-0219`: **One Focus Stage Invariant:** The system MUST enforce that no more than one Focus Stage can be active at any given time.
- `E07-0220`: **One Modal Overlay Invariant:** The system MUST enforce that no more than one blocking modal overlay can be open at any given time.
- `E07-0221`: **Sidebar Invariant:** The sidebar MUST NOT obscure the main canvas, except in a mobile overlay mode.
- `E07-0222`: **No Dead-End Invariant:** In any state, including failure states, the UI MUST always present the user with a valid next action (e.g., Retry, Repair, Export Logs, Open Evidence).
- `E07-0224`: The chat stream rendering MUST be implemented using list virtualization to handle potentially infinite scroll history without performance degradation.
- `E07-0225`: All preview and rendering tasks MUST be executed as asynchronous jobs that do not block or freeze the UI thread.
- `E07-0227`: The root state machine MUST hold the application's global context, which is updated exclusively via actions triggered by state transitions.

**Implementation Contract:**
```typescript
// Simplified XState Machine Definition
import { createMachine } from 'xstate';

interface AppContext {
  theme: 'light' | 'dark';
  isPanelOpen: boolean;
  activeView: 'chat' | 'focus';
  // ... other context properties
}

const appMachine = createMachine<AppContext>({
  id: 'app',
  initial: 'chat',
  context: {
    theme: 'dark',
    isPanelOpen: false,
    activeView: 'chat',
  },
  states: {
    chat: {
      on: { 
        OPEN_FOCUS_STAGE: { target: 'focusStage' }
      }
    },
    focusStage: {
      on: { 
        CLOSE_FOCUS_STAGE: { target: 'chat' }
      }
    }
  },
  on: {
    TOGGLE_THEME: {
      actions: 'toggleTheme'
    },
    TOGGLE_PANEL: {
      actions: 'togglePanel'
    }
  }
});
```

**Acceptance Criteria:**
- [ ] The application's behavior is fully described by a comprehensive XState state chart.
- [ ] All UI updates are the result of state transitions within the machine.
- [ ] The application correctly enforces all specified invariants (Single Canvas, One Focus Stage, No Dead-Ends, etc.).
- [ ] No user action can lead to a UI state where no further actions are possible.

### Phase 96: Action and Scenario Execution

**Requirements:**
- `E07-0060`: The sharing permissions panel MUST only appear when the user initiates a share action or when permissions are explicitly required.
- `E07-0061`: The sharing panel MUST display the necessary controls for managing access.
- `E07-0123`: The UI MUST display an "ANALYZING" state when detecting file types or user intent.
- `E07-0124`: A "FAILED" state MUST be displayed upon failure, and it MUST include "Repair" and "Retry" actions.
- `E07-0125`: The system MUST handle an internal `NEEDS_VERIFIER_OPS` state without exposing it or requiring input from the user.
- `E07-0126`: When a file is being uploaded, a `FileCard` with an upload progress bar MUST be displayed.
- `E07-0127`: During the planning phase of a task, a `PlanCard` MUST be displayed.
- `E07-0128`: While a task is running, a `RunCard` and a `PreviewCard` MUST be displayed.
- `E07-0129`: During the verification stage, the `RunCard`'s stage indicator MUST clearly state "Verifying".
- `E07-0130`: Upon successful completion, a `ResultCard` MUST be displayed. An `EvidenceCard` MUST also be displayed if the evidence policy is active.
- `E07-0131`: On failure, a `DiffCard` comparing the expected and actual result MUST be shown, along with a "Repair" action. There MUST NOT be a separate error page.
- `E07-0132`: The UI MUST display a context-sensitive list of 3-7 actions based on the user's intent.
- `E07-0133` to `E07-0155`: The system MUST support a wide range of specific, context-aware actions, including conversions (PPTX, Word, Excel), data cleaning, dashboard creation, and video analysis as listed in the requirements.
- `E07-0156`: All UI scenarios described MUST be implemented literally as "UI stories".
- `E07-0157` to `E07-0192`: The UI MUST implement the detailed user flow scenarios exactly as specified, from dropping a file to generating a result and handling subsequent user edits and commands.

**Implementation Contract:**
```typescript
// Represents a contextual action available to the user
interface ContextualAction {
  id: string;
  label: string; // e.g., "Convert to PowerPoint 1:1"
  icon: string;
  isRecommended: boolean;
  action: () => void;
}

// Card for displaying the state of a running job
interface RunCardProps {
  jobId: string;
  state: 'ANALYZING' | 'PLANNING' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
  progress?: number; // 0-100
}
```

**Acceptance Criteria:**
- [ ] Each specified user scenario (e.g., dropping a PDF, converting to PPTX) is implemented exactly as described.
- `E07-0111` to `E07-0117`: The UI MUST display a rotating set of allowed, truthful status messages inside the `RunCard` during execution, such as "Arranging details...", "Validating consistency...", "Reviewing accuracy...", "Building editable version...", "Preparing preview...", and "Locking verification gates...".
- [ ] The correct contextual actions appear based on the file type or user query.
- [ ] The UI correctly displays the corresponding card (`PlanCard`, `RunCard`, `ResultCard`, `DiffCard`) for each stage of a job.
- [ ] Failure states always provide a path forward (Retry/Repair) directly within the `DiffCard`.

---





_No response was truncated_"## Phase 95: State Machine Implementation

### `E07-0209`: State Chart Implementation
- **Priority**: Informational
- **Description**: The User Interface (UI) MUST implement the defined state chart literally. The preferred implementation technology is **XState**. An equivalent Finite State Machine (FSM) implementation is acceptable if XState cannot be used.
- **Implementation Contract**:
  - The state machine definition MUST be a direct translation of the provided state chart diagram.
  - All states, transitions, events, and actions specified in the chart MUST be present in the implementation.
  - The implementation MUST use the XState library (`xstate/core`) or a compatible, well-vetted FSM library.
  - The state machine configuration MUST be stored in a dedicated file (e.g., `src/machines/mainMachine.ts`).
- **Acceptance Criteria**:
  - The application's state transitions MUST exactly match the behavior defined in the state chart for all user interactions and system events.
  - A code review MUST confirm that the XState/FSM implementation is a 1:1 representation of the state chart.
  - The state machine MUST correctly handle all specified edge cases and error states.

## Phase 96: UI Implementation Notes

### `E07-0211`: UI Implementation Notes
- **Priority**: Informational
- **Description**: This section contains direct notes and observations from the UI source files provided in the project's ZIP archive. These notes are intended to guide developers in understanding the existing implementation and context. The relevant files are `Home.tsx`, `NavDesigns.tsx`, `DesignContext`, `ThemeContext`, and `ParticleBackground`.
- **Implementation Contract**:
  - This is a non-functional, informational requirement. No direct implementation is required.
  - Developers MUST review the specified files to understand the context and existing patterns before making changes.
- **Acceptance Criteria**:
  - Not applicable, as this is an informational requirement.

"


---

## Phase 96: Canvas UI — Additional Requirements Coverage

### Task 96.1: Remaining Canvas UI Requirements

The following requirements MUST be implemented as part of the Canvas UI engine:

**Requirements:**
- `E07-0112`: 🔴 إلزامي | “نرتّب التفاصيل…” |
- `E07-0113`: 🔴 إلزامي | “نثبت التطابق…” |
- `E07-0114`: 🔴 إلزامي | “نراجع الدقة…” |
- `E07-0115`: 🔴 إلزامي | “نبني نسخة قابلة للتعديل…” |
- `E07-0116`: 🔴 إلزامي | “نجهّز المعاينة…” |
- `E07-0134`: 🔴 إلزامي | “حوّل إلى Word Editable 1:1” |
- `E07-0135`: 🔴 إلزامي | “استخرج الجداول إلى Excel” |
- `E07-0136`: 🔴 إلزامي | “عرّب الملف (PRO)” |
- `E07-0137`: 🔴 إلزامي | “حوّل إلى Dashboard” |
- `E07-0138`: 🔴 إلزامي | “تلخيص/تقرير تنفيذي” |
- `E07-0139`: 🔴 إلزامي | “حوّل إلى Excel Editable 1:1” |
- `E07-0140`: 🔴 إلزامي | “نظف الجدول” |
- `E07-0141`: 🔴 إلزامي | “حوّله إلى Dashboard” |
- `E07-0142`: 🔴 إلزامي | “قارن مع ملف آخر” |
- `E07-0143`: 🔴 إلزامي | “عرّب المحتوى” |
- `E07-0144`: 🔴 إلزامي | “ابنِ جدول موحد بالسحب” |
- `E07-0145`: 🔴 إلزامي | “تنظيف شامل” |
- `E07-0146`: 🔴 إلزامي | “اقتراح دمج/Join” |
- `E07-0147`: 🔴 إلزامي | “مقارنة ملفات” |
- `E07-0148`: 🔴 إلزامي | “أنشئ Dashboard” |
- `E07-0149`: 🔴 إلزامي | “أنشئ تقرير” |
- `E07-0150`: 🔴 إلزامي | “أنشئ عرض” |
- `E07-0151`: 🔴 إلزامي | “تفريغ 100% (SRT/DOCX)” |
- `E07-0152`: 🔴 إلزامي | “ترجمة/تعريب التفريغ” |
- `E07-0153`: 🔴 إلزامي | “تقرير من الفيديو” |
- `E07-0154`: 🔴 إلزامي | “عرض تقديمي من الفيديو” |
- `E07-0158`: 🔴 إلزامي | يظهر FileCard ثم ContextActionsCard (أول خيار: PPTX 1:1). |
- `E07-0159`: 🔴 إلزامي | User يضغط “PPTX 1:1”. |
- `E07-0160`: 🔴 إلزامي | يظهر PlanCard (4 خطوات: تحليل → بناء → تحقق → تصدير). |
- `E07-0161`: 🔴 إلزامي | RunCard يبدأ: |
- `E07-0163`: 🔴 إلزامي | عند اكتمال VERIFYING: |
- `E07-0164`: 🔴 إلزامي | EvidenceCard يظهر (إذا مفعّل) |
- `E07-0165`: 🔴 إلزامي | User يفتح الـPPTX داخل Focus Stage، يعدّل نصًا، preview يتحدث. |
- `E07-0166`: 🔴 إلزامي | User drops image. |
- `E07-0167`: 🔴 إلزامي | ContextActionsCard يقترح “Excel 1:1”. |
- `E07-0168`: 🔴 إلزامي | RunCard: اكتشاف grid → OCR → بناء XLSX → Render verify pixel=0 |
- `E07-0169`: 🟢 اختياري | PreviewCard يظهر grid overlay (اختياري) ثم preview excel. |
- `E07-0170`: 🔴 إلزامي | ResultCard: XLSX + زر “Open” يفتح جدول داخل Focus Stage مع أدوات الأعمدة. |
- `E07-0171`: 🔴 إلزامي | User يسحب عمود جديد من ملف Excel آخر داخل نفس stage → يتولد join wizard داخل Drawer (بدون أسئلة نصية). |
- `E07-0172`: 🔴 إلزامي | User يسحب 50 ملف. |
- `E07-0173`: 🔴 إلزامي | Sidebar يفتح Peek ويعرض قائمة الملفات فقط. |
- `E07-0174`: 🔴 إلزامي | ContextActionsCard يظهر: “Analyze Everything”. |
- `E07-0175`: 🔴 إلزامي | User يضغط “Analyze Everything”. |
- `E07-0176`: 🔴 إلزامي | RunCard: preflight → column map → join suggestions → unified table build. |
- `E07-0177`: 🔴 إلزامي | في نهاية التشغيل: |
- `E07-0178`: 🔴 إلزامي | User يكتب: “قارن ملف يناير وفبراير”: |
- `E07-0179`: 🔴 إلزامي | User يكتب: “ابنِ لوحة تنفيذية للمبيعات من هذه الملفات”. |
- `E07-0180`: 🔴 إلزامي | Intent parse → PlanCard |
- `E07-0181`: 🔴 إلزامي | RunCard يبني dashboard pages |
- `E07-0182`: 🔴 إلزامي | ResultCard: Live Dashboard link |
- `E07-0183`: 🔴 إلزامي | Open Focus Stage (dashboard editor) |
- `E07-0184`: 🔴 إلزامي | User يحدد KPI card → تظهر variants 8–12 + “More like this” |
- `E07-0185`: 🔴 إلزامي | User يضغط Share: |
- `E07-0186`: 🔴 إلزامي | EvidenceCard يظهر مع parity checks. |
- `E07-0187`: 🔴 إلزامي | User يسحب فيديو |
- `E07-0188`: 🔴 إلزامي | ContextActionsCard: “تفريغ 100%” |
- `E07-0189`: 🔴 إلزامي | RunCard: ASR ensemble → alignment → verify exactness (VerifierOps داخلي إن لزم) |
- `E07-0190`: 🔴 إلزامي | ResultCard: SRT + DOCX transcript |
- `E07-0191`: 🔴 إلزامي | User يكتب: “عرّبه رسميًا وخلي النبرة حكومية”: |
- `E07-0194`: 🔴 إلزامي | في أي لحظة: |

**Implementation Contract:**
All listed requirements MUST be implemented within the Canvas UI framework with full RTL support, responsive design, and integration with the platform's engine orchestration layer.

**Acceptance Criteria:**
- [ ] `E07-0112` is fully implemented and tested
- [ ] `E07-0113` is fully implemented and tested
- [ ] `E07-0114` is fully implemented and tested
- [ ] `E07-0115` is fully implemented and tested
- [ ] `E07-0116` is fully implemented and tested
- [ ] `E07-0134` is fully implemented and tested
- [ ] `E07-0135` is fully implemented and tested
- [ ] `E07-0136` is fully implemented and tested
- [ ] `E07-0137` is fully implemented and tested
- [ ] `E07-0138` is fully implemented and tested
- [ ] `E07-0139` is fully implemented and tested
- [ ] `E07-0140` is fully implemented and tested
- [ ] `E07-0141` is fully implemented and tested
- [ ] `E07-0142` is fully implemented and tested
- [ ] `E07-0143` is fully implemented and tested
- [ ] `E07-0144` is fully implemented and tested
- [ ] `E07-0145` is fully implemented and tested
- [ ] `E07-0146` is fully implemented and tested
- [ ] `E07-0147` is fully implemented and tested
- [ ] `E07-0148` is fully implemented and tested
- [ ] `E07-0149` is fully implemented and tested
- [ ] `E07-0150` is fully implemented and tested
- [ ] `E07-0151` is fully implemented and tested
- [ ] `E07-0152` is fully implemented and tested
- [ ] `E07-0153` is fully implemented and tested
- [ ] `E07-0154` is fully implemented and tested
- [ ] `E07-0158` is fully implemented and tested
- [ ] `E07-0159` is fully implemented and tested
- [ ] `E07-0160` is fully implemented and tested
- [ ] `E07-0161` is fully implemented and tested
- [ ] `E07-0163` is fully implemented and tested
- [ ] `E07-0164` is fully implemented and tested
- [ ] `E07-0165` is fully implemented and tested
- [ ] `E07-0166` is fully implemented and tested
- [ ] `E07-0167` is fully implemented and tested
- [ ] `E07-0168` is fully implemented and tested
- [ ] `E07-0169` is fully implemented and tested
- [ ] `E07-0170` is fully implemented and tested
- [ ] `E07-0171` is fully implemented and tested
- [ ] `E07-0172` is fully implemented and tested
- [ ] `E07-0173` is fully implemented and tested
- [ ] `E07-0174` is fully implemented and tested
- [ ] `E07-0175` is fully implemented and tested
- [ ] `E07-0176` is fully implemented and tested
- [ ] `E07-0177` is fully implemented and tested
- [ ] `E07-0178` is fully implemented and tested
- [ ] `E07-0179` is fully implemented and tested
- [ ] `E07-0180` is fully implemented and tested
- [ ] `E07-0181` is fully implemented and tested
- [ ] `E07-0182` is fully implemented and tested
- [ ] `E07-0183` is fully implemented and tested
- [ ] `E07-0184` is fully implemented and tested
- [ ] `E07-0185` is fully implemented and tested
- [ ] `E07-0186` is fully implemented and tested
- [ ] `E07-0187` is fully implemented and tested
- [ ] `E07-0188` is fully implemented and tested
- [ ] `E07-0189` is fully implemented and tested
- [ ] `E07-0190` is fully implemented and tested
- [ ] `E07-0191` is fully implemented and tested
- [ ] `E07-0194` is fully implemented and tested
