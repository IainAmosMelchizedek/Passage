import { useState, useRef, useCallback } from "react";
import { processPDF } from "./processPDF";





const SYSTEM = `You are an expert travel logistics analyst. The user will provide raw text from one or more travel confirmation emails or documents — flights, rental cars, hotels, Airbnb, shuttles, etc.

CRITICAL RULES:
1. Every phone number, door number, level number, island number, terminal name, and shuttle frequency found in the text MUST appear verbatim in the detail field of its own dedicated step.
2. Rental car pickup instructions MUST be broken into separate steps — one step for "call ahead", one step for "go to baggage claim level", one step for each terminal option (west/east/etc), one step for the shuttle wait.
3. Never summarize or paraphrase specific operational instructions. Copy the exact details.
4. Airbnb and hotel check-in instructions (keypad, parking, room number, staircase directions) must each be their own dedicated step with exact wording.
5. Any instruction that says "proceed to X" or "exit door Y" or "stand at island Z" gets its own step.
6. You may receive content from multiple sources combined together. Parse ALL of it as one trip.

Return ONLY a valid JSON array. No explanation, no markdown, no backticks — raw JSON only.

Each object must have:
- "time": display time string like "5:15 AM" or "~9:00 AM" (estimate with ~ if not explicit)
- "date": display date string like "Thu, Apr 9"
- "sortKey": ISO datetime string like "2026-04-09T05:15:00"
- "type": one of: flight | car | lodging | action | alert | end
- "category": short label — be specific: "Shuttle pickup" | "Baggage claim" | "West terminal exit" | "East terminal exit" | "Call ahead" | "Parking" | "Room access" | "Key code" etc.
- "title": action title under 8 words
- "detail": 2-5 sentences. Include ALL specific numbers, names, codes, and directions verbatim from the source. Never round or omit them.
- "confirmation": confirmation code string or null

Sort by sortKey ascending. Generate as many steps as needed to capture every instruction.`;

const C = {
  bg:"#f5f7fa", surface:"#ffffff", border:"#dde3ec",
  muted:"#8a9bb0", dim:"#5a7080", text:"#2c3e50", bright:"#0d1f35",
  flight:  { dot:"#1a6fba", bg:"#e8f2fb", badge:"#1a6fba" },
  car:     { dot:"#b04020", bg:"#fceee8", badge:"#b04020" },
  lodging: { dot:"#6040b0", bg:"#f0eafb", badge:"#6040b0" },
  action:  { dot:"#0f7a45", bg:"#e6f7ee", badge:"#0f7a45" },
  alert:   { dot:"#b07800", bg:"#fdf5d8", badge:"#b07800" },
  end:     { dot:"#607080", bg:"#f0f4f8", badge:"#607080" },
};

const LABELS = { flight:"Flight", car:"Rental car", lodging:"Lodging", action:"Action", alert:"Important", end:"Note" };


export default function App() {
  const [screen, setScreen] = useState("home");
  const [pastedText, setPastedText] = useState("");
  const [pdfResult, setPdfResult] = useState(null); // { mode: "text"|"base64", content: string }
  const [fileName, setFileName] = useState("");
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef();

  const handleFile = async (f) => {
    if (!f) return;
    setFileName(f.name);
    setError("");
    setPdfResult(null);
    try {
      if (f.type === "application/pdf") {
        const result = await processPDF(f);
        setPdfResult(result);
      } else {
        const text = await f.text();
        setPastedText(prev => prev ? prev + "\n\n" + text : text);
      }
    } catch (e) {
      setError("Could not read file: " + e.message);
    }
  };

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const hasContent = pastedText.trim() || pdfResult;

  const msgs = [
    "Reading your confirmations...",
    "Extracting every detail...",
    "Mapping shuttle and terminal steps...",
    "Finalizing your itinerary...",
  ];

  const parse = async () => {
    if (!hasContent || !apiKey.trim()) return;
    setLoading(true);
    setError("");
    setSteps([]);
    let mi = 0;
    setLoadMsg(msgs[0]);
    const iv = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadMsg(msgs[mi]); }, 1800);

    try {
      const contentParts = [];

      if (pdfResult) {
        if (pdfResult.mode === "base64") {
          // Web-generated or image PDF — send directly to Claude visually
          contentParts.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfResult.content,
            },
          });
        } else {
          // Real text-based PDF — extracted cleanly by pdf.js
          contentParts.push({
            type: "text",
            text: "=== PDF CONFIRMATION ===\n" + pdfResult.content,
          });
        }
      }

      if (pastedText.trim()) {
        contentParts.push({
          type: "text",
          text: "=== PASTED CONFIRMATION TEXT ===\n" + pastedText.trim(),
        });
      }

      contentParts.push({
        type: "text",
        text: "Parse ALL of the above travel confirmations into the JSON itinerary array. Extract every shuttle instruction, door number, level number, phone number, and terminal-specific direction as its own dedicated step.",
      });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{ role: "user", content: contentParts }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.map(b => b.text || "").join("").trim();
      const clean = raw.replace(/```json|```/g, "").trim();
      setSteps(JSON.parse(clean));
      setScreen("itinerary");
    } catch (e) {
      setError("Could not parse your confirmations: " + e.message);
    }
    clearInterval(iv);
    setLoading(false);
  };

  const handleDownloadHTML = () => {
    const grouped = groupByDate(steps);
    const dotColors = { flight:"#1a6fba", car:"#b04020", lodging:"#6040b0", action:"#0f7a45", alert:"#b07800", end:"#607080" };
    const bgColors  = { flight:"#e8f2fb", car:"#fceee8", lodging:"#f0eafb", action:"#e6f7ee", alert:"#fdf5d8", end:"#f0f4f8" };
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Passage Itinerary</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:system-ui,sans-serif;background:#f5f7fa;margin:0;padding:1.5rem;color:#2c3e50;}
  h1{font-size:22px;color:#0d1f35;margin:0 0 2px;}.tag{font-size:11px;color:#8a9bb0;text-transform:uppercase;letter-spacing:.1em;margin:0 0 1.5rem;}
  .dl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#8a9bb0;margin:20px 0 8px 54px;}
  .step{display:flex;gap:12px;margin-bottom:6px;}.time{min-width:46px;text-align:right;padding-top:10px;font-size:11px;font-weight:600;color:#5a7080;}
  .rail{display:flex;flex-direction:column;align-items:center;min-width:16px;}
  .dot{width:14px;height:14px;border-radius:50%;margin-top:9px;flex-shrink:0;}
  .line{width:2px;flex:1;min-height:12px;background:#dde3ec;margin:3px 0;}
  .card{flex:1;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:3px;border:1px solid #dde3ec;}
  .cat{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;}
  .title{font-size:13px;font-weight:600;margin:0 0 4px;color:#0d1f35;}.detail{font-size:12px;margin:0;line-height:1.7;}
  .conf{font-size:10px;color:#8a9bb0;margin-top:5px;font-family:monospace;}
  @media print{body{padding:1rem;}}
</style></head><body><h1>Passage</h1><p class="tag">Travel itinerary builder</p>`;
    Object.entries(grouped).forEach(([date, daySteps]) => {
      html += `<div class="dl">${date}</div>`;
      daySteps.forEach((step, i) => {
        const dot = dotColors[step.type] || "#607080";
        const bg  = bgColors[step.type]  || "#f0f4f8";
        html += `<div class="step"><div class="time">${step.time}</div><div class="rail"><div class="dot" style="background:${dot}"></div>${i < daySteps.length-1 ? '<div class="line"></div>' : ''}</div><div class="card" style="background:${bg};border-left:3px solid ${dot}"><div class="cat" style="color:${dot}">${step.category||""}</div><div class="title">${step.title}</div><div class="detail">${step.detail}</div>${step.confirmation ? `<div class="conf">Conf: ${step.confirmation}</div>` : ""}</div></div>`;
      });
    });
    html += `</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type:"text/html" }));
    a.download = "passage-itinerary.html";
    a.click();
  };

  const groupByDate = arr => {
    const g = {};
    arr.forEach(s => { if (!g[s.date]) g[s.date] = []; g[s.date].push(s); });
    return g;
  };

  const Skyline = () => (
    <div style={{ position:"relative", height:130, borderRadius:12, overflow:"hidden", marginBottom:"1.8rem" }}>
      <svg viewBox="0 0 800 130" preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
        <defs><radialGradient id="glow" cx="72%" cy="75%" r="18%"><stop offset="0%" stopColor="#f5c842" stopOpacity="0.5"/><stop offset="100%" stopColor="#f5c842" stopOpacity="0"/></radialGradient></defs>
        <rect width="800" height="130" fill="#060f1e"/><rect width="800" height="130" fill="url(#glow)"/>
        <circle cx="578" cy="100" r="24" fill="#f5c842" opacity="0.9"/>
        <rect x="10" y="45" width="20" height="85" fill="#0d1e35" rx="2"/><rect x="8" y="43" width="24" height="9" fill="#111f38" rx="1"/>
        <rect x="36" y="25" width="16" height="105" fill="#0d1e35" rx="2"/><rect x="34" y="23" width="20" height="8" fill="#111f38" rx="1"/>
        <rect x="58" y="60" width="24" height="70" fill="#0a1828" rx="2"/><rect x="56" y="58" width="28" height="9" fill="#0d1e35" rx="1"/>
        <rect x="88" y="38" width="18" height="92" fill="#0d1e35" rx="2"/><rect x="86" y="36" width="22" height="8" fill="#111f38" rx="1"/>
        <rect x="680" y="55" width="16" height="75" fill="#0d1e35" rx="2"/><rect x="678" y="53" width="20" height="8" fill="#111f38" rx="1"/>
        <rect x="702" y="34" width="22" height="96" fill="#0a1828" rx="2"/><rect x="700" y="32" width="26" height="9" fill="#0d1e35" rx="1"/>
        <rect x="730" y="48" width="18" height="82" fill="#0d1e35" rx="2"/><rect x="728" y="46" width="22" height="8" fill="#111f38" rx="1"/>
        <rect x="770" y="44" width="20" height="86" fill="#0d1e35" rx="2"/><rect x="768" y="42" width="24" height="8" fill="#111f38" rx="1"/>
        <circle cx="160" cy="11" r="1.3" fill="#fff" opacity="0.75"/><circle cx="390" cy="8" r="1.5" fill="#fff" opacity="0.7"/>
        <circle cx="530" cy="15" r="1.2" fill="#fff" opacity="0.65"/><circle cx="255" cy="5" r="1.0" fill="#fff" opacity="0.55"/>
        <path d="M0 115 Q200 102 400 113 Q600 124 800 107 L800 130 L0 130Z" fill="#060f1e" opacity="0.9"/>
      </svg>
      <div style={{ position:"relative", zIndex:1, padding:"22px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10.5l7.5 3L14 21l7-18z"/></svg>
            <span style={{ fontSize:24, fontWeight:600, color:"#ffffff", letterSpacing:"-0.02em" }}>Passage</span>
          </div>
          <p style={{ fontSize:10, color:"#7aadd4", letterSpacing:"0.12em", textTransform:"uppercase", margin:"5px 0 0 30px" }}>Travel itinerary builder</p>
        </div>
        {screen === "itinerary" && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => window.print()} style={{ background:"rgba(255,255,255,0.12)", border:"0.5px solid rgba(255,255,255,0.25)", borderRadius:6, padding:"6px 14px", fontSize:12, color:"#c8dff5", cursor:"pointer" }}>Print</button>
            <button onClick={handleDownloadHTML} style={{ background:"#f5c842", border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:700, color:"#0d1f35", cursor:"pointer" }}>Save</button>
            <button onClick={() => { setScreen("home"); setSteps([]); setPastedText(""); setPdfResult(null); setFileName(""); }}
              style={{ background:"rgba(255,255,255,0.12)", border:"0.5px solid rgba(255,255,255,0.25)", borderRadius:6, padding:"6px 14px", fontSize:12, color:"#c8dff5", cursor:"pointer" }}>
              + New trip
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"2rem", fontFamily:"system-ui,sans-serif" }}>
      <Skyline/>
      <div style={{ textAlign:"center", paddingTop:"2.5rem" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width:44, height:44, margin:"0 auto 18px" }}>
          <svg viewBox="0 0 44 44" style={{ animation:"spin 2s linear infinite", width:44, height:44 }}>
            <circle cx="22" cy="22" r="18" fill="none" stroke={C.border} strokeWidth="2.5"/>
            <path d="M22 4 A18 18 0 0 1 40 22" fill="none" stroke="#0d1f35" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontSize:15, fontWeight:600, color:C.bright, margin:"0 0 6px" }}>{loadMsg}</p>
        <p style={{ fontSize:12, color:C.muted, margin:0 }}>This takes about 10 seconds</p>
      </div>
    </div>
  );

  if (screen === "home") return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"2rem", fontFamily:"system-ui,sans-serif" }}>
      <Skyline/>
      <p style={{ fontSize:14, color:C.dim, margin:"0 0 22px", lineHeight:1.75 }}>
        Upload a PDF and paste additional confirmation emails — Passage reads both together and builds one complete itinerary with every operational detail.
      </p>

      <div
        style={{ border:`2px dashed ${dragOver ? C.flight.dot : C.border}`, borderRadius:10, padding:"24px 20px", textAlign:"center", background: dragOver ? C.flight.bg : "#fafcff", cursor:"pointer", transition:"all 0.15s", marginBottom:16 }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={fileName ? C.flight.dot : C.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin:"0 auto 10px", display:"block" }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        {fileName
          ? <p style={{ fontSize:13, fontWeight:600, color:C.flight.dot, margin:0 }}>{fileName} — ready</p>
          : <><p style={{ fontSize:13, color:C.text, margin:"0 0 4px", fontWeight:500 }}>Drop a PDF here, or click to browse</p>
              <p style={{ fontSize:11, color:C.muted, margin:0 }}>PDF, .txt, or .eml accepted</p></>
        }
        <input ref={fileRef} type="file" accept=".pdf,.txt,.eml,.text" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])}/>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, margin:"14px 0", fontSize:12 }}>
        <div style={{ flex:1, height:"1.5px", background:C.border }}/>
        <span style={{ textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, color:C.dim }}>and / or paste text</span>
        <div style={{ flex:1, height:"1.5px", background:C.border }}/>
      </div>

      <textarea
        style={{ width:"100%", minHeight:130, resize:"vertical", fontSize:13, padding:"12px 14px", borderRadius:8, boxSizing:"border-box", border:`1.5px solid ${C.border}`, background:"#ffffff", color:C.text, lineHeight:1.7, outline:"none" }}
        value={pastedText}
        onChange={e => setPastedText(e.target.value)}
        placeholder="Paste any additional confirmations here — flight, hotel, Airbnb, rental car..."
      />

      <div style={{ margin:"16px 0 0", background:"#ffffff", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
        <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:"#0d1f35", margin:"0 0 8px" }}>Anthropic API key required</p>
        <p style={{ fontSize:12, color:C.dim, margin:"0 0 12px", lineHeight:1.7 }}>
          Get your key at <a href="https://console.anthropic.com" style={{ color:C.flight.dot, fontWeight:500 }}>console.anthropic.com</a>. Your key is never stored — it goes directly to Anthropic.
        </p>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..."
            style={{ flex:1, fontSize:13, padding:"9px 12px", borderRadius:6, border:`1.5px solid ${apiKey ? "#0d1f35" : C.border}`, background:"#f5f7fa", color:C.bright, outline:"none", fontFamily:"monospace" }}/>
          <button onClick={() => setShowKey(p => !p)}
            style={{ fontSize:12, padding:"9px 12px", borderRadius:6, border:`1.5px solid ${C.border}`, background:"#f5f7fa", color:C.dim, cursor:"pointer" }}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <p style={{ fontSize:13, color:"#cc3333", margin:"12px 0 0", fontWeight:500 }}>{error}</p>}

      <button onClick={parse} disabled={!hasContent || !apiKey.trim()}
        style={{ marginTop:16, padding:"16px 0", fontSize:16, fontWeight:800, width:"100%", borderRadius:8, cursor:(hasContent && apiKey.trim()) ? "pointer" : "not-allowed", background:"#0d1f35", color:"#f5c842", border:"none", letterSpacing:"0.08em", textTransform:"uppercase", transition:"all 0.2s", opacity:(hasContent && apiKey.trim()) ? 1 : 0.4 }}>
        Build my itinerary
      </button>
    </div>
  );

  const grouped = groupByDate(steps);
  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"2rem", fontFamily:"system-ui,sans-serif" }}>
      <Skyline/>
      {Object.entries(grouped).map(([date, daySteps], di) => (
        <div key={date} style={{ marginBottom:8 }}>
          {di > 0 && <div style={{ height:24 }}/>}
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginBottom:10, marginLeft:54 }}>{date}</div>
          {daySteps.map((step, i) => {
            const m = C[step.type] || C.action;
            return (
              <div key={i} style={{ display:"flex", gap:12, marginBottom:4 }}>
                <div style={{ minWidth:46, textAlign:"right", paddingTop:10 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:C.dim, lineHeight:1.3, display:"block" }}>{step.time}</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:16 }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", background:m.dot, marginTop:9, flexShrink:0 }}/>
                  {i < daySteps.length-1 && <div style={{ width:2, flex:1, minHeight:12, background:C.border, margin:"3px 0" }}/>}
                </div>
                <div style={{ flex:1, background:m.bg, borderLeft:`3px solid ${m.dot}`, borderRadius:"0 8px 8px 0", padding:"10px 14px", marginBottom:3, border:`1px solid ${C.border}`, borderLeftWidth:3, borderLeftColor:m.dot, borderLeftStyle:"solid" }}>
                  <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:m.badge, marginBottom:3 }}>{step.category || LABELS[step.type]}</div>
                  <p style={{ fontSize:13, fontWeight:600, color:C.bright, margin:"0 0 4px" }}>{step.title}</p>
                  <p style={{ fontSize:12, color:C.text, margin:0, lineHeight:1.7 }}>{step.detail}</p>
                  {step.confirmation && <p style={{ fontSize:10, color:C.muted, marginTop:5, fontFamily:"monospace" }}>Conf: {step.confirmation}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
