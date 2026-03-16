import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { z } from "zod";
import { PresentationEngine } from "./index";

const WorkspaceCreateRequestSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().default(""),
  text: z.string().default(""),
  notes: z.array(z.string()).default([]),
  mode: z.enum(["easy", "advanced"]).default("easy"),
  language: z.string().default("ar-SA"),
  audience: z.string().default("workspace stakeholders"),
  tone: z.string().default("clear"),
  density: z.enum(["light", "balanced", "dense"]).default("balanced"),
  target_slide_count: z.number().int().positive().nullable().default(null),
  template_ref: z.string().nullable().default(null),
  brand_preset_ref: z.string().nullable().default(null),
  workspace_preset_ref: z.string().nullable().default("workspace-preset://riyadh"),
  rtl_policy: z.enum(["auto", "rtl", "ltr"]).default("auto"),
  motion_level: z.enum(["none", "subtle", "moderate", "high"]).default("subtle"),
  strict_insert_requests: z.array(z.string()).default([]),
  auto_validate: z.boolean().default(true)
});

const MutationRequestSchema = z.object({
  actor_ref: z.string().default("workspace-user"),
  mutation: z.record(z.unknown())
});

const BindRequestSchema = z.object({
  actor_ref: z.string().default("workspace-user"),
  source_refs: z.array(z.string()).default([])
});

const TemplateRequestSchema = z.object({
  actor_ref: z.string().default("workspace-user"),
  template_ref: z.string(),
  brand_preset_ref: z.string().nullable().default(null),
  lock_mode: z.enum(["unlocked", "soft_lock", "strict_lock"]).default("soft_lock")
});

const PublishRequestSchema = z.object({
  published_by: z.string().default("workspace-user"),
  target_ref: z.string().default("workspace://presentations/workspace"),
  publish_to_library: z.boolean().default(true),
  allow_degraded: z.boolean().default(false)
});

export type PresentationWorkspaceServerHandle = {
  origin: string;
  port: number;
  close: () => Promise<void>;
};

type WorkspaceCreateInput = Parameters<PresentationEngine["createPresentation"]>[0];
type WorkspaceSource = NonNullable<WorkspaceCreateInput["sources"]>[number];

const readJsonBody = async (request: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const payload = Buffer.concat(chunks).toString("utf8");
  return payload.length > 0 ? JSON.parse(payload) : {};
};

const sendJson = (response: http.ServerResponse, statusCode: number, payload: unknown): void => {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const sendHtml = (response: http.ServerResponse, html: string): void => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
};

const sendFile = (response: http.ServerResponse, filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    extension === ".html"
      ? "text/html; charset=utf-8"
      : extension === ".json"
        ? "application/json; charset=utf-8"
        : extension === ".pdf"
          ? "application/pdf"
          : extension === ".pptx"
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : extension === ".png"
              ? "image/png"
              : "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  response.end(fs.readFileSync(filePath));
};

const normalizeCreatePayload = (
  payload: z.infer<typeof WorkspaceCreateRequestSchema>
): WorkspaceCreateInput => {
  const sources: WorkspaceSource[] = [];
  if (payload.prompt.trim().length > 0) {
    sources.push({
      source_kind: "prompt_topic",
      source_ref: "workspace-prompt-1",
      prompt: payload.prompt.trim(),
      topic: payload.title,
      title: "Workspace Prompt"
    });
  }
  if (payload.text.trim().length > 0) {
    sources.push({
      source_kind: "plain_text",
      source_ref: "workspace-text-1",
      text: payload.text.trim(),
      title: "Workspace Text"
    });
  }
  if (payload.notes.length > 0) {
    sources.push({
      source_kind: "notes",
      source_ref: "workspace-notes-1",
      notes: payload.notes,
      title: "Workspace Notes"
    });
  }
  if (payload.template_ref) {
    sources.push({
      source_kind: "library_template",
      source_ref: "workspace-template-1",
      template_name: payload.template_ref,
      brand_preset_ref: payload.brand_preset_ref,
      lock_mode: payload.mode === "advanced" ? "soft_lock" : "unlocked",
      theme_tokens: {
        primary_color: "C7511F",
        secondary_color: "0F172A",
        accent_color: "1D8F6E",
        neutral_color: "EEF2F6",
        font_face: "Aptos"
      }
    });
  }
  return {
    tenant_ref: "tenant-workspace",
    workspace_id: "workspace-presentations",
    project_id: "project-presentations",
    created_by: "workspace-user",
    title: payload.title,
    description: payload.prompt || payload.text || "Workspace-generated presentation",
    mode: payload.mode,
    language: payload.language,
    audience: payload.audience,
    tone: payload.tone,
    density: payload.density,
    target_slide_count: payload.target_slide_count ?? undefined,
    source_policy: payload.mode === "advanced" ? ("strict_explicit_sources" as const) : ("prefer_structured_sources" as const),
    rtl_policy: payload.rtl_policy,
    motion_level: payload.motion_level,
    notes_policy: "auto_generate" as const,
    export_targets: ["reader", "pptx", "pdf", "html"] as const,
    template_ref: payload.template_ref,
    workspace_preset_ref: payload.workspace_preset_ref,
    brand_preset_ref: payload.brand_preset_ref,
    strict_insert_requests: payload.strict_insert_requests,
    sources
  };
};

const shellHtml = (title: string, body: string, script: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { --ink: #0f172a; --muted: #475569; --line: #d6dde7; --paper: #f7f8fb; --card: #ffffff; --accent: #c7511f; --accent-soft: #fee2d5; --green: #1d8f6e; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; background: linear-gradient(180deg, #fff8f4, #f2f5fa 45%, #eef2f7); color: var(--ink); }
    a { color: inherit; text-decoration: none; }
    .page { padding: 24px; max-width: 1440px; margin: 0 auto; }
    .hero { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 24px; }
    .hero h1 { margin: 0 0 8px; font-size: 28px; }
    .hero p { margin: 0; color: var(--muted); max-width: 760px; }
    .surface { background: rgba(255,255,255,0.9); border: 1px solid rgba(15,23,42,0.08); border-radius: 18px; box-shadow: 0 18px 40px rgba(15,23,42,0.08); }
    .toolbar, .panel { padding: 18px 20px; }
    .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
    .toolbar .group, .stack { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .grid { display: grid; gap: 18px; }
    .grid.cols-2 { grid-template-columns: 1.1fr 0.9fr; }
    .grid.cols-3 { grid-template-columns: 300px minmax(0,1fr) 380px; }
    .field { display: grid; gap: 6px; }
    .field label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    input, textarea, select, button { font: inherit; }
    input, textarea, select { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: #fff; }
    textarea { min-height: 90px; resize: vertical; }
    button { border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer; background: var(--ink); color: #fff; }
    button.secondary { background: #fff; color: var(--ink); border: 1px solid var(--line); }
    button.ghost { background: transparent; color: var(--ink); border: 1px dashed var(--line); }
    button.accent { background: var(--accent); }
    button.green { background: var(--green); }
    .deck-list, .slide-list, .block-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .deck-card, .slide-card, .block-card { padding: 14px; border: 1px solid var(--line); background: #fff; border-radius: 14px; }
    .slide-card.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .slide-card.dragging { opacity: 0.5; }
    .muted { color: var(--muted); }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; background: #eef2f7; font-size: 12px; }
    .badge.ok { background: #def7ec; color: #17644c; }
    .badge.warn { background: #fff4de; color: #8b5e00; }
    .badge.fail { background: #fde5e5; color: #982b2b; }
    .preview-frame { width: 100%; min-height: 620px; border: 1px solid var(--line); border-radius: 16px; background: #fff; }
    .mode-switch { background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 4px; display: inline-flex; gap: 4px; }
    .mode-switch button.active { background: var(--accent); color: #fff; }
    .advanced-only { display: none; }
    body[data-ui-mode="advanced"] .advanced-only { display: block; }
    body[data-ui-mode="advanced"] .advanced-inline { display: inline-flex; }
    .advanced-inline { display: none; }
    .log { white-space: pre-wrap; background: #0f172a; color: #e5eef8; padding: 14px; border-radius: 16px; min-height: 120px; }
    @media (max-width: 1100px) { .grid.cols-3, .grid.cols-2 { grid-template-columns: 1fr; } .preview-frame { min-height: 420px; } }
  </style>
</head>
<body data-ui-mode="easy">
  <div class="page">${body}</div>
  <script>${script}</script>
</body>
</html>`;

const renderHomePage = () =>
  shellHtml(
    "Rasid Presentations Workspace",
    `<div class="hero">
      <div>
        <h1>Rasid Campus Presentations Workspace</h1>
        <p>Create decks in Easy or Advanced mode, reopen persisted decks, and continue editing from browser-backed state.</p>
      </div>
      <div class="mode-switch">
        <button id="modeEasy" class="active" type="button">Easy</button>
        <button id="modeAdvanced" type="button">Advanced</button>
      </div>
    </div>
    <div class="grid cols-2">
      <section class="surface">
        <div class="toolbar"><strong>Create deck</strong><span class="badge">Shared foundation only</span></div>
        <form id="createForm" class="panel grid">
          <div class="field"><label>Title</label><input name="title" value="عرض تنفيذي سريع" required /></div>
          <div class="field"><label>Prompt</label><textarea name="prompt">ابن عرضًا عربيًا تنفيذيًا يشرح محرك presentations داخل راصد مع إبراز التوليد والتحرير والتصدير.</textarea></div>
          <div class="field"><label>Support text</label><textarea name="text">يجب أن يبقى المسار editable، وأن تمر جميع المخرجات عبر parity evidence قبل النشر.</textarea></div>
          <div class="advanced-only">
            <div class="field"><label>Audience</label><input name="audience" value="قيادات المنتج" /></div>
            <div class="field"><label>Tone</label><input name="tone" value="direct" /></div>
            <div class="field"><label>Target slide count</label><input name="target_slide_count" type="number" value="6" min="1" /></div>
            <div class="field"><label>Template ref</label><input name="template_ref" value="template://board/ops-review" /></div>
          </div>
          <div class="stack">
            <button class="accent" type="submit">Create deck</button>
            <label class="stack"><input id="autoValidate" type="checkbox" checked /> Auto parity</label>
          </div>
        </form>
      </section>
      <section class="surface">
        <div class="toolbar"><strong>Persisted decks</strong><button id="refreshDecks" class="secondary" type="button">Refresh</button></div>
        <div class="panel"><ul id="deckList" class="deck-list"></ul></div>
      </section>
    </div>`,
    `const setMode = (mode) => {
      document.body.dataset.uiMode = mode;
      document.getElementById("modeEasy").classList.toggle("active", mode === "easy");
      document.getElementById("modeAdvanced").classList.toggle("active", mode === "advanced");
    };
    const deckList = document.getElementById("deckList");
    async function loadDecks() {
      const response = await fetch("/api/decks");
      const decks = await response.json();
      deckList.innerHTML = decks.map((deck) => \`
        <li class="deck-card">
          <div class="stack" style="justify-content: space-between;">
            <strong>\${deck.deck_id}</strong>
            <a class="badge" href="/workspace/\${deck.deck_id}">Open</a>
          </div>
          <div class="meta">
            <span>\${deck.version_id}</span>
            <span>\${deck.updated_at}</span>
          </div>
        </li>\`).join("");
    }
    document.getElementById("modeEasy").addEventListener("click", () => setMode("easy"));
    document.getElementById("modeAdvanced").addEventListener("click", () => setMode("advanced"));
    document.getElementById("refreshDecks").addEventListener("click", loadDecks);
    document.getElementById("createForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const mode = document.body.dataset.uiMode;
      const payload = {
        title: String(formData.get("title") || ""),
        prompt: String(formData.get("prompt") || ""),
        text: String(formData.get("text") || ""),
        audience: String(formData.get("audience") || "قيادات المنتج"),
        tone: String(formData.get("tone") || "direct"),
        target_slide_count: formData.get("target_slide_count") ? Number(formData.get("target_slide_count")) : null,
        template_ref: String(formData.get("template_ref") || "") || null,
        mode,
        auto_validate: document.getElementById("autoValidate").checked
      };
      const response = await fetch("/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Create failed"); return; }
      window.location.href = "/workspace/" + result.deck_id;
    });
    loadDecks();
    setMode("easy");`
  );

const renderWorkspacePage = (deckId: string) =>
  shellHtml(
    `Workspace ${deckId}`,
    `<div class="hero">
      <div>
        <h1 id="deckTitle">Presentation Workspace</h1>
        <p id="deckSubtitle">Reloadable Easy/Advanced workspace backed by persisted deck state.</p>
      </div>
      <div class="stack">
        <a class="secondary badge" href="/">All decks</a>
        <div class="mode-switch">
          <button id="viewEasy" class="active" type="button">Easy</button>
          <button id="viewAdvanced" type="button">Advanced</button>
        </div>
      </div>
    </div>
    <div class="surface">
      <div class="toolbar">
        <div class="group">
          <button id="runParity" class="accent" type="button">Run parity</button>
          <button id="publishDeck" class="green" type="button">Publish</button>
          <button id="bindDeck" class="secondary advanced-inline" type="button">Bind data</button>
          <button id="lockSoft" class="secondary advanced-inline" type="button">Soft lock</button>
          <button id="lockStrict" class="secondary advanced-inline" type="button">Strict lock</button>
        </div>
        <div class="meta">
          <span id="deckStatus" class="badge">Loading</span>
          <span id="parityStatus" class="badge">No parity yet</span>
        </div>
      </div>
      <div class="panel grid cols-3">
        <section class="surface">
          <div class="toolbar">
            <strong>Slides</strong>
            <div class="group">
              <button id="addSlide" class="secondary" type="button">Add</button>
              <button id="deleteSlide" class="ghost" type="button">Delete</button>
              <button id="regenerateSlide" class="ghost" type="button">Regenerate</button>
            </div>
          </div>
          <div class="panel">
            <p class="muted">Drag cards to reorder them.</p>
            <ul id="slideList" class="slide-list"></ul>
          </div>
        </section>
        <section class="surface">
          <div class="toolbar"><strong>Reader preview</strong><div class="group"><a id="pptxLink" class="badge" target="_blank">PPTX</a><a id="pdfLink" class="badge" target="_blank">PDF</a><a id="htmlLink" class="badge" target="_blank">HTML</a></div></div>
          <div class="panel"><iframe id="readerFrame" class="preview-frame" title="Reader preview"></iframe></div>
        </section>
        <section class="surface">
          <div class="toolbar"><strong>Selected slide</strong><span id="selectedBadge" class="badge">None</span></div>
          <div class="panel grid">
            <div id="slideMeta" class="meta"></div>
            <ul id="blockList" class="block-list"></ul>
            <div class="advanced-only">
              <div class="field"><label>Replace selected block kind</label><select id="blockKindSelect"><option value="chart">chart</option><option value="table">table</option><option value="infographic">infographic</option><option value="grouped_infographic">grouped_infographic</option><option value="body">body</option></select></div>
              <button id="replaceBlockKind" class="secondary" type="button">Apply block kind</button>
            </div>
            <div class="field"><label>Activity log</label><div id="activityLog" class="log"></div></div>
          </div>
        </section>
      </div>
    </div>`,
    `const deckId = ${JSON.stringify(deckId)};
    let bundle = null;
    let selectedSlideRef = null;
    let selectedBlockRef = null;
    let dragSlideRef = null;
    const log = (message) => {
      const node = document.getElementById("activityLog");
      node.textContent = [new Date().toLocaleTimeString(), message, node.textContent].filter(Boolean).join("\\n");
    };
    const setMode = (mode) => {
      document.body.dataset.uiMode = mode;
      document.getElementById("viewEasy").classList.toggle("active", mode === "easy");
      document.getElementById("viewAdvanced").classList.toggle("active", mode === "advanced");
    };
    const currentStoryboards = () => bundle?.storyboard || [];
    const slideRefFor = (slide) => "slide-" + deckId + "-" + slide.slide_order;
    async function loadBundle() {
      const response = await fetch("/api/decks/" + deckId);
      bundle = await response.json();
      document.getElementById("deckTitle").textContent = bundle.deck.title;
      document.getElementById("deckSubtitle").textContent = bundle.deck.description || "Presentation workspace";
      document.getElementById("deckStatus").textContent = bundle.deck.status;
      document.getElementById("parityStatus").textContent = bundle.parityValidation?.overall_status || "not_validated";
      document.getElementById("parityStatus").className = "badge " + (bundle.parityValidation?.publish_ready ? "ok" : bundle.parityValidation ? "warn" : "");
      document.getElementById("pptxLink").href = "/files/" + deckId + "/presentation.pptx";
      document.getElementById("pdfLink").href = "/files/" + deckId + "/presentation.pdf";
      document.getElementById("htmlLink").href = "/files/" + deckId + "/presentation.html";
      document.getElementById("readerFrame").src = "/files/" + deckId + "/reader.html?ts=" + encodeURIComponent(bundle.deck.updated_at);
      renderSlides();
      if (!selectedSlideRef && bundle.storyboard.length > 0) selectedSlideRef = slideRefFor(bundle.storyboard[0]);
      renderSelection();
    }
    function renderSlides() {
      const list = document.getElementById("slideList");
      list.innerHTML = bundle.storyboard.map((slide, index) => {
        const slideRef = slideRefFor(slide);
        return \`
        <li class="slide-card \${slideRef === selectedSlideRef ? "active" : ""}" data-slide-ref="\${slideRef}" draggable="true">
          <div class="stack" style="justify-content: space-between;">
            <strong>\${index + 1}. \${slide.slide_title}</strong>
            <span class="badge">\${slide.layout_ref}</span>
          </div>
          <div class="meta">
            <span>\${slide.content_density}</span>
            <span>\${slide.editability}</span>
            <span>\${slide.master_ref || "no-master"}</span>
          </div>
        </li>\`;
      }).join("");
      Array.from(list.querySelectorAll(".slide-card")).forEach((node) => {
        node.addEventListener("click", () => {
          selectedSlideRef = node.dataset.slideRef;
          renderSlides();
          renderSelection();
        });
        node.addEventListener("dragstart", (event) => {
          dragSlideRef = node.dataset.slideRef;
          event.dataTransfer?.setData("text/plain", dragSlideRef || "");
          node.classList.add("dragging");
        });
        node.addEventListener("dragend", () => node.classList.remove("dragging"));
        node.addEventListener("dragover", (event) => event.preventDefault());
        node.addEventListener("drop", async (event) => {
          event.preventDefault();
          const sourceSlideRef = dragSlideRef || event.dataTransfer?.getData("text/plain");
          if (!sourceSlideRef || sourceSlideRef === node.dataset.slideRef) return;
          const targetIndex = bundle.storyboard.findIndex((item) => slideRefFor(item) === node.dataset.slideRef);
          await mutate({ mutation_kind: "reorder_slide", slide_ref: sourceSlideRef, new_index: targetIndex }, "slide reordered by drag-and-drop");
        });
      });
    }
    function renderSelection() {
      const storyboard = currentStoryboards().find((item) => slideRefFor(item) === selectedSlideRef);
      const blocks = (bundle.slideBlocks || []).filter((item) => item.slide_ref === selectedSlideRef);
      document.getElementById("selectedBadge").textContent = storyboard ? storyboard.slide_title : "None";
      document.getElementById("slideMeta").innerHTML = storyboard ? [
        "<span>" + storyboard.layout_ref + "</span>",
        "<span>" + (storyboard.master_ref || "no-master") + "</span>",
        "<span>" + storyboard.editability + "</span>",
        "<span>" + storyboard.notes_intent + "</span>"
      ].join("") : "";
      const list = document.getElementById("blockList");
      list.innerHTML = blocks.map((block) => \`
        <li class="block-card" data-block-ref="\${block.slide_block_id}">
          <div class="stack" style="justify-content: space-between;">
            <strong>\${block.block_kind}</strong>
            <span class="badge">\${block.editability}</span>
          </div>
          <div class="muted">\${(block.content?.[0]?.value || "").slice(0, 160)}</div>
          <div class="meta advanced-only">
            <span>\${block.layout_zone_ref || "no-zone"}</span>
            <span>\${(block.data_binding_refs || []).join(", ") || "no-bindings"}</span>
          </div>
        </li>\`).join("");
      Array.from(list.querySelectorAll(".block-card")).forEach((node) => {
        node.addEventListener("click", () => {
          selectedBlockRef = node.dataset.blockRef;
          renderSelection();
        });
      });
    }
    async function api(path, body) {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed");
      return result;
    }
    async function mutate(mutation, action) {
      const result = await api("/api/decks/" + deckId + "/mutate", { actor_ref: "workspace-user", mutation });
      bundle = result.bundle;
      selectedSlideRef = mutation.slide_ref || selectedSlideRef;
      renderSlides();
      renderSelection();
      log(action);
    }
    document.getElementById("viewEasy").addEventListener("click", () => setMode("easy"));
    document.getElementById("viewAdvanced").addEventListener("click", () => setMode("advanced"));
    document.getElementById("addSlide").addEventListener("click", async () => {
      const title = prompt("Slide title", "New slide");
      if (!title) return;
      await mutate({ mutation_kind: "add_slide", title, bullets: ["New point"], summary: "Added from workspace" }, "slide added");
    });
    document.getElementById("deleteSlide").addEventListener("click", async () => {
      if (!selectedSlideRef) return;
      await mutate({ mutation_kind: "delete_slide", slide_ref: selectedSlideRef }, "slide deleted");
    });
    document.getElementById("regenerateSlide").addEventListener("click", async () => {
      if (!selectedSlideRef) return;
      await mutate({ mutation_kind: "regenerate_slide", slide_ref: selectedSlideRef, override_prompt: "Refine this slide from workspace." }, "slide regenerated");
    });
    document.getElementById("replaceBlockKind").addEventListener("click", async () => {
      if (!selectedBlockRef) return;
      const newBlockKind = document.getElementById("blockKindSelect").value;
      await mutate({ mutation_kind: "replace_block_kind", block_ref: selectedBlockRef, new_block_kind: newBlockKind }, "block kind replaced");
    });
    document.getElementById("bindDeck").addEventListener("click", async () => {
      const result = await api("/api/decks/" + deckId + "/bind", { actor_ref: "workspace-user", source_refs: bundle.bindingSet.bindings.map((item) => item.source_ref) });
      bundle = result.bundle;
      renderSlides();
      renderSelection();
      log("bindings refreshed");
    });
    document.getElementById("lockSoft").addEventListener("click", async () => {
      const result = await api("/api/decks/" + deckId + "/template-lock", { actor_ref: "workspace-user", template_ref: bundle.deck.template_ref || "template://board/ops-review", brand_preset_ref: bundle.deck.brand_preset_ref || null, lock_mode: "soft_lock" });
      bundle = result.bundle;
      renderSlides();
      renderSelection();
      log("soft lock applied");
    });
    document.getElementById("lockStrict").addEventListener("click", async () => {
      const result = await api("/api/decks/" + deckId + "/template-lock", { actor_ref: "workspace-user", template_ref: bundle.deck.template_ref || "template://board/ops-review", brand_preset_ref: bundle.deck.brand_preset_ref || null, lock_mode: "strict_lock" });
      bundle = result.bundle;
      renderSlides();
      renderSelection();
      log("strict lock applied");
    });
    document.getElementById("runParity").addEventListener("click", async () => {
      const result = await api("/api/decks/" + deckId + "/parity", {});
      bundle = result.bundle;
      await loadBundle();
      log("parity rerun");
    });
    document.getElementById("publishDeck").addEventListener("click", async () => {
      const result = await api("/api/decks/" + deckId + "/publish", { published_by: "workspace-user", target_ref: "workspace://presentations/" + deckId, publish_to_library: true, allow_degraded: false });
      bundle = result.bundle;
      await loadBundle();
      log("deck published");
    });
    loadBundle();
    setMode("easy");`
  );

export const startPresentationWorkspaceServer = async (options: {
  port?: number;
  host?: string;
  engine?: PresentationEngine;
} = {}): Promise<PresentationWorkspaceServerHandle> => {
  const engine = options.engine ?? new PresentationEngine();
  const host = options.host ?? "127.0.0.1";
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}`);
      const pathname = url.pathname;
      if ((request.method ?? "GET") === "GET" && pathname === "/") {
        sendHtml(response, renderHomePage());
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/decks") {
        sendJson(response, 200, engine.listDecks());
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/workspace\/[^/]+$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[2] ?? "");
        sendHtml(response, renderWorkspacePage(deckId));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/decks\/[^/]+$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        sendJson(response, 200, engine.loadBundle(deckId));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/files\/[^/]+\/[^/]+$/.test(pathname)) {
        const [, , deckId, fileName] = pathname.split("/");
        sendFile(response, engine.store.resolveDeckFile(decodeURIComponent(deckId), "files", decodeURIComponent(fileName)));
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/decks") {
        const payload = WorkspaceCreateRequestSchema.parse(await readJsonBody(request));
        let bundle = await engine.createPresentation(normalizeCreatePayload(payload));
        if (payload.auto_validate) {
          bundle = (await engine.runRenderParityValidation(bundle)).bundle;
        }
        sendJson(response, 200, { deck_id: bundle.deck.deck_id, bundle });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/decks\/[^/]+\/mutate$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        const payload = MutationRequestSchema.parse(await readJsonBody(request));
        const bundle = engine.mutatePresentation({
          bundle: engine.loadBundle(deckId),
          actor_ref: payload.actor_ref,
          mutation: payload.mutation as Parameters<PresentationEngine["mutatePresentation"]>[0]["mutation"]
        });
        sendJson(response, 200, { deck_id: deckId, bundle });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/decks\/[^/]+\/bind$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        const payload = BindRequestSchema.parse(await readJsonBody(request));
        const bundle = engine.bindDeckToData({
          bundle: engine.loadBundle(deckId),
          actor_ref: payload.actor_ref,
          source_refs: payload.source_refs
        });
        sendJson(response, 200, { deck_id: deckId, bundle });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/decks\/[^/]+\/template-lock$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        const payload = TemplateRequestSchema.parse(await readJsonBody(request));
        const bundle = engine.applyTemplateLock({
          bundle: engine.loadBundle(deckId),
          actor_ref: payload.actor_ref,
          template_ref: payload.template_ref,
          brand_preset_ref: payload.brand_preset_ref,
          lock_mode: payload.lock_mode
        });
        sendJson(response, 200, { deck_id: deckId, bundle });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/decks\/[^/]+\/parity$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        const result = await engine.runRenderParityValidation(engine.loadBundle(deckId));
        sendJson(response, 200, { deck_id: deckId, bundle: result.bundle, parityValidation: result.parityValidation });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/decks\/[^/]+\/publish$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[3] ?? "");
        const payload = PublishRequestSchema.parse(await readJsonBody(request));
        const result = engine.publishPresentation({
          bundle: engine.loadBundle(deckId),
          published_by: payload.published_by,
          target_ref: payload.target_ref,
          publish_to_library: payload.publish_to_library,
          allow_degraded: payload.allow_degraded
        });
        sendJson(response, 200, { deck_id: deckId, bundle: result.bundle, publication: result.publication, libraryAsset: result.libraryAsset });
        return;
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  return {
    origin: `http://${host}:${port}`,
    port,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
};
