# Passage — Travel Itinerary Builder

> Most travel planners organize your bookings. Passage reads between the lines.

## The Problem

Existing trip planning tools — TripIt, Google Trips, and others — do a reasonable job of aggregating your reservations into a chronological list. But they stop there. They don't tell you which door to exit at the airport. They don't tell you to call the shuttle company before you leave baggage claim. They don't tell you which island to stand on, which sign to look for, or that the shuttle only runs every 20-30 minutes.

That gap — between having your confirmations and knowing what to actually do — is where traveler anxiety lives. You're standing in a terminal, jet-lagged, pulling up four different emails trying to find the one sentence that tells you what to do next.

Passage solves this. Paste or upload your confirmations and Passage extracts every operational detail — door numbers, level numbers, phone numbers, shuttle frequencies, terminal-specific directions, keypad codes, parking notes — and lays them out as a precise, step-by-step sequence in chronological order. One view. Everything you need. Nothing missing.

## What Passage Does

- Accepts PDF uploads and pasted confirmation text simultaneously
- Intelligently processes PDFs using two methods: text extraction via pdf.js for standard PDFs, and direct base64 visual parsing via Claude for web-generated or image-based PDFs
- Combines all sources into a single API call for unified parsing
- Extracts granular operational steps that other tools ignore — shuttle pickup instructions, terminal exit doors, baggage claim levels, island numbers, call-ahead requirements, room access codes, parking directions
- Presents everything in a clean, color-coded chronological timeline grouped by day
- Supports Print and Save (downloadable HTML) so your itinerary is accessible offline and on your phone without needing the app

## How to Use

1. Upload your confirmation PDF using the drop zone, or drag and drop it
2. Paste any additional confirmation emails into the text area — flight, hotel, Airbnb, rental car
3. Enter your Anthropic API key (get one at console.anthropic.com)
4. Hit **Build my itinerary**
5. Save or print your itinerary for offline access

You can use the PDF upload and the paste box simultaneously — Passage reads both together.

## Tech Stack

- React + Vite
- pdf.js (pdfjs-dist) for text-based PDF extraction
- Anthropic Claude API (claude-sonnet-4-20250514) for intelligent parsing and base64 PDF visual reading
- Deployed on Vercel

## API Key

Passage requires an Anthropic API key to function. Your key is entered by you at runtime, is never stored anywhere, and goes directly to Anthropic's API. Get your key at https://console.anthropic.com.

## Known PDF Challenges — Future Hardening

The following edge cases are known and will be addressed in future versions:

1. **Image-only PDFs (scanned documents)** — No text layer exists. pdf.js extraction returns nothing and base64 visual parsing is the only path. Works today but may struggle with very low resolution scans.
2. **Password-protected PDFs** — Will fail silently. Future version will detect and prompt the user to unlock the PDF first.
3. **Very large PDFs (50+ pages)** — Base64 payload may exceed Anthropic API size limits. Future version will extract only relevant pages before sending.
4. **Complex column layouts** — pdf.js may extract text out of reading order when columns are present. Future version will apply layout-aware extraction.
5. **Mobile app-generated PDFs** — Some mobile apps use non-standard PDF encoding that neither pdf.js nor base64 parsing handles cleanly. Needs case-by-case testing.
6. **Corrupted or partially downloaded PDFs** — Currently surfaces a generic error. Future version will detect corruption early and give the user a clear, actionable message.

## Why This Exists

Current travel apps assume you already know what to do when you land. Passage assumes you don't — and gives you the exact operational sequence you need to get from the gate to your destination without pulling up a single email.

## License

MIT
