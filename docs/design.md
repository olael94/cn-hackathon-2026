# RoomPass — Frontend Design & Agent Implementation Spec

**Aesthetic Direction:** Swiss Civic Signage (European train station split-flap boards + broadcast telemetry instruments).
**Primary Mandate:** Zero generic AI tropes. RoomPass is an accessibility and real-time observability instrument for deaf/hard-of-hearing attendees, second-language listeners, and speakers. Every pixel must prioritize WCAG AAA contrast, tabular telemetry legibility, and one-handed mobile operation.

---

## 1. Strict Anti-Bloat & Anti-AI Rules (Agents MUST Obey)

1. **NO AI Visual Clichés:**
   - Never use purple/indigo/blue gradients, glowing neon shadows (`box-shadow: 0 0 20px...`), blurred background blobs, or glassmorphism (`backdrop-filter: blur()`).
   - Never use sparkle icons (`✨`), robot icons, or magic wand icons anywhere—especially on the Q&A "Possibly Covered" match card. Elasticsearch performs deterministic hybrid search; present matches as factual **index citations**.
2. **Sharp Structural Geometry:**
   - Use crisp `1px solid` or `2px solid` borders for hierarchy.
   - Maximum border radius is `4px` (`--radius: 4px`) for buttons/inputs and `0px` or `4px` for structural cards. Never use pill-shaped cards (`rounded-2xl` / `rounded-3xl`).
3. **Tabular Numerals Everywhere:**
   - Every timestamp (`12:04`), segment ID (`#042`), lag readout (`live · 1.4s behind`), similarity score (`0.89`), vote count, and countdown timer MUST use `--font-mono` with `font-variant-numeric: tabular-nums` so numbers never jitter horizontally during live updates.
4. **Zero-Build / Static Architecture:**
   - Deliver self-contained static HTML/CSS/JS served by FastAPI. Do not introduce heavy frontend build pipelines, Tailwind CDN scripts that block rendering, or complex state libraries.

---

## 2. Design Tokens & Color System (`swiss` Default + Daylight High-Contrast)

RoomPass defaults to **Swiss Civic Obsidian** (`data-theme="swiss"`), engineered for dark conference rooms and maximum projector contrast during the Dash0 SLO burn demo. The required accessibility contrast toggle switches to **Swiss Daylight Stark** (`data-theme="swiss-light"`).

```css
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@500;700&display=swap');

:root,
[data-theme="swiss"] {
  /* Swiss Civic Obsidian (Default Dark AAA) */
  --bg: #000000;
  --surface: #0A0A0A;
  --surface-raised: #141414;
  --border: #333333;
  --border-strong: #FFFFFF;
  --text: #FFFFFF;
  --text-muted: #CCCCCC;
  --accent: #FFBE0B;           /* Safety Amber */
  --accent-ink: #000000;       /* Text on Amber buttons */
  --accent-tint: #261C00;
  --ok: #00F5D4;               /* Telemetry Healthy (< 2.0s) */
  --ok-tint: #002924;
  --warn: #FB5607;             /* Telemetry Warning (2.0s - 3.0s) */
  --warn-tint: #2E1000;
  --danger: #FF006E;           /* Chaos / SLO Burn (> 3.0s) */
  --danger-tint: #330016;
  --status-color: var(--ok);
}

[data-theme="swiss-light"] {
  /* Swiss Civic Daylight (Inverted Stark AAA) */
  --bg: #FFFFFF;
  --surface: #F4F4F0;
  --surface-raised: #E8E8E2;
  --border: #B0B0A8;
  --border-strong: #000000;
  --text: #000000;
  --text-muted: #333333;
  --accent: #000000;
  --accent-ink: #FFBE0B;
  --accent-tint: #FFF3B0;
  --ok: #006644;
  --ok-tint: #E3FCEF;
  --warn: #C2410C;
  --warn-tint: #FFEDD5;
  --danger: #D90429;
  --danger-tint: #FFE5EC;
  --status-color: var(--ok);
}

:root {
  --font-sans: 'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --caption-size: 1.25rem; /* Cycles: 1.25rem (20px) -> 1.5rem (24px) -> 1.75rem (28px) */
  --radius: 4px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Visible Keyboard & Screen Reader Focus Ring */
:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
```

---

## 3. Official Brand SVG: The "Live Pass" Badge

Agents must embed this exact inline SVG in the top header of both the Attendee Phone view and Speaker view. It automatically adapts to `--surface`, `--border-strong`, `--text`, `--accent`, and `--status-color`.

```html
<svg width="172" height="40" viewBox="0 0 172 40" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RoomPass Live Captions">
  <!-- Lanyard Pass Frame -->
  <rect x="2" y="2" width="36" height="36" rx="4" fill="var(--surface)" stroke="var(--border-strong)" stroke-width="2"/>
  <!-- Lanyard Slot -->
  <rect x="15" y="7" width="10" height="2.5" fill="var(--text-muted)"/>
  <!-- EN / ES Live Caption Bars -->
  <path d="M9 19H23" stroke="var(--text)" stroke-width="2.5" stroke-linecap="square"/>
  <path d="M9 26H17" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="square"/>
  <!-- Telemetry Status Dot (Controlled by --status-color) -->
  <circle cx="27" cy="26" r="3" fill="var(--status-color)"/>
  <!-- Swiss Wordmark -->
  <text x="46" y="27" fill="var(--text)" font-family="var(--font-sans)" font-weight="700" font-size="21" letter-spacing="-0.03em">
    Room<tspan fill="var(--accent)">Pass</tspan>
  </text>
</svg>
```

---

## 4. Core Component Specifications & HTML Blueprints

### 4.1 Header & User-Facing Dash0 SLO Lag Indicator
- **Formula:** `lag = phone_receive_time - (started_at + t_end) + clock_offset` (from SSE `hello` event).
- **Visual States:**
  - `lag <= 2.0s`: Healthy (`--ok` border & dot, text: `LIVE · 1.4s behind`)
  - `2.0s < lag <= 3.0s`: Degrading (`--warn` border & dot, text: `LIVE · 2.6s behind`)
  - `lag > 3.0s`: SLO Burn (`--danger` border, `--danger-tint` background, text: `LAG · 4.8s behind`)
- **Required Disclaimer:** Always show `"Machine captions · may contain errors"` directly below the header.

```html
<header class="rp-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--surface); border-bottom:2px solid var(--border-strong);">
  <div style="display:flex; align-items:center; gap:10px;">
    <!-- Insert Live Pass SVG -->
  </div>

  <!-- Live SLO Telemetry Readout -->
  <div id="slo-badge" class="mono" role="status" aria-live="polite" style="display:inline-flex; align-items:center; gap:8px; padding:6px 10px; background:var(--ok-tint); border:2px solid var(--ok); color:var(--text); font-size:12px; font-weight:700; border-radius:var(--radius);">
    <span id="slo-dot" style="width:8px; height:8px; background:var(--ok); display:inline-block;"></span>
    <span id="slo-text">LIVE · 1.4s behind</span>
  </div>
</header>

<div class="mono" style="display:flex; justify-content:space-between; padding:6px 14px; background:var(--surface-raised); border-bottom:1px solid var(--border); font-size:11px; color:var(--text-muted);">
  <span>MACHINE CAPTIONS · MAY CONTAIN ERRORS</span>
  <span>SLO p95 &lt; 3.0s</span>
</div>
```

### 4.2 Bilingual Caption Stream (`partial` vs `segment`)
- **Layout:** Single-column vertical feed with `padding-bottom: 96px` so the sticky bottom thumb bar never obscures the active caption line.
- **Language Selection:**
  - Primary language selected by user (`EN` or `ES`) renders at `font-size: var(--caption-size); font-weight: 700; color: var(--text)`.
  - Secondary language renders directly underneath at `font-size: calc(var(--caption-size) * 0.78); color: var(--text-muted)`.
- **SSE `partial` Event:** Renders in a fixed-position or bottom-anchored dashed box (`border: 1px dashed var(--border-strong)`). Replaces itself in place until the finalized `segment` arrives.

```html
<main id="caption-stream" role="log" aria-live="polite" aria-label="Live captions" style="padding:16px 14px 96px 14px; display:flex; flex-direction:column; gap:18px;">
  
  <!-- Historical Segment -->
  <article data-segment-id="seg-041" style="padding-left:12px; border-left:2px solid var(--border);">
    <div class="mono" style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">12:04 · #041</div>
    <p style="margin:0; font-size:var(--caption-size); line-height:1.4; font-weight:700;">
      Los teléfonos se reconectan con SSE Last-Event-ID y recuperan datos de Redis Streams.
    </p>
    <p style="margin:4px 0 0 0; font-size:calc(var(--caption-size) * 0.78); line-height:1.35; color:var(--text-muted);">
      Phones resume with SSE Last-Event-ID and backfill from Redis Streams.
    </p>
  </article>

  <!-- Active / Newest Segment -->
  <article data-segment-id="seg-042" style="padding-left:12px; border-left:4px solid var(--accent);">
    <div class="mono" style="font-size:11px; color:var(--accent); font-weight:700; margin-bottom:4px;">12:09 · #042 · LATEST</div>
    <p style="margin:0; font-size:var(--caption-size); line-height:1.4; font-weight:700;">
      Si el traductor se reinicia, no se pierde ningún mensaje en tránsito.
    </p>
    <p style="margin:4px 0 0 0; font-size:calc(var(--caption-size) * 0.78); line-height:1.35; color:var(--text-muted);">
      If the translator restarts, no in-flight message is lost.
    </p>
  </article>

  <!-- In-Flight Partial (EN only, replaces itself) -->
  <div id="partial-box" style="padding:10px 12px; background:var(--surface); border:1px dashed var(--border-strong); border-radius:var(--radius);">
    <div class="mono" style="font-size:10px; color:var(--accent); text-transform:uppercase; margin-bottom:2px;">LIVE AUDIO (EN)...</div>
    <p id="partial-text" style="margin:0; font-size:calc(var(--caption-size) * 0.9); color:var(--text-muted);">
      And when we trigger the delay flag through OpenFeature...
    </p>
  </div>

</main>
```

### 4.3 Typed Q&A Drawer & "Possibly Covered" Soft-Match Citation
- **Rule:** When an attendee types a question (e.g., in Spanish) and Elasticsearch returns a soft match against existing segments (in English or Spanish), display the **Citation Card** before or alongside posting.
- **Required Elements:**
  1. Timestamp (`Possibly covered at 12:04`)
  2. Exact matched caption line (`text_en` or `text_es`)
  3. Raw cosine match score (`MATCH: 0.89`)
  4. **`Still ask`** override button (must always be available so the user is never blocked).

```html
<section aria-label="Question Match Verification" style="margin:14px; padding:14px; background:var(--surface); border:2px solid var(--border-strong); border-radius:var(--radius);">
  <div class="mono" style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">YOUR QUESTION (ES)</div>
  <p style="margin:0 0 12px 0; font-weight:700; font-size:15px;">"¿Cómo recuperan los mensajes si se corta la conexión?"</p>

  <!-- Elasticsearch Citation Block -->
  <div style="padding:12px; background:var(--surface-raised); border-left:4px solid var(--accent); margin-bottom:14px;">
    <div class="mono" style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:var(--accent); margin-bottom:6px;">
      <span>POSSIBLY COVERED AT 12:04 · SEG #041</span>
      <span>SCORE: 0.89</span>
    </div>
    <blockquote style="margin:0; font-size:14px; line-height:1.4; color:var(--text);">
      "Phones resume with SSE Last-Event-ID and backfill from Redis Streams."
    </blockquote>
  </div>

  <div style="display:flex; gap:10px;">
    <button type="button" style="flex:1; min-height:48px; background:var(--accent); color:var(--accent-ink); border:2px solid var(--border-strong); border-radius:var(--radius); font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer;">
      Answered — Dismiss
    </button>
    <button type="button" style="min-height:48px; padding:0 16px; background:transparent; color:var(--text); border:2px solid var(--border-strong); border-radius:var(--radius); font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer;">
      Still ask →
    </button>
  </div>
</section>
```

### 4.4 One-Handed Bottom Thumb Bar (Attendee View)
- All interactive controls must have a minimum touch target of `48px × 48px` and live in a fixed bottom bar for one-handed operation.

```html
<nav aria-label="Accessibility and Q&A Controls" style="position:fixed; bottom:0; left:0; right:0; z-index:50; display:flex; gap:8px; padding:10px 14px; background:var(--bg); border-top:2px solid var(--border-strong);">
  <button type="button" id="btn-lang" class="mono" aria-label="Toggle Caption Language between Spanish and English" style="min-height:48px; padding:0 12px; background:var(--surface); color:var(--text); border:2px solid var(--border-strong); border-radius:var(--radius); font-weight:700; font-size:13px; cursor:pointer;">
    ES ⇄ EN
  </button>

  <button type="button" id="btn-font" class="mono" aria-label="Increase Caption Font Size" style="min-height:48px; min-width:48px; background:var(--surface); color:var(--text); border:2px solid var(--border-strong); border-radius:var(--radius); font-weight:700; font-size:14px; cursor:pointer;">
    A+
  </button>

  <button type="button" id="btn-contrast" class="mono" aria-label="Toggle Daylight High Contrast Mode" style="min-height:48px; min-width:48px; background:var(--surface); color:var(--text); border:2px solid var(--border-strong); border-radius:var(--radius); font-weight:700; font-size:14px; cursor:pointer;">
    ◐
  </button>

  <button type="button" id="btn-qa" style="flex:1; min-height:48px; background:var(--accent); color:var(--accent-ink); border:2px solid var(--border-strong); border-radius:var(--radius); font-family:var(--font-sans); font-weight:700; font-size:15px; cursor:pointer;">
    Q&amp;A (3)
  </button>
</nav>
```

### 4.5 Speaker Console: 3-Second Press-and-Hold Stop & Opt-In Toggle
- **Rule:** A single tap must NEVER stop an active talk. The Stop button requires a continuous `3000ms` pointer hold with a deterministic linear progress bar.
- **Speaker View Q&A:** Spanish questions submitted by attendees must render in **English (`text_en`)** on the speaker console, sorted by `votes` descending, with the original Spanish shown smaller underneath.
- **Transcript Opt-In:** Single high-contrast checkbox/switch (`opt_in`) for saving the transcript.

```html
<section aria-label="Speaker Broadcast Controls" style="padding:16px; background:var(--surface); border:2px solid var(--border-strong); border-radius:var(--radius); display:flex; flex-direction:column; gap:14px;">
  
  <!-- Transcript Opt-in Row -->
  <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-weight:700; font-size:14px;">
    <span>Save talk transcript after session (Opt-In)</span>
    <input type="checkbox" id="opt-in-toggle" style="width:24px; height:24px; accent-color:var(--accent);" />
  </label>

  <!-- 3-Second Press-and-Hold Stop Button -->
  <button type="button" id="hold-stop-btn" class="mono" style="position:relative; overflow:hidden; min-height:54px; width:100%; background:var(--bg); color:var(--danger); border:2px solid var(--danger); border-radius:var(--radius); font-weight:700; font-size:14px; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:none;">
    <span id="hold-stop-fill" style="position:absolute; inset:0; width:0%; background:var(--danger-tint); pointer-events:none;"></span>
    <span id="hold-stop-label" style="position:relative; z-index:1;">HOLD 3.0s TO END TALK</span>
  </button>
</section>
```

---

## 5. Reference Vanilla JS Behaviors (Copy-Paste Ready for Agents)

```javascript
// 1. Update SLO Lag Pill & Header Badge Dot dynamically
function updateLagBadge(lagSeconds) {
  const badge = document.getElementById('slo-badge');
  const dot = document.getElementById('slo-dot');
  const text = document.getElementById('slo-text');
  const root = document.documentElement;

  const formatted = lagSeconds.toFixed(1);
  if (lagSeconds > 3.0) {
    badge.style.background = 'var(--danger-tint)';
    badge.style.borderColor = 'var(--danger)';
    dot.style.background = 'var(--danger)';
    root.style.setProperty('--status-color', 'var(--danger)');
    text.textContent = `LAG · ${formatted}s behind`;
  } else if (lagSeconds > 2.0) {
    badge.style.background = 'var(--warn-tint)';
    badge.style.borderColor = 'var(--warn)';
    dot.style.background = 'var(--warn)';
    root.style.setProperty('--status-color', 'var(--warn)');
    text.textContent = `LIVE · ${formatted}s behind`;
  } else {
    badge.style.background = 'var(--ok-tint)';
    badge.style.borderColor = 'var(--ok)';
    dot.style.background = 'var(--ok)';
    root.style.setProperty('--status-color', 'var(--ok)');
    text.textContent = `LIVE · ${formatted}s behind`;
  }
}

// 2. Accessibility Controls (Font Size & Swiss Obsidian/Daylight Toggle)
const FONT_STEPS = ['1.25rem', '1.5rem', '1.75rem'];
let fontIdx = 0;

document.getElementById('btn-font')?.addEventListener('click', () => {
  fontIdx = (fontIdx + 1) % FONT_STEPS.length;
  document.documentElement.style.setProperty('--caption-size', FONT_STEPS[fontIdx]);
});

document.getElementById('btn-contrast')?.addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'swiss-light' ? 'swiss' : 'swiss-light';
  html.setAttribute('data-theme', next);
});

// 3. Speaker 3-Second Hold-to-Stop Logic
function bindHoldToStop(onConfirmStop) {
  const btn = document.getElementById('hold-stop-btn');
  const fill = document.getElementById('hold-stop-fill');
  const label = document.getElementById('hold-stop-label');
  if (!btn) return;

  let timer = null;
  let startedAt = 0;
  const HOLD_MS = 3000;

  const cancel = () => {
    if (timer) clearInterval(timer);
    timer = null;
    fill.style.width = '0%';
    label.textContent = 'HOLD 3.0s TO END TALK';
  };

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startedAt = performance.now();
    timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      const rem = Math.max(0, (HOLD_MS - elapsed) / 1000).toFixed(1);
      fill.style.width = `${pct}%`;
      label.textContent = `HOLDING... ${rem}s`;
      if (elapsed >= HOLD_MS) {
        clearInterval(timer);
        timer = null;
        label.textContent = 'DRAINING LAST SEGMENTS (5.0s)...';
        btn.disabled = true;
        onConfirmStop();
      }
    }, 50);
  });

  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
}
```

---

## 6. Pre-PR Checklist for Coding Agents

Before opening a pull request touching `phone` or `speaker` frontend files, verify:
- [ ] Zero gradients, blurs, rounded pills (`> 4px`), or sparkle icons exist in the diff.
- [ ] All numeric indicators (`t_start`, `lag`, `score`, `votes`, countdowns) have the `.mono` class with `font-variant-numeric: tabular-nums`.
- [ ] The `"MACHINE CAPTIONS · MAY CONTAIN ERRORS"` banner is visible without scrolling.
- [ ] All bottom bar controls meet `min-height: 48px` for one-handed thumb operation.
- [ ] If the Stretch Goal ("Catch me up") is implemented, every bullet point explicitly cites a valid `segment_id` (`#041`) and drops any bullet missing an ID.