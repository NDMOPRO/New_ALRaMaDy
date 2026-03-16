# Implementation Plan - Phase 16

## Matching Engine (CDR) - Key Changes Needed

### Current State:
- Vision API call works (sends image to GPT-4o, gets JSON back)
- But result is ONLY displayed as accuracy metrics/details list
- **MISSING**: Actually creating live dashboard/report/presentation/excel from the parsed result

### What Must Change:
1. When Vision API returns parsed JSON for "dashboard" → Create REAL dashboard in DB and navigate to DashboardEngine
2. When Vision API returns parsed JSON for "report" → Create REAL report in DB and navigate to ReportsEngine
3. When Vision API returns parsed JSON for "presentation" → Create REAL presentation in DB and navigate to PresentationsEngine
4. When Vision API returns parsed JSON for "excel" → Create REAL spreadsheet in DB and navigate to ExcelEngine
5. When Vision API returns parsed JSON for "table" → Create REAL spreadsheet in DB and navigate to ExcelEngine

### Implementation:
- After Vision API returns parsed data, call the appropriate tRPC create mutation
- Transform parsed data into the format each engine expects
- Navigate to the engine with the new item's ID
- Add "فتح في المحرك" button to result view

## Presentations Engine - Key Features to Add

### Create from Sources (AI-powered):
1. From text/prompt → Already has generateSlides route, need to wire UI properly
2. From PDF → Upload PDF, extract text via Vision API, then generate slides
3. From URL → Fetch URL content, then generate slides
4. From images → Upload images, use as slide backgrounds or analyze content
5. From CSV/Excel data → Parse data, create data visualization slides
6. From JSON → Parse JSON structure into slides
7. Deep research → Use AI to research topic and create slides

### Templates & Brand Kit:
- Already has 7 templates - need to add brand kit customization
- Add ability to import custom template
- Add brand kit panel (logo, colors, fonts)

### Export:
- PPTX export already implemented with pptxgenjs
- PDF export needed
- Image export (JPEG per slide) needed

### Interactive Elements:
- Quizzes/polls on slides
- Clickable elements
- Branching scenarios

### AI Features:
- Translate slides
- Rewrite/improve text
- Summarize text
- Expand text
- Generate speaker notes
- Generate images for slides

### Presenter Mode:
- Full-screen presentation view
- Speaker notes display
- Timer
- Slide navigation

### Collaboration:
- Comments on slides
- Slide locking
- Share via link
