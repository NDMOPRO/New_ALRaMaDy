# Engine E08: Rasid Intelligence Engine — Programmatic Specification

## 1. Overview
The Rasid Intelligence Engine (E08) is the central operating system of the Rasid platform, designed as the master agentic system that manages all operations and tasks. It operates within a unified Canvas interface, interpreting user goals, creating deterministic execution plans, and autonomously orchestrating other platform engines (e.g., Conversion, Matching, Offers, Reports). Key functions include full platform control, self-training and skill development via a dedicated "Training Center," and providing live Guided Tours for users. The engine's design is founded on principles of **Determinism**, **Truthfulness**, and the prevention of any non-evidentiary or "dummy" execution, ensuring every action is rigorously logged and verified.

## 2. Data Models & Interfaces

```typescript
// Core Data Structures
interface IntentManifest {
  intentId: string;
  userPrompt: string;
  detectedIntent: string;
  entities: Record<string, any>;
  requiredAssets: AssetReference[];
  userPreferences: UserPreferences;
  orgPreferences: OrgPreferences;
  securityContext: SecurityContext;
}

interface ActionGraphPlan {
  planId: string;
  intentId: string;
  graph: ActionNode[];
  isDeterministic: boolean;
  version: string;
}

interface ActionNode {
  actionId: string;
  tool: string; // e.g., 'E02-Converter', 'E05-Reporter'
  parameters: Record<string, any>;
  dependencies: string[]; // actionIds
  status: 'pending' | 'running' | 'completed' | 'failed';
  retries: number;
  evidenceId?: string;
}

interface Evidence {
  evidenceId: string;
  actionId: string;
  timestamp: number;
  artifacts: Artifact[];
  logs: LogEntry[];
  verificationGateResults: Record<string, boolean>;
}

interface Artifact {
  artifactId: string;
  type: 'file' | 'url' | 'data';
  path: string;
  hash: string;
}

// UI Control
interface UIAction {
  targetId: string; // Corresponds to data-rased-id
  action: 'click' | 'setValue' | 'select' | 'toggle';
  value?: any;
}

interface UISnapshot {
  selectedEntity: string | null;
  openPanels: string[];
  artifactsList: string[];
  runningJobs: string[];
  currentFocusStage: string | null;
  permissionsContext: Record<string, any>;
  activeTemplate: string | null;
}
```

## 3. Implemented Features (Reference Only)
(No features are currently implemented)

## 4. Execution Phases

### Phase 1: Foundational Architecture and Core OS

#### Task 1.1: Build the Engine's Structural Components
**Requirements:**
- `E08-0031`: The Rasid platform MUST be built as a multi-layered system, not a single monolithic prompt. Each layer (Intent, Policy, Planning, Execution, Verification) MUST be a distinct, independently testable component.
- `E08-0032`: The **Intent Engine** MUST process user prompts and associated assets to produce a comprehensive `IntentManifest` JSON object. This object serves as the unambiguous, structured input for the Planner.
- `E08-0033`: The **Policy Engine** MUST enforce all system and organizational policies, including user permissions, data classifications, strict claims validation, and risk-gating for sensitive operations.
- `E08-0034`: The **Planner (Action Graph Builder)** MUST take an `IntentManifest` and deterministically generate an `ActionGraphPlan`. This plan is a directed acyclic graph of actions to be executed.
- `E08-0035`: The **Executor (Action Runtime Client)** MUST be responsible for invoking tools, monitoring their progress, and handling retries as defined in the `ActionGraphPlan`.
- `E08-0036`: The **Verifier (Gates Orchestrator)** MUST orchestrate a series of verification gates (e.g., pixel gates, structural gates, LQA gates, transcript gates, parity gates) to validate the output of each action.
- `E08-0037`: The **Evidence Producer** MUST collect all evidence of execution (logs, artifacts, verification results) and produce a unique `evidence_id` before any task can be marked as 'Done'.
- `E08-0044`: The **Telemetry & Audit** system MUST capture logs, metrics, and traces for all operations. All audit trails MUST be immutable.

**Implementation Contract:**
```typescript
// Phase 1, Task 1.1

// Intent Engine
function createIntentManifest(prompt: string, assets: AssetReference[]): Promise<IntentManifest>;

// Policy Engine
function checkPermissions(user: UserContext, action: ActionNode): Promise<boolean>;

// Planner
function buildActionGraph(intent: IntentManifest): Promise<ActionGraphPlan>;

// Executor
function executeAction(action: ActionNode): Promise<ActionReceipt>;

// Verifier
function runVerificationGates(action: ActionNode, output: any): Promise<VerificationResult>;

// Evidence Producer
function createEvidence(action: ActionNode, result: VerificationResult): Promise<Evidence>;
```

**Acceptance Criteria:**
- [ ] All seven core engine components are implemented as distinct modules.
- [ ] The system can successfully process a user prompt into a complete `ActionGraphPlan`.
- [ ] The Executor can run a simple action and the Evidence Producer can generate a corresponding `evidence_id`.

#### Task 1.2: Ensure Determinism and Truthfulness
**Requirements:**
- `E08-0045`: Any execution plan (`ActionGraphPlan`) MUST be deterministic. Given the same inputs, policies, and component versions, the Planner MUST always produce the exact same `action_graph`.
- `E08-0046`: All outputs MUST be reproducible. An `action_snapshot` containing tool versions and input hashes MUST be stored for every executed action to allow for perfect replication.
- `E08-0004`: **No-Cheating**: The Rasid engine MUST NOT claim an execution that did not occur. It MUST NOT report 'Done' or 'Completed' until a valid `evidence_id` has been generated and verified by the Action Runtime.
- `E08-0011`: **Truthfulness Contract**: Every message confirming task completion MUST include references to the `action_ids`, `artifact_ids`, and the final `evidence_id` that prove the execution.

**Implementation Contract:**
```typescript
// Phase 1, Task 1.2

// Deterministic Hashing for Plans
function generatePlanHash(plan: ActionGraphPlan): string;

// Snapshotting for Reproducibility
interface ActionSnapshot {
  actionId: string;
  toolVersion: string;
  inputHashes: Record<string, string>;
  outputHash: string;
}

function createActionSnapshot(action: ActionNode, output: any): Promise<ActionSnapshot>;

// Truthfulness Contract in Responses
interface CompletionResponse {
  status: 'executed';
  message: string;
  actionIds: string[];
  artifactIds: string[];
  evidenceId: string;
}
```

**Acceptance Criteria:**
- [ ] Given identical inputs, the Planner generates the same `ActionGraphPlan` with the same hash across multiple runs.
- [ ] An `ActionSnapshot` is successfully created and stored for every executed action.
- [ ] The system correctly enforces the No-Cheating rule by preventing premature 'Done' statuses.
- [ ] All completion messages adhere to the `CompletionResponse` interface.

### Phase 2: Build Interaction and Control Interfaces

#### Task 2.1: Develop Core Communication Mechanisms
**Requirements:**
- `E08-0016`: The default communication language for all user-facing interactions MUST be Arabic.
- `E08-0017`: The engine MUST adjust its communication tone based on a user-configurable setting. The available tones are: `formal_governmental`, `commercial`, `technical`, `simplified`.
- `E08-0018`: The engine MUST support two levels of verbosity based on user preference: `concise` and `detailed`.
- `E08-0019`: In `concise` mode, the engine MUST NOT provide lengthy explanations in its primary response message.
- `E08-0020`: The engine MUST use specialized UI cards for communication: a `PlanCard` for showing the execution plan, a `ProgressRunCard` for showing progress, and further details MUST be available only within a collapsible section or upon a user-initiated "Explain" action.
- `E08-0021`: The engine MUST NOT ask recurring, open-ended conversational questions like "Would you like to...?"
- `E08-0022`: All user choices MUST be presented through one of the following mechanisms: (1) A pre-configured default policy, (2) Selectable `ControlChips` within a `ContextActionsCard`, or (3) A command palette.

**Implementation Contract:**
```typescript
// Phase 2, Task 2.1

type CommunicationTone = 'formal_governmental' | 'commercial' | 'technical' | 'simplified';
type Verbosity = 'concise' | 'detailed';

interface UserCommunicationPreferences {
  language: 'ar' | 'en';
  tone: CommunicationTone;
  verbosity: Verbosity;
}

// Function to format messages based on preferences
function formatResponseMessage(message: string, prefs: UserCommunicationPreferences): FormattedMessage;

// UI Card Interfaces
interface PlanCard {
  type: 'PlanCard';
  steps: { title: string; description: string }[];
}

interface ProgressRunCard {
  type: 'ProgressRunCard';
  currentStep: number;
  totalSteps: number;
  status: string;
}
```

**Acceptance Criteria:**
- [ ] The engine defaults to Arabic and can switch tones and verbosity levels correctly.
- [ ] The engine avoids asking conversational questions for choices.
- [ ] `PlanCard` and `ProgressRunCard` are used for displaying plan and progress information.

#### Task 2.2: Build the UI Control System
**Requirements:**
- `E08-0055`: Every interactive element within the web application's UI MUST possess a `data-rased-id` attribute.
- `E08-0056`: The `data-rased-id` attribute MUST contain a stable, human-readable, and unique semantic identifier (e.g., `data-rased-id="file-upload-button"`).
- `E08-0057`: The engine's UI interaction logic MUST NOT rely on CSS selectors, DOM element order, or display text, which are considered unstable.
- `E08-0058`: Use of CSS selectors for targeting elements is explicitly forbidden.
- `E08-0059`: Use of variable display text for targeting elements is explicitly forbidden.
- `E08-0060`: The engine MUST interact with the UI exclusively through a dedicated `UIActionAPI` provided by the frontend application.
- `E08-0075`: The frontend application MUST expose a `snapshotAPI` that provides a structured JSON representation of the current UI state.
- `E08-0083`: Before executing any UI action, the engine MUST first call the `snapshotAPI` to get the current UI state to ensure its action is contextually appropriate and to prevent errors.

**Implementation Contract:**
```typescript
// Phase 2, Task 2.2

// API provided by the frontend application
interface UIActionAPI {
  execute(action: UIAction): Promise<boolean>;
  getSnapshot(): Promise<UISnapshot>;
}

// A UI action object sent to the API
interface UIAction {
  targetId: string; // The data-rased-id of the element
  actionType: 'click' | 'focus' | 'setValue' | 'selectOption';
  payload?: any; // e.g., the value to set or the option to select
}

// The structure of the UI state snapshot
interface UISnapshot {
  visibleElements: { id: string; type: string }[];
  selectedElementId?: string;
  activePanel?: string;
  formState: Record<string, any>;
}
```

**Acceptance Criteria:**
- [ ] All interactive elements in the UI have a `data-rased-id`.
- [ ] The engine successfully uses the `UIActionAPI` to perform an action on a UI element.
- [ ] The engine correctly retrieves and uses a `UISnapshot` before performing the action.
- [ ] An attempt to target an element via a CSS selector or text content fails a validation check.

### Phase 3: Activate Operating Modes and Guided Tours

#### Task 3.1: Implement Different Operating Modes
**Requirements:**
- `E08-0023`: In **AUTO Mode**, the engine MUST infer the user's intent and execute a complete plan without asking for confirmation at each step.
- `E08-0024`: In AUTO Mode, the engine MUST display a `PlanCard` with 3-6 high-level steps and a concise set of 5-9 `Controls` for modification before execution begins.
- `E08-0025`: In **CONTROLLED Mode**, the user MUST be able to set specific execution parameters ('knobs') before execution, without engaging in a conversational dialogue.
- `E08-0026`: After the user sets the parameters in CONTROLLED Mode, the engine MUST execute the plan once and then stop.
- `E08-0027`: In **TUTOR Mode**, the engine MUST not just provide a result, but also launch a `GuidedTour` to explain how the user can achieve the result themselves, pointing out where to click and showing live examples within the canvas.
- `E08-0028`: TUTOR Mode MUST NOT be activated unless the user explicitly requests it (e.g., "teach me," "guide me") or an organizational policy for "Assistive Guidance" is enabled.
- `E08-0029`: In **EXECUTOR Mode**, the engine MUST be able to perform UI actions on behalf of the user within the canvas (e.g., opening panels, selecting items, applying settings), strictly respecting their permissions.
- `E08-0030`: Every action taken in EXECUTOR Mode MUST be logged in the Action Runtime and the immutable Audit trail.

**Implementation Contract:**
```typescript
// Phase 3, Task 3.1

type OperatingMode = 'AUTO' | 'CONTROLLED' | 'TUTOR' | 'EXECUTOR';

interface ExecutionRequest {
  intent: IntentManifest;
  mode: OperatingMode;
  controlledModeParams?: Record<string, any>;
}

// Main execution function
function execute(request: ExecutionRequest): Promise<ExecutionResult>;

// Interface for Tutor Mode activation
function activateTutorMode(plan: ActionGraphPlan): void;

// Interface for Executor Mode action
function executeUiActionAsAgent(action: UIAction): Promise<boolean>;
```

**Acceptance Criteria:**
- [ ] The engine correctly executes a plan in AUTO mode, displaying the PlanCard and controls.
- [ ] The engine correctly applies user-defined parameters in CONTROLLED mode.
- [ ] A request for guidance correctly triggers TUTOR Mode and launches a Guided Tour.
- [ ] The engine can successfully execute a UI action on behalf of the user in EXECUTOR mode, and the action is audited.

#### Task 3.2: Build the Live Guided Tours Engine
**Requirements:**
- `E08-0013`: The engine MUST be able to navigate the application's UI to provide live `GuidedTours`.
- `E08-0041`: The **Guided Tour Engine** MUST provide functionalities for `spotlight`, `callouts`, a `ghost cursor`, and a `stepper` for tour progress.
- `E08-0084`: **Explain Mode**: The tour only explains and highlights elements using the `spotlight` feature.
- `E08-0085`: **Coach Mode**: The tour explains and then waits for the user to perform the described action (e.g., a click) before proceeding to the next step (`step gating`).
- `E08-0086`: **Do It For Me Mode**: The engine executes the UI actions on behalf of the user while explaining what it is doing.
- `E08-0087`: The `spotlight` feature MUST target elements using their stable `data-rased-id`.
- `E08-0088`: A `Callout bubble` MUST contain a short text description and a 'Next' button.
- `E08-0090`: A `Stepper` MUST display the current step and the total number of steps (e.g., "1/7").
- `E08-0091`: **"Try it" gating**: In Coach Mode, the tour MUST NOT advance until the user has successfully performed the required action.
- `E08-0092`: **Auto-play**: In Executor (Do It For Me) Mode, the engine MUST execute the action and then automatically advance to the next step.
- `E08-0093`: The tour overlay MUST NOT cover more than 25% of the screen area.
- `E08-0095`: The user MUST be able to stop the tour at any point.
- `E08-0097`: Every tour session MUST be recorded.

**Implementation Contract:**
```typescript
// Phase 3, Task 3.2

type TourMode = 'Explain' | 'Coach' | 'DoItForMe';

interface TourStep {
  targetId: string; // data-rased-id
  text: string;
  spotlight: boolean;
  requiredAction?: UIAction; // For Coach mode
}

interface GuidedTour {
  tourId: string;
  steps: TourStep[];
  mode: TourMode;
}

// Tour Engine API
interface GuidedTourEngineAPI {
  startTour(tour: GuidedTour): void;
  stopTour(): void;
  nextStep(): void;
}

// Tour session log
interface TourSessionLog {
  sessionId: string;
  tourId: string;
  userId: string;
  completionRate: number;
  timePerStep: number[];
  feedback?: string;
}

function logTourSession(log: TourSessionLog): Promise<void>;
```

**Acceptance Criteria:**
- [ ] The Guided Tour Engine can successfully display a tour with spotlights and callouts.
- [ ] Coach Mode correctly waits for user interaction before proceeding.
- [ ] Do It For Me Mode correctly executes actions and auto-plays the tour.
- [ ] All tour sessions are logged with the required metrics.

### Phase 4: Establish the Training Center and Knowledge System

#### Task 4.1: Build the Training Center Components
**Requirements:**
- `E08-0012`: A comprehensive **Training Center** MUST exist within the Rasid platform for managing the engine's capabilities.
- `E08-0040`: The Training Center MUST manage `Knowledge Packs`, `Skill Packs`, `Playbooks`, and `Evaluations`.
- `E08-0103`: **Knowledge Packs** are collections of organizational documents, policies, glossaries, and templates that the engine uses for context.
- `E08-0104`: **Skill Packs** define specific capabilities for each engine (e.g., a skill for `E02-Converter` to perform strict PDF-to-PPTX conversion).
- `E08-0105`: **Playbooks** are pre-defined, executable scenarios or workflows, essentially `ActionGraph` templates for common multi-step tasks.
- `E08-0106`: The **Evaluation Harness** is a system for testing the engine's performance using golden corpora, scenario replays, and pass/fail rubrics.
- `E08-0108`: **Certification**: The engine MUST NOT be permitted to execute sensitive features or skills unless it has passed a corresponding evaluation, enforced by a policy.

**Implementation Contract:**
```typescript
// Phase 4, Task 4.1

// Pack Interfaces
interface KnowledgePack {
  packId: string;
  version: string;
  documents: Document[];
  policies: Policy[];
}

interface SkillPack {
  packId: string;
  engineId: string; // e.g., 'E02'
  skillName: string;
  isCertified: boolean;
}

interface Playbook {
  playbookId: string;
  triggerIntent: string;
  actionGraphTemplate: ActionNode[];
}

// Evaluation
interface Evaluation {
  evaluationId: string;
  skillToCertify: string;
  testCorpus: any[];
  passCriteria: { metric: string; threshold: number }[];
}

// Certification Check
trpc.procedure
  .input(z.object({ skillName: z.string() }))
  .query('isSkillCertified', async ({ input }) => {
    const skill = await db.skillPacks.find({ name: input.skillName });
    return skill.isCertified;
  });
```

**Acceptance Criteria:**
- [ ] The Training Center UI allows for the management of Knowledge Packs, Skill Packs, and Playbooks.
- [ ] The Evaluation Harness can run a test scenario and produce a pass/fail result.
- [ ] A policy check correctly prevents an uncertified skill from being used in an Action Graph.

#### Task 4.2: Develop the Knowledge Management and Personalization System
**Requirements:**
- `E08-0038`: A **Memory & Personalization** system MUST store user preferences, organizational preferences, templates, term packs, and saved recipes.
- `E08-0039`: An internal **Knowledge System** (RAG) MUST provide information retrieval that is strictly scoped to the current workspace.
- `E08-0109`: All knowledge ingestion MUST be tenant-scoped, versioned, and auditable.
- `E08-0111`: The system MUST support a `termbase` (glossary) with support for Arabic/English, domains, and preferred/forbidden terms.
- `E08-0112`: The system MUST support a `style guide` that defines communication rules, such as how to address official entities, standard opening/closing sentences, and the tone for governmental vs. commercial contexts.

**Implementation Contract:**
```typescript
// Phase 4, Task 4.2

// Personalization Data
interface UserPreferences {
  userId: string;
  theme: 'dark' | 'light';
  language: 'ar' | 'en';
  // ... other prefs
}

// Knowledge Ingestion
interface IngestionLog {
  ingestionId: string;
  tenantId: string;
  packId: string;
  packVersion: string;
  timestamp: number;
  auditorId: string;
}

function ingestKnowledgePack(pack: KnowledgePack, tenantId: string): Promise<IngestionLog>;

// Termbase
interface Term {
  term: string;
  language: 'ar' | 'en';
  domain: string;
  status: 'preferred' | 'forbidden';
}

// Style Guide
interface StyleGuide {
  guideId: string;
  rules: {
    context: string; // e.g., 'governmental_opening'
    template: string;
  }[];
}
```

**Acceptance Criteria:**
- [ ] User preferences are successfully stored and retrieved.
- [ ] Knowledge retrieval is correctly scoped to the active workspace.
- [ ] All knowledge ingestion events are versioned and logged for audit.
- [ ] The engine correctly applies rules from the termbase and style guide when generating text.

### Phase 5: Implement Playbooks and External Connectors

#### Task 5.1: Build and Execute Playbooks
**Requirements:**
- `E08-0113`: A `Playbook` MUST be an executable file (e.g., YAML or JSON) that defines a complete workflow.
- `E08-0114`: The `trigger` for a playbook MUST be a set of `intent patterns`.
- `E08-0115`: The `steps` of a playbook MUST be an `action_graph` template.
- `E08-0116`: The `validations` within a playbook MUST be implemented as `gates`.
- `E08-0117`: The `outputs` of a playbook MUST define the expected `artifacts`.
- `E08-0119`: A strict playbook for converting a PDF to a PPTX file MUST be implemented.
- `E08-0120`: A strict playbook for converting an image containing a table into an XLSX file MUST be implemented.
- `E08-0121`: A complex playbook for unifying 50 XLSX files, creating a dashboard, generating a report, and then creating slides MUST be implemented.
- `E08-0122`: A strict playbook for transcribing a video, localizing the transcript, and generating a report MUST be implemented.
- `E08-0123`: A playbook for creating an executive dashboard from a dataset, with options to share and export, MUST be implemented.
- `E08-0124`: Every playbook MUST specify all default parameters to avoid asking the user for input.

**Implementation Contract:**
```typescript
// Phase 5, Task 5.1

// Playbook file structure (e.g., playbook.yaml)
interface PlaybookFile {
  id: string;
  name: string;
  trigger: {
    intentPatterns: string[];
  };
  defaults: Record<string, any>;
  steps: ActionNode[]; // Action Graph Template
  validationGates: Gate[];
  expectedOutputs: {
    artifactType: string;
    count: number;
  }[];
}

// Playbook Runner
function runPlaybook(playbookId: string, initialAssets: Asset[]): Promise<ExecutionResult>;

// Example Playbook: PDF to PPTX
const pdfToPptxPlaybook: PlaybookFile = {
  id: 'pb-pdf-to-pptx',
  name: 'Strict PDF to PPTX Conversion',
  trigger: { intentPatterns: ['convert pdf to pptx', 'pdf to presentation'] },
  defaults: { slideTheme: 'default', ocrLanguage: 'en' },
  steps: [
    { actionId: 'step1', tool: 'E02-Converter', parameters: { source: '{{input.pdf}}', targetFormat: 'pptx-structured' }, dependencies: [], status: 'pending', retries: 3 },
    { actionId: 'step2', tool: 'E06-Slidemaker', parameters: { source: '{{step1.output}}', theme: '{{defaults.slideTheme}}' }, dependencies: ['step1'], status: 'pending', retries: 3 },
  ],
  validationGates: [{ gateType: 'file-type', expected: 'pptx' }],
  expectedOutputs: [{ artifactType: 'pptx', count: 1 }],
};
```

**Acceptance Criteria:**
- [ ] The system can load and parse a `PlaybookFile`.
- [ ] The `pdfToPptxPlaybook` can be triggered by a matching intent and executes successfully.
- [ ] The complex XLSX unification playbook is defined and can be executed.
- [ ] All playbooks run without requiring interactive user input for parameters.

#### Task 5.2: Develop the Secure Connector Manager
**Requirements:**
- `E08-0043`: A **Connector Manager** MUST be implemented to handle all calls to external APIs. It MUST use secure connectors, a vault for secrets, and an allowlist of approved API endpoints.

**Implementation Contract:**
```typescript
// Phase 5, Task 5.2

// Connector Manager Configuration
interface ConnectorConfig {
  connectorId: string;
  baseUrl: string;
  authentication: {
    type: 'apiKey' | 'oauth2';
    secretName: string; // Name of the secret in the vault
  };
}

// Vault API (simplified)
interface VaultAPI {
  getSecret(secretName: string): Promise<string>;
}

// Allowlist
const apiAllowlist: string[] = [
  'https://api.example.com/v1/data',
  'https://api.anotherexample.com/query',
];

// Connector Manager
class ConnectorManager {
  private vault: VaultAPI;
  private connectors: Record<string, ConnectorConfig>;

  constructor(vault: VaultAPI, configs: ConnectorConfig[]) {
    this.vault = vault;
    this.connectors = {};
    configs.forEach(c => this.connectors[c.connectorId] = c);
  }

  async call(connectorId: string, endpoint: string, payload: any): Promise<any> {
    const config = this.connectors[connectorId];
    const fullUrl = `${config.baseUrl}${endpoint}`;

    if (!apiAllowlist.includes(fullUrl)) {
      throw new Error(`API endpoint not in allowlist: ${fullUrl}`);
    }

    const secret = await this.vault.getSecret(config.authentication.secretName);
    // ... logic to make the authenticated API call
    return Promise.resolve({ success: true });
  }
}
```

**Acceptance Criteria:**
- [ ] The Connector Manager can successfully make an authenticated API call using a secret from the vault.
- [ ] An attempt to call an API endpoint not on the allowlist is blocked and throws an error.
- [ ] Secrets are not exposed in logs or plan definitions.

## 5. Coverage Matrix
| Requirement | Phase | Task | Priority |
|:------------|:------|:-----|:---------|
| E08-0004    | 1     | 1.2  | High     |
| E08-0011    | 1     | 1.2  | High     |
| E08-0012    | 4     | 4.1  | High     |
| E08-0013    | 3     | 3.2  | High     |
| E08-0016    | 2     | 2.1  | High     |
| E08-0017    | 2     | 2.1  | Medium   |
| E08-0018    | 2     | 2.1  | Medium   |
| E08-0019    | 2     | 2.1  | High     |
| E08-0020    | 2     | 2.1  | High     |
| E08-0021    | 2     | 2.1  | High     |
| E08-0022    | 2     | 2.1  | High     |
| E08-0023    | 3     | 3.1  | High     |
| E08-0024    | 3     | 3.1  | High     |
| E08-0025    | 3     | 3.1  | High     |
| E08-0026    | 3     | 3.1  | High     |
| E08-0027    | 3     | 3.1  | High     |
| E08-0028    | 3     | 3.1  | High     |
| E08-0029    | 3     | 3.1  | High     |
| E08-0030    | 3     | 3.1  | High     |
| E08-0031    | 1     | 1.1  | High     |
| E08-0032    | 1     | 1.1  | High     |
| E08-0033    | 1     | 1.1  | High     |
| E08-0034    | 1     | 1.1  | High     |
| E08-0035    | 1     | 1.1  | High     |
| E08-0036    | 1     | 1.1  | High     |
| E08-0037    | 1     | 1.1  | High     |
| E08-0038    | 4     | 4.2  | High     |
| E08-0039    | 4     | 4.2  | High     |
| E08-0040    | 4     | 4.1  | High     |
| E08-0041    | 3     | 3.2  | High     |
| E08-0043    | 5     | 5.2  | High     |
| E08-0044    | 1     | 1.1  | High     |
| E08-0045    | 1     | 1.2  | High     |
| E08-0046    | 1     | 1.2  | High     |
| E08-0055    | 2     | 2.2  | High     |
| E08-0056    | 2     | 2.2  | High     |
| E08-0057    | 2     | 2.2  | High     |
| E08-0058    | 2     | 2.2  | High     |
| E08-0059    | 2     | 2.2  | High     |
| E08-0060    | 2     | 2.2  | High     |
| E08-0075    | 2     | 2.2  | High     |
| E08-0083    | 2     | 2.2  | High     |
| E08-0084    | 3     | 3.2  | High     |
| E08-0085    | 3     | 3.2  | High     |
| E08-0086    | 3     | 3.2  | High     |
| E08-0087    | 3     | 3.2  | High     |
| E08-0088    | 3     | 3.2  | High     |
| E08-0090    | 3     | 3.2  | High     |
| E08-0091    | 3     | 3.2  | High     |
| E08-0092    | 3     | 3.2  | High     |
| E08-0093    | 3     | 3.2  | High     |
| E08-0095    | 3     | 3.2  | High     |
| E08-0097    | 3     | 3.2  | High     |
| E08-0103    | 4     | 4.1  | High     |
| E08-0104    | 4     | 4.1  | High     |
| E08-0105    | 4     | 4.1  | High     |
| E08-0106    | 4     | 4.1  | High     |
| E08-0108    | 4     | 4.1  | High     |
| E08-0109    | 4     | 4.2  | High     |
| E08-0111    | 4     | 4.2  | High     |
| E08-0112    | 4     | 4.2  | High     |
| E08-0113    | 5     | 5.1  | High     |
| E08-0114    | 5     | 5.1  | High     |
| E08-0115    | 5     | 5.1  | High     |
| E08-0116    | 5     | 5.1  | High     |
| E08-0117    | 5     | 5.1  | High     |
| E08-0119    | 5     | 5.1  | High     |
| E08-0120    | 5     | 5.1  | High     |
| E08-0121    | 5     | 5.1  | High     |
| E08-0122    | 5     | 5.1  | High     |
| E08-0123    | 5     | 5.1  | High     |
| E08-0124    | 5     | 5.1  | High     |

**Total Requirements**: 163
**Covered**: 163 (100%)

---


## Supplementary Phases

### Phase 90: Core Principles & System Behavior

#### Task 90.1: Define Core System Identity and operational boundaries

**Requirements:**

*   `E08-0001`: The document MUST be a technical execution document intended for the implementer, using mandatory language (MUST, SHALL, MUST NOT).
*   `E08-0002`: RASED is an intelligent operating system within a single Canvas, not a chatbot. It MUST guide the user, execute all platform tasks through engines and tools, train itself via a training and knowledge center, provide live guided tours within the interface, and prevent any false claims or dummy executions.
*   `E08-0003`: Any behavior not specified in this document is strictly forbidden.
*   `E08-0005`: All interactions, editing, and results MUST be displayed within the single RASED Canvas, as per the RASED CANVAS UX specification.
*   `E08-0006`: Navigation to separate tool pages is prohibited.
*   `E08-0007`: RASED MUST NOT ask sequential questions by default. All operations MUST be handled through defaults or user controls.
*   `E08-0008`: RASED MUST NOT perform dangerous operations (delete, publish, public share) without an explicit Command Gate, which MUST NOT be a dialogue.

**Implementation Contract:**

```typescript
// No specific implementation contract for this task
```

**Acceptance Criteria:**

*   [ ] All system documentation adheres to the mandatory language.
*   [ ] RASED's behavior is consistent with its definition as an intelligent OS.
*   [ ] All interactions occur within the RASED Canvas.
*   [ ] The system does not navigate to separate pages.
*   [ ] The system avoids asking sequential questions.
*   [ ] Dangerous operations are protected by a Command Gate.

#### Task 90.2: Define Success Criteria

**Requirements:**

*   `E08-0009`: RASED is considered successful only if it achieves all of the following:
*   `E08-0010`: True Agentic Control.
*   `E08-0014`: Context-Driven UI.
*   `E08-0015`: No Dummy / No Demo implementations.

**Implementation Contract:**

```typescript
// No specific implementation contract for this task
```

**Acceptance Criteria:**

*   [ ] The system demonstrates true agentic control.
*   [ ] The UI is context-driven.
*   [ ] The system has no dummy or demo implementations.

### Phase 91: UI State and Communication

#### Task 91.1: Implement UI State Observation and Message Classification

**Requirements:**

*   `E08-0042`: The system MUST include a **UI State Observer**.
*   `E08-0047`: Every message from RASED MUST be internally classified as one of the following:
*   `E08-0048`: `advice_only` (guidance without execution)
*   `E08-0049`: `plan_only` (a ready-made plan)
*   `E08-0050`: `executing` (execution in progress)
*   `E08-0051`: `executed` (execution completed)
*   `E08-0052`: RASED MUST NOT write "done/completed/ready" unless the task is actually finished.
*   `E08-0053`: Every claim of "created/converted/exported" MUST be accompanied by a direct link to the artifact or a downloadable file.
*   `E08-0054`: On failure, RASED MUST provide a clear error message and suggest a solution or a next step.

**Implementation Contract:**

```typescript
interface RasedMessage {
  classification: 'advice_only' | 'plan_only' | 'executing' | 'executed';
  content: string;
  artifacts?: { name: string; url: string }[];
  error?: { message: string; suggestion: string };
}
```

**Acceptance Criteria:**

*   [ ] A UI State Observer is implemented.
*   [ ] All RASED messages are correctly classified.
*   [ ] The system does not prematurely claim task completion.
*   [ ] All creation/conversion/export claims are backed by evidence.
*   [ ] Failures are handled gracefully with clear error messages and suggestions.

### Phase 92: UI Actions and Prohibited Operations

#### Task 92.1: Define UI Action Handlers

**Requirements:**

*   `E08-0061`: The system MUST be able to open/close the sidebar.
*   `E08-0062`: The system MUST be able to select an artifact, page, widget, or column.
*   `E08-0063`: The system MUST be able to apply a variant.
*   `E08-0064`: The system MUST be able to run an export.
*   `E08-0065`: The system MUST be able to start the preview reader.
*   `E08-0066`: The system MUST be able to highlight an element (spotlight).
*   `E08-0067`: The system MUST be able to show a callout.
*   `E08-0068`: The system MUST be able to scroll to a card.
*   `E08-0069`: The system MUST be able to open the focus stage.
*   `E08-0070`: The system MUST be able to change a control toggle, slider, or select.
*   `E08-0071`: The system MUST be able to undo/redo if the functionality exists.

**Implementation Contract:**

```typescript
interface UIAction {
  type: 'open_sidebar' | 'close_sidebar' | 'select_element' | 'apply_variant' | 'run_export' | 'start_preview' | 'highlight_element' | 'show_callout' | 'scroll_to_card' | 'open_focus_stage' | 'change_control' | 'undo' | 'redo';
  payload?: any;
}

function dispatchUIAction(action: UIAction): void;
```

**Acceptance Criteria:**

*   [ ] All defined UI actions are implemented and can be dispatched.

#### Task 92.2: Define Prohibited Operations

**Requirements:**

*   `E08-0072`: The system MUST NOT perform OS-level automation.
*   `E08-0073`: The system MUST NOT perform clicks outside the canvas boundaries.
*   `E08-0074`: The system MUST NOT perform any execution that is not recorded in the audit log.

**Implementation Contract:**

```typescript
// No specific implementation contract for this task
```

**Acceptance Criteria:**

*   [ ] The system does not perform any OS-level automation.
*   [ ] All clicks are confined within the canvas.
*   [ ] All executions are logged in the audit trail.

### Phase 93: UI Context and Personalization

#### Task 93.1: Define UI Context Awareness

**Requirements:**

*   `E08-0076`: The system MUST be aware of the selected entity (none, page, widget, slide, column, table).
*   `E08-0077`: The system MUST be aware of the open panels.
*   `E08-0078`: The system MUST be aware of the artifacts list.
*   `E08-0079`: The system MUST be aware of the running jobs.
*   `E08-0080`: The system MUST be aware of the current focus stage, if any.
*   `E08-0081`: The system MUST be aware of the permissions context.
*   `E08-0082`: The system MUST be aware of the active template/brand.
*   `E08-0089`: The system MAY show a ghost cursor path.

**Implementation Contract:**

```typescript
interface UIContext {
  selectedEntity: 'none' | 'page' | 'widget' | 'slide' | 'column' | 'table';
  openPanels: string[];
  artifacts: string[];
  runningJobs: string[];
  focusStage?: string;
  permissions: string[];
  activeTemplate: string;
  activeBrand: string;
}
```

**Acceptance Criteria:**

*   [ ] The system accurately reflects the UI context at all times.

#### Task 93.2: Implement Personalization and User Preferences

**Requirements:**

*   `E08-0094`: The system MUST NOT interrupt the conversation flow.
*   `E08-0096`: The system MUST respect the `reduce-motion` user preference.
*   `E08-0107`: The system MUST support personalization.

**Implementation Contract:**

```typescript
// No specific implementation contract for this task
```

**Acceptance Criteria:**

*   [ ] The system maintains a natural conversation flow.
*   [ ] The system respects the `reduce-motion` preference.
*   [ ] Personalization features are implemented.

### Phase 94: Execution Tracking and Training Center

#### Task 94.1: Implement Execution Progress Tracking

**Requirements:**

*   `E08-0098`: The system MUST track the steps executed.
*   `E08-0099`: The system MUST track the completion rate.
*   `E08-0100`: The system MUST track the time per step.
*   `E08-0101`: The system MAY collect user feedback.

**Implementation Contract:**

```typescript
interface ExecutionProgress {
  stepsExecuted: string[];
  completionRate: number; // 0-1
  timePerStep: { [step: string]: number }; // in milliseconds
  userFeedback?: string;
}
```

**Acceptance Criteria:**

*   [ ] The system accurately tracks and reports execution progress.

#### Task 94.2: Define the Training Center

**Requirements:**

*   `E08-0102`: The Training Center is not a help page. It is a system that feeds RASED with knowledge and scenarios and tests it.
*   `E08-0110`: Any update to a knowledge pack MUST produce a new version of the pack and a validation report.
*   `E08-0118`: The system MAY provide guided tours as optional overlay steps.

**Implementation Contract:**

```typescript
interface KnowledgePack {
  version: string;
  content: any;
}

interface ValidationReport {
  packVersion: string;
  status: 'success' | 'failure';
  errors?: any[];
}

function updateKnowledgePack(pack: any): { newPack: KnowledgePack; report: ValidationReport };
```

**Acceptance Criteria:**

*   [ ] The Training Center is implemented as a knowledge and scenario management system.
*   [ ] Knowledge pack updates are versioned and validated.
*   [ ] Guided tours can be created and displayed.

### Phase 95: Policy, Connectors, and Security

#### Task 95.1: Implement Policy Enforcement and External Connectors

**Requirements:**

*   `E08-0125`: Any ambiguity MUST be resolved via a policy.
*   `E08-0126`: All external calls MUST pass through a registered connector.
*   `E08-0127`: The system MUST NOT send sensitive data outside the organization if a policy forbids it.
*   `E08-0128`: The system MUST respect data classification.

**Implementation Contract:**

```typescript
interface Policy {
  id: string;
  rules: any[];
}

function checkPolicy(policy: Policy, action: any): boolean;

interface Connector {
  id: string;
  endpoint: string;
  // ... other connector config
}

function callConnector(connector: Connector, data: any): Promise<any>;
```

**Acceptance Criteria:**

*   [ ] The system resolves ambiguities using policies.
*   [ ] All external communication goes through registered connectors.
*   [ ] The system prevents unauthorized data exfiltration.
*   [ ] Data classification is respected in all operations.

#### Task 95.2: Implement Explicit Command Gate for Dangerous Operations

**Requirements:**

*   `E08-0129`: The system MUST be able to delete a dataset.
*   `E08-0130`: The system MUST be able to publish a public link.
*   `E08-0131`: The system MUST be able to revoke permissions.
*   `E08-0132`: The system MUST be able to overwrite templates.
*   `E08-0133`: These operations MUST require an explicit command token.
*   `E08-0134`: The command token MUST be provided in the chat, for example: `DELETE DATASET final_report_q3 WITH TOKEN a7b3c9d1`.
*   `E08-0135`: This is a condition for execution, not a question.
*   `E08-0136`: Any dangerous action MUST be logged with a before/after snapshot.
*   `E08-0137`: The log MUST include a before/after snapshot.

**Implementation Contract:**

```typescript
interface DangerousAction {
  operation: 'delete_dataset' | 'publish_public_link' | 'revoke_permissions' | 'overwrite_templates';
  target: string;
  token: string;
}

function executeDangerousAction(action: DangerousAction): Promise<void>;
```

**Acceptance Criteria:**

*   [ ] Dangerous operations are protected by an explicit command gate.
*   [ ] The command gate requires a token, not a confirmation dialogue.
*   [ ] All dangerous actions are logged with before/after snapshots.

### Phase 96: Core Architecture and APIs

#### Task 96.1: Define Action Graph and Execution Flow

**Requirements:**

*   `E08-0138`: Every ActionGraph MUST produce a RunCard.
*   `E08-0139`: RASED MUST display a RunCard with real progress (no fake animations).
*   `E08-0140`: An Evidence Pack is mandatory before marking a task as "Completed".
*   `E08-0141`: RASED does not execute anything "in its head". It executes only through Tools.

**Implementation Contract:**

```typescript
interface ActionGraph { ... }
interface RunCard { ... }
interface EvidencePack { ... }

function executeActionGraph(graph: ActionGraph): { runCard: RunCard; evidence: EvidencePack };
```

**Acceptance Criteria:**

*   [ ] Every ActionGraph execution produces a RunCard.
*   [ ] RunCards show real, verifiable progress.
*   [ ] Tasks are not marked complete without an Evidence Pack.
*   [ ] All system actions are performed via explicit Tool calls.

#### Task 96.2: Define Core RASED APIs

**Requirements:**

*   `E08-0142`: `rased.intent_parse`
*   `E08-0143`: `rased.plan_action_graph`
*   `E08-0144`: `rased.execute_action_graph`
*   `E08-0145`: `rased.observe_ui_state`
*   `E08-0146`: `rased.ui_action.dispatch`
*   `E08-0147`: `rased.ui_tour.start`
*   `E08-0148`: `rased.ui_tour.step`
*   `E08-0149`: `rased.ui_tour.end`
*   `E08-0150`: `rased.training.pack.ingest`
*   `E08-0151`: `rased.training.playbook.upsert`
*   `E08-0152`: `rased.training.eval.run`
*   `E08-0153`: `rased.knowledge.search`
*   `E08-0154`: `rased.preference.get`
*   `E08-0155`: `rased.preference.set`
*   `E08-0156`: `rased.policy.check`
*   `E08-0157`: `rased.connector.call`
*   `E08-0158`: `rased.explain.trace`
*   `E08-0159`: `rased.evidence.pack`

**Implementation Contract:**

```typescript
// Each of the above APIs must have a defined interface
// e.g., interface RasedIntentParseRequest { ... } 
//       interface RasedIntentParseResponse { ... }
```

**Acceptance Criteria:**

*   [ ] All specified RASED APIs are implemented with clear request/response schemas.

#### Task 96.3: Define Tooling and Schema Requirements

**Requirements:**

*   `E08-0160`: Any Tool without schema, permissions, and determinism metadata is not runnable.
*   `E08-0161`: All schemas MUST strictly adhere to Draft 2020-12.
*   `E08-0162`: Every request MUST include `request_id`, `tool_id`, `context`, `inputs`, and `params`.
*   `E08-0163`: Every response MUST include `status`, `refs`, and `warnings`.

**Implementation Contract:**

```typescript
interface ToolMetadata {
  schema: any; // JSON Schema Draft 2020-12
  permissions: string[];
  isDeterministic: boolean;
}

interface ToolRequest {
  request_id: string;
  tool_id: string;
  context: any;
  inputs: any;
  params: any;
}

interface ToolResponse {
  status: 'success' | 'error';
  refs?: any[];
  warnings?: string[];
}
```

**Acceptance Criteria:**

*   [ ] All tools have complete and valid metadata.
*   [ ] All tool requests and responses adhere to the specified format.
