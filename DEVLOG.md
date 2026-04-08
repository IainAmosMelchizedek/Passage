# Passage — Technical Development Document
### Version 1.0 | April 8, 2026 | Author: Iain Melchizedek

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [What Passage Solves](#what-passage-solves)
3. [The Differentiation](#the-differentiation)
4. [Technology Stack](#technology-stack)
5. [Architecture Overview](#architecture-overview)
6. [Development Timeline](#development-timeline)
7. [Troubleshooting Log](#troubleshooting-log)
8. [Known Issues and Future Iterations](#known-issues-and-future-iterations)
9. [Deployment](#deployment)
10. [Lessons Learned](#lessons-learned)

---

## Problem Statement

Modern travel is a documentation problem. When a traveler books a trip, they accumulate multiple confirmation emails across multiple platforms — one from the airline, one from the rental car company booked through a third-party aggregator like Priceline, one from an Airbnb host, possibly one from a hotel. Each of these documents contains logistical information, but that information is fragmented, buried in marketing copy, and formatted differently by every vendor.

The result is a passenger standing in an airport terminal — jet-lagged, disoriented, and surrounded by noise — pulling up four different email threads trying to find the one sentence that tells them what to do next.

In the specific case that inspired this application: a traveler flying into Denver International Airport had booked a rental car through Priceline via Routes Car Rental, an off-airport vendor. The pickup instructions were buried in the confirmation email and contained highly specific operational details:

- Upon arrival, **call 720-892-5301** for shuttle pickup instructions
- **West Terminal:** Proceed to **Level 5** baggage claim, exit **door 514**, proceed to **Island 4**, stand under the sign that reads **"Off Airport Rental Car"** — shuttles run every **20-30 minutes**
- **East Terminal:** Proceed to **Level 5** baggage claim, exit **door 503**, proceed to **Island 4**, stand under the sign that reads **"Off Airport Rental Car"** — shuttles run every **20-30 minutes**

No existing travel application surfaced this information as a discrete, actionable, step-by-step sequence. The traveler was expected to find it themselves. That is the problem Passage was built to solve.

---

## What Passage Solves

Passage is an AI-powered travel itinerary builder that accepts raw confirmation documents — PDFs, pasted email text, or both simultaneously — and converts them into a precise, chronological, step-by-step operational itinerary.

Unlike existing travel aggregators, Passage does not simply organize bookings. It reads between the lines of confirmation documents to extract the operational nuance that causes traveler anxiety: which door to exit, which level to go to, which phone number to call before leaving baggage claim, which island number to stand at, how frequently the shuttle runs, where to park at the Airbnb, which room to go to, and what the keypad entry procedure is.

Every extracted detail is surfaced as its own discrete, color-coded step in a chronological timeline — grouped by day, timestamped, and labeled by category. The itinerary can be printed or downloaded as a self-contained HTML file for offline access on any device.

---

## The Differentiation

### Existing Tools

**TripIt** — Parses confirmation emails into a chronological list of bookings. Organizes what you booked. Does not extract operational instructions embedded in confirmation text. Real-world user complaints document that TripIt frequently gets the sequence of events wrong (e.g., listing hotel check-in before car rental pickup when the car rental happens first). Requires manual correction.

**Google Trips (discontinued)** — Similar aggregation approach, no operational nuance extraction.

**Airline and rental car apps** — Siloed. Each app knows only its own reservation. No cross-vendor synthesis.

### Passage

Passage synthesizes all vendor confirmations into one unified operational sequence. It does not summarize. It does not organize. It reads the actual language of the confirmation documents and extracts every actionable instruction — verbatim, with exact numbers, exact door names, exact phone numbers — and presents them as individual steps a traveler can follow one at a time.

The core thesis: **anxiety in travel comes from not knowing what to do next. Passage eliminates that by telling you exactly what to do next, at every step, with every specific detail you need.**

---

## Technology Stack

### Runtime Environment
- **Node.js** — v20.x LTS (Windows, managed via system install)
- **npm** — v10.x (package manager)

### Frontend Framework
- **React** — v19.x (UI component library)
- **ReactDOM** — v19.x (DOM rendering)
- **Vite** — v6.x (build tool and dev server, replaces Create React App)
- **@vitejs/plugin-react** — Vite plugin for React JSX compilation

### PDF Processing
- **pdfjs-dist** — Mozilla's production-grade PDF.js library (v4.x)
  - Used for text extraction from standard, text-based PDFs
  - Runs with a dedicated Web Worker (`pdf.worker`) for non-blocking processing
  - Falls back gracefully when extracted text is insufficient

### AI / API
- **Anthropic Claude API** — `claude-sonnet-4-20250514`
  - Model: Claude Sonnet 4 (claude-sonnet-4-20250514)
  - Called directly from the browser using `anthropic-dangerous-direct-browser-access: true` header
  - Used for intelligent parsing of all confirmation content
  - Handles both text-extracted PDF content and raw base64-encoded PDFs (for web-generated or image-based PDFs)
  - Max tokens: 2000 per response to accommodate detailed multi-step itineraries

### Analytics
- **@vercel/analytics** — Vercel's native analytics package, injected at app root

### Version Control
- **Git** — Managed via **Git Bash** on Windows
- **GitHub** — Remote repository hosted at `github.com/IainAmosMelchizedek/Passage`
- Repository visibility: **Public**

### Deployment
- **Vercel** — Hobby tier, connected directly to GitHub repository
- Auto-deploys on every push to `main` branch
- Build preset: **Vite** (auto-detected by Vercel)
- Live URL: `https://passage-three-chi.vercel.app`

---

## Architecture Overview

```
User Browser
│
├── PDF Upload (drag/drop or file browse)
│     └── processPDF.js
│           ├── Attempt 1: pdf.js text extraction
│           │     └── If extracted text ≥ 200 chars → send as text
│           └── Attempt 2: FileReader base64 encoding
│                 └── If text extraction fails or insufficient → send as base64 document
│
├── Paste Text Input
│     └── Stored in pastedText state
│
└── On "Build my itinerary":
      └── Anthropic API Call (claude-sonnet-4-20250514)
            ├── Content parts assembled:
            │     ├── [Optional] PDF as base64 document block
            │     ├── [Optional] PDF as extracted text block
            │     └── [Optional] Pasted text block
            └── Response: JSON array of itinerary steps
                  └── Rendered as chronological timeline
                        ├── Grouped by date
                        ├── Color-coded by type (flight/car/lodging/action/alert/end)
                        └── Exportable as HTML or printable
```

### File Structure

```
passage/
├── index.html                  # Vite entry point
├── vite.config.js              # Vite configuration with React plugin
├── package.json                # Dependencies and scripts
├── .gitignore                  # Excludes node_modules, dist, .env
├── README.md                   # Public-facing project documentation
└── src/
    ├── main.jsx                # React root, Vercel analytics injection
    ├── App.jsx                 # Main application component (all UI + API logic)
    └── processPDF.js           # PDF processing module (pdf.js + base64 fallback)
```

---

## Development Timeline

### Session: April 8, 2026 — Single Day Build

**Origin** — Developer needed a rental car pickup itinerary for a same-day trip. Claude parsed the confirmation documents and built a manual timeline. The question arose: why doesn't a tool already exist that does this automatically, with the operational nuance?

**Phase 1: Prototype in Claude Artifacts**
- Built initial React component as a Claude artifact
- Pasted text input → Anthropic API → JSON itinerary → timeline render
- Iterated on design: dark navy skyline header, light body, color-coded timeline cards
- Identified need for PDF upload support

**Phase 2: PDF Upload — First Attempt**
- Added file upload zone with drag-and-drop
- Initial approach: store PDF as base64 in state, send to Anthropic as document block
- Problem: `btoa()` binary string conversion was failing silently on large files
- Error returned: `messages.0.content.0.document.source.base64: PDF cannot be empty`

**Phase 3: PDF.js Integration**
- Installed `pdfjs-dist` for proper PDF text extraction
- Moved PDF processing logic into dedicated `src/processPDF.js` module
- Configured pdf.js Web Worker via Vite's `?url` import
- Problem: Priceline PDF was a web-page-saved PDF — text extraction returned fragmented, out-of-order content that the API could not meaningfully parse

**Phase 4: Dual-Path PDF Processing**
- Implemented intelligent fallback logic:
  - Try pdf.js text extraction first
  - If extracted text ≥ 200 characters and appears coherent → use as text
  - If extraction fails or returns insufficient content → fall back to FileReader base64 encoding and send as native document block to Claude
- Fixed base64 encoding: replaced `btoa(binary)` with `FileReader.readAsDataURL()` on the original `File` object — eliminated the empty base64 error
- Both PDF and pasted text now sent simultaneously as separate content blocks in a single API call

**Phase 5: System Prompt Hardening**
- Initial prompt was too permissive — AI summarized instead of extracting verbatim
- Added explicit CRITICAL RULES:
  - Every phone number, door number, level number, island number must appear verbatim
  - Rental car pickup instructions broken into individual steps
  - Each terminal direction (west/east) gets its own step
  - Each "proceed to X" instruction gets its own step
- Increased `max_tokens` from 1000 to 2000 to accommodate detailed multi-step output

**Phase 6: Design Iteration**
- Iterated through multiple color schemes
- Final design: navy skyline SVG header with city silhouette, gold sun, stars — flows into light gray body
- Timeline cards: color-coded left border stripe by category, tinted background per type
- "Build my itinerary" button: dark navy with gold text, uppercase, full width — unmissable
- Added API key input field with show/hide toggle and link to console.anthropic.com

**Phase 7: GitHub and Vercel Deployment**
- Initialized local Git repository in Git Bash
- Created `Passage` repository on GitHub (IainAmosMelchizedek/Passage)
- Resolved merge conflicts between local and remote (GitHub auto-created README)
- Pushed via `ALLOW_MAIN_PUSH=1` (branch protection hook on account)
- Imported repository to Vercel — auto-detected as Vite project
- Deployed in one click
- Added Vercel Analytics — installed package, injected at app root, pushed update

---

## Troubleshooting Log

### Issue 1: PDF base64 empty error
**Error:** `messages.0.content.0.document.source.base64: PDF cannot be empty`
**Cause:** `btoa(String.fromCharCode(...bytes))` fails silently on large binary files in browser environments due to call stack limitations
**Resolution:** Replaced with `FileReader.readAsDataURL(file)` reading the original `File` object directly — produces a valid, complete base64 data URL from which the base64 portion is split cleanly

### Issue 2: Web-generated PDF not readable by pdf.js
**Cause:** Priceline confirmation was a browser-saved webpage PDF. These PDFs store content as rendered layout objects rather than a linear text stream. pdf.js extracts the text layer but the content is fragmented and out of order
**Resolution:** Implemented 200-character threshold check. If pdf.js extraction returns less than 200 characters or fails, the system automatically falls back to sending the raw PDF as a base64 document block, allowing Claude to read the rendered page visually

### Issue 3: Rental car shuttle instructions not captured
**Cause:** System prompt was too general — AI was summarizing the rental car section rather than extracting each instruction as a discrete step
**Resolution:** Added explicit CRITICAL RULES to system prompt requiring verbatim extraction of every phone number, door number, level number, island number, and terminal direction as its own dedicated step

### Issue 4: PDF and pasted text mutually exclusive
**Cause:** Initial architecture stored either a PDF or pasted text — uploading a PDF replaced the text input state
**Resolution:** Separated into two independent state variables (`pdfResult` and `pastedText`). Both are assembled into a `contentParts` array and sent as a single multi-block API call. Users can now provide both simultaneously

### Issue 5: Git push blocked
**Cause:** GitHub account has a branch protection hook that prevents direct pushes to `main`
**Resolution:** Prefix push command with `ALLOW_MAIN_PUSH=1` environment variable to override the hook

### Issue 6: Git merge conflict on first push
**Cause:** GitHub auto-created a README commit when the repository was initialized, diverging from the local commit history
**Resolution:** `git pull origin main --allow-unrelated-histories` followed by `git merge origin/main --allow-unrelated-histories` to reconcile the two histories before pushing

---

## Known Issues and Future Iterations

### PDF Robustness

| Issue | Current Behavior | Future Fix |
|-------|-----------------|------------|
| Image-only / scanned PDFs | Base64 path handles most cases; very low-res scans may fail | Integrate OCR (e.g., Tesseract.js) as a third fallback path |
| Password-protected PDFs | Silent failure with generic error | Detect encrypted PDFs early and prompt user to unlock before uploading |
| Very large PDFs (50+ pages) | Base64 payload may exceed Anthropic API document size limits | Pre-process to extract only pages containing travel-relevant keywords |
| Complex column layouts | pdf.js may extract text out of reading order | Apply layout-aware text extraction with column detection |
| Mobile app-generated PDFs | Non-standard encoding may cause both paths to fail | Build a test suite of PDFs from common travel apps and handle edge cases explicitly |
| Corrupted PDFs | Generic error message | Detect corruption at file read time and return a specific, actionable error |

### Core Features Shipped in v1.0

| Feature | Description |
|---------|-------------|
| **PDF Upload** | Drag-and-drop or browse — accepts PDF, .txt, .eml |
| **Paste Text** | Accepts raw confirmation email text alongside or instead of a PDF |
| **Dual-source parsing** | PDF and pasted text are combined and sent together in one API call |
| **Chronological timeline** | Steps grouped by day, timestamped, color-coded by category |
| **Print** | Browser native print dialog — user can print to paper or save as PDF via their OS print driver |
| **Save** | Downloads a self-contained HTML file of the full itinerary — opens in any browser, works offline, shareable via text or email, viewable on any phone without needing the app |
| **New Trip** | Resets the entire application state — clears PDF, pasted text, and itinerary — ready for a new set of confirmations without refreshing the page |
| **API key input** | Show/hide toggle, gold border activation indicator, direct link to console.anthropic.com |
| **Loading states** | Rotating spinner with rotating status messages during API processing |

The Print and Save functions deserve particular note. Together they solve the offline access problem — a traveler who saves their itinerary as an HTML file can airdrop it to their phone, save it to their photos app as a screenshot, or simply keep the file locally and open it in any mobile browser without a data connection. The Print function allows the itinerary to be committed to paper or saved as a PDF through the operating system's native print-to-PDF driver, which is available on Windows, macOS, and iOS without any additional software.

### Feature Roadmap

1. **Multiple PDF uploads** — Currently limited to one PDF per session. Future version will accept multiple PDFs simultaneously (e.g., one for flights, one for rental car, one for hotel)
2. **Email forwarding** — Allow users to forward confirmation emails directly to a Passage email address, eliminating the need to paste text manually
3. **Persistent itineraries** — Store itineraries server-side so they survive page refresh and remain accessible throughout the trip duration
4. **Trip phases** — Separate outbound and return legs into distinct views so travelers focus only on what's immediately ahead
5. **Push notifications** — Alert travelers at time-sensitive moments (e.g., "Your shuttle window opens in 30 minutes")
6. **Custom domain** — Move from `passage-three-chi.vercel.app` to a dedicated domain (e.g., `passageapp.io`)
7. **Server-side API proxy** — Move the Anthropic API call to a Vercel serverless function so users don't need to supply their own API key
8. **Mobile-optimized layout** — Optimize the timeline view for small screens and add a PWA manifest for home screen installation
9. **Offline mode** — Cache the generated itinerary in localStorage or IndexedDB so it's accessible without internet

---

## Deployment

### Local Development

```bash
# Clone the repository
git clone https://github.com/IainAmosMelchizedek/Passage.git
cd Passage

# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:5173
```

### Production Build

```bash
npm run build
# Output in /dist — auto-deployed by Vercel on push to main
```

### Pushing Updates

```bash
git add .
git commit -m "Your commit message"
ALLOW_MAIN_PUSH=1 git push origin main
# Vercel auto-deploys within ~60 seconds
```

### Live URL
```
https://passage-three-chi.vercel.app
```

### GitHub Repository
```
https://github.com/IainAmosMelchizedek/Passage
```

---

## Lessons Learned

**1. The nuance is the product.** The technical challenge of this build was not the UI, not the API integration, not the deployment. It was getting the AI to stop summarizing and start extracting. The system prompt is the core of what makes Passage different from a simple "parse my email" tool. Every CRITICAL RULE in the prompt represents a failure mode that was caught in testing.

**2. PDF is not a format — it is a family of formats.** A PDF generated by a web browser, a PDF generated by a desktop application, a PDF scanned from paper, and a PDF produced by a mobile app are four fundamentally different technical objects that happen to share a file extension. Robust PDF handling requires a multi-path strategy, not a single library call.

**3. FileReader is the correct tool for browser-side binary encoding.** `btoa()` is not suitable for large binary files in browser environments. `FileReader.readAsDataURL()` on the original `File` object is the correct, reliable approach.

**4. Ship first, harden later.** Version 1.0 has known limitations. It shipped anyway. A functioning tool that solves the core problem for the majority of users is more valuable than a perfect tool that never ships. The known issues are documented. The roadmap is clear. The foundation is solid.

**5. Anxiety is a UX problem.** The insight that drove this entire build was not technical. It was observational: travelers are anxious because they don't know what to do next. Every design and engineering decision — the step-by-step timeline, the verbatim extraction rule, the color-coded categories, the offline save feature — flows from that single human observation.

---

*Passage v1.0 — Built in one day. April 8, 2026.*
*Safe Passage Strategies LLC*
EOF
