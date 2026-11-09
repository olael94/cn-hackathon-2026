# RoomPass: Frontend Design and Agent Implementation Spec

**Aesthetic Direction:** Swiss Civic Signage (European train station split-flap boards + broadcast telemetry instruments).
**Primary Mandate:** Zero generic AI tropes. RoomPass is an accessibility and real-time observability instrument for deaf/hard-of-hearing attendees, second-language listeners, and speakers. Every pixel must prioritize WCAG AAA contrast, tabular telemetry legibility, and one-handed mobile operation.

---

## 1. Strict Anti-Bloat & Anti-AI Rules (Agents MUST Obey)

1. **NO AI Visual Clichés:**
   - Never use purple/indigo/blue gradients, glowing neon shadows (`box-shadow: 0 0 20px...`), blurred background blobs, or glassmorphism (`backdrop-filter: blur()`).
   - Never use sparkle icons (`✨`), robot icons, or magic wand icons anywhere, especially on the Q&A "Possibly Covered" match card. Elasticsearch performs deterministic hybrid search; present matches as factual **index citations**.
2. **Sharp Structural Geometry:**
   - Use crisp `1px solid` or `2px solid` borders for hierarchy.
   - Maximum border radius is `4px` (`--radius: 4px`) for buttons/inputs and `0px` or `4px` for structural cards. Never use pill-shaped cards (`rounded-2xl` / `rounded-3xl`).
3. **Tabular Numerals Everywhere:**
   - Every timestamp (`12:04`), segment ID (`#042`), lag readout (`live · 6.2s behind`), similarity score (`0.89`), vote count, and countdown timer MUST use `--font-mono` with `font-variant-numeric: tabular-nums` so numbers never jitter horizontally during live updates.
4. **Use the existing web stack:**
   - Build in `web/` (Vite, React, strict TypeScript, Tailwind, shadcn/ui). Do not add a second static frontend or serve HTML from FastAPI.
   - Map the tokens in section 2 onto the shadcn CSS variables in `web/src/index.css` (see the token map below). Register the extra tokens in `@theme inline` as `--color-<name>` so Tailwind classes like `border-ok` and `bg-danger-tint` work.
   - The theme switch uses `data-theme` on `<html>`, not shadcn's `.dark` class. Put the `swiss` values in `:root` and the `swiss-light` values in `[data-theme="swiss-light"]`.
   - The HTML in section 4 shows the look. Build each block as a React component with Tailwind classes, not inline styles. Keep radius classes at `rounded-lg` (`var(--radius)`) or smaller; `rounded-xl` is above 4px.

### Token map

| Design token | shadcn variable in `web/src/index.css` |
|---|---|
| `--bg` | `--background` |
| `--text` | `--foreground` |
| `--surface` | `--card`, `--popover` |
| `--surface-raised` | `--muted`, `--secondary` |
| `--text-muted` | `--muted-foreground` |
| `--border` | `--border`, `--input` |
| `--accent` | `--primary`, `--ring` |
| `--accent-ink` | `--primary-foreground` |
| `--danger` | `--destructive` |
| `--radius` | `--radius` (4px) |
| `--font-sans`, `--font-mono` | `--font-sans`, `--font-mono` in `@theme inline` (replace Geist) |
| `--border-strong`, `--accent-tint`, `--ok`, `--ok-tint`, `--warn`, `--warn-tint`, `--danger-tint`, `--status-color`, `--caption-size` | No shadcn match: add as new variables |

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
  --ok: #00F5D4;               /* Telemetry Healthy (<= 6s) */
  --ok-tint: #002924;
  --warn: #FB5607;             /* Telemetry Warning (6s - 10s) */
  --warn-tint: #2E1000;
  --danger: #FF006E;           /* Delayed segment (> 10s) */
  --danger-tint: #330016;
  --status-color: var(--text-muted);
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
  --status-color: var(--text-muted);
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

### 4.1 Attendee status and caption lag

Use the talk lifecycle and the existing SSE connection to drive a single status badge.

| What the attendee is experiencing | Badge and caption feed |
|---|---|
| The speaker has not started | Show `Waiting for speaker`. |
| The talk has started | Show `Waiting for first caption` until the first live, finalized segment arrives. |
| Live captions are arriving | Show the delay of the latest live, finalized segment using the thresholds below. |
| The connection drops or missed segments are replaying | Replace the entire lag readout with `Reconnecting`. Keep the transcript visible, resume from the last event ID and append missed segments once. Restore the lag readout on the first new live segment after replay. |
| The talk has ended | After the five-second drain, show `Talk ended` and leave the final captions readable. |

- **Formula:** `lag = phone_receive_time - (started_at + t_end) + clock_offset` (from SSE `hello` event).
- **Visual States:**
  - `lag <= 6s`: Healthy (`--ok` border & dot, text: `LIVE · 5.2s behind`)
  - `6s < lag <= 10s`: Degrading (`--warn` border & dot, text: `LIVE · 8.1s behind`)
  - `lag > 10s`: Delayed segment (`--danger` border, `--danger-tint` background, text: `LAG · 12.4s behind`)
- Dash0 evaluates the aggregate objective of p95 below 10 seconds across live segment measurements. The badge reports one segment. Exclude reconnect replay from live latency measurements.
- **Required Disclaimer:** Always show `"Machine captions · may contain errors"` directly below the header.

```html
<header class="rp-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--surface); border-bottom:2px solid var(--border-strong);">
  <div style="display:flex; align-items:center; gap:10px;">
    <!-- Insert Live Pass SVG -->
  </div>

  <!-- Example after a live segment. Use the state table above for other badge labels. -->
  <div id="slo-badge" class="mono" role="status" aria-live="polite" style="display:inline-flex; align-items:center; gap:8px; padding:6px 10px; background:var(--ok-tint); border:2px solid var(--ok); color:var(--text); font-size:12px; font-weight:700; border-radius:var(--radius);">
    <span id="slo-dot" style="width:8px; height:8px; background:var(--ok); display:inline-block;"></span>
    <span id="slo-text">LIVE · 5.2s behind</span>
  </div>
</header>

<div class="mono" style="display:flex; justify-content:space-between; padding:6px 14px; background:var(--surface-raised); border-bottom:1px solid var(--border); font-size:11px; color:var(--text-muted);">
  <span>MACHINE CAPTIONS · MAY CONTAIN ERRORS</span>
  <span>Target: p95 &lt; 10s</span>
</div>
```

### 4.2 Bilingual caption stream

Render finalized `segment` events from the five-second audio chunks specified in CONTRACT.md.

- **Layout:** Single-column vertical feed with `padding-bottom: 96px` so the sticky bottom thumb bar never obscures the active caption line.
- **Language Selection:**
  - Primary language selected by user (`EN` or `ES`) renders at `font-size: var(--caption-size); font-weight: 700; color: var(--text)`.
  - Secondary language renders directly underneath at `font-size: calc(var(--caption-size) * 0.78); color: var(--text-muted)`.

```html
<main id="caption-stream" role="log" aria-live="polite" aria-label="Live captions" style="padding:16px 14px 96px 14px; display:flex; flex-direction:column; gap:18px;">
  
  <!-- Historical Segment -->
  <article data-segment-id="seg-041" style="padding-left:12px; border-left:2px solid var(--border);">
    <div class="mono" style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">12:04 · #041</div>
    <p style="margin:0; font-size:var(--caption-size); line-height:1.4; font-weight:700;">
      El autoescalado solo ayuda si tus solicitudes están bien configuradas.
    </p>
    <p style="margin:4px 0 0 0; font-size:calc(var(--caption-size) * 0.78); line-height:1.35; color:var(--text-muted);">
      Autoscaling only helps if your requests are set correctly.
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

</main>
```

### 4.3 Asking, posting and voting

An attendee opens Q&A, types a question in English or Spanish and submits it for matching.

| Search result | Attendee action and outcome |
|---|---|
| No match | Offer `Post question`. On successful publication, announce `Question posted` and show it in the room list. |
| Possible match | Show the citation below before publication. `Answered · Dismiss` closes the draft without posting. `Still ask` publishes the original question with the same confirmation and list update. |

Keep the draft available if posting fails. Show the room's questions in descending vote count. Each device can vote once per question. Once a vote succeeds, show the updated count and mark that question as voted. Include the question filter in the planned attendee view. If time runs short, the filter is the third cut, after catch-up and the Moonshine swap.

- **Required Elements:**
  1. Timestamp (`Possibly covered at 12:04`)
  2. Exact matched caption line (`text_en` or `text_es`)
  3. Semantic match score (see CONTRACT.md, Match) (`MATCH: 0.89`)
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
      "Autoscaling only helps if your requests are set correctly."
    </blockquote>
  </div>

  <div style="display:flex; gap:10px;">
    <button type="button" style="flex:1; min-height:48px; background:var(--accent); color:var(--accent-ink); border:2px solid var(--border-strong); border-radius:var(--radius); font-family:var(--font-sans); font-weight:700; font-size:14px; cursor:pointer;">
      Answered · Dismiss
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

### 4.5 Speaker console and talk lifecycle

1. The private speaker link opens the pre-talk screen. The speaker chooses whether to save the transcript (off by default), then selects `Start talk`. Request microphone access on that action.
2. If access is denied, stay on the pre-talk screen and preserve the transcript choice. Show “Allow microphone access in your browser’s site settings, then try again” and a `Try microphone again` button. Enter the live console once permission is granted and audio capture starts.
3. While live, show the question queue and a keyboard-focusable stop control. A continuous three-second hold using the primary pointer, Space or Enter confirms the stop once. Show linear progress and a countdown. Releasing early, moving focus away, losing window focus or cancelling the pointer resets progress.
4. On confirmation, stop capturing audio and show `Finishing captions (5 s)` during the five-second drain. Keep incoming final captions visible. When the talk finishes, replace the drain status with `Talk ended`.

Use the primary text color for the stop instruction and countdown. Use the danger color for the border and its tint for the progress fill. Text must reach at least 7:1 against both the resting background and the fill in each theme.

- **Speaker View Q&A:** Spanish questions submitted by attendees must render in **English (`text_en`)** on the speaker console, sorted by `votes` descending, with the original Spanish shown smaller underneath.
- **Transcript Opt-In:** Single high-contrast checkbox/switch (`opt_in`) for saving the transcript.

```html
<section aria-label="Speaker Broadcast Controls" style="padding:16px; background:var(--surface); border:2px solid var(--border-strong); border-radius:var(--radius); display:flex; flex-direction:column; gap:14px;">
  
  <!-- Pre-talk view -->
  <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-weight:700; font-size:14px;">
    <span>Save talk transcript after session (Opt-In)</span>
    <input type="checkbox" id="opt-in-toggle" style="width:24px; height:24px; accent-color:var(--accent);" />
  </label>

  <button type="button">Start talk</button>
</section>

<!-- Live view replaces the pre-talk controls -->
<section aria-label="Live speaker controls">
  <p id="stop-help">Hold the button, Space or Enter for three seconds. Release early to cancel.</p>
  <button type="button" id="hold-stop-btn" aria-describedby="stop-help" class="mono" style="position:relative; overflow:hidden; min-height:54px; width:100%; background:var(--bg); color:var(--text); border:2px solid var(--danger); border-radius:var(--radius); font-weight:700; font-size:14px; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:none;">
    <span id="hold-stop-fill" style="position:absolute; inset:0; width:0%; background:var(--danger-tint); pointer-events:none;"></span>
    <span id="hold-stop-label" style="position:relative; z-index:1;">HOLD 3.0s TO END TALK</span>
  </button>
</section>
```

---

## 5. Reference React Behaviors (TypeScript, for `web/src/`)

### 5.1 Lag badge

The attendee view derives this display state from the lifecycle in §4.1. Only the live state carries a lag measurement. The header dot takes the badge color.

```tsx
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

type LagLevel = 'ok' | 'warn' | 'danger'
type CaptionStatus =
  | { kind: 'live'; lagSeconds: number }
  | { kind: 'waiting' | 'firstCaption' | 'reconnecting' | 'ended' }

const statusLabels = {
  waiting: 'Waiting for speaker',
  firstCaption: 'Waiting for first caption',
  reconnecting: 'Reconnecting',
  ended: 'Talk ended',
}

export function lagLevel(lagSeconds: number): LagLevel {
  if (lagSeconds > 10) return 'danger'
  if (lagSeconds > 6) return 'warn'
  return 'ok'
}

const badgeStyles: Record<LagLevel, string> = {
  ok: 'border-ok bg-ok-tint',
  warn: 'border-warn bg-warn-tint',
  danger: 'border-destructive bg-danger-tint',
}

const dotStyles: Record<LagLevel, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-destructive',
}

export function LagBadge({ status }: { status: CaptionStatus }) {
  const level = status.kind === 'live' ? lagLevel(status.lagSeconds) : null
  const label = status.kind === 'live'
    ? `${level === 'danger' ? 'LAG' : 'LIVE'} · ${status.lagSeconds.toFixed(1)}s behind`
    : statusLabels[status.kind]

  useEffect(() => {
    const style = document.documentElement.style
    const color = level === 'danger' ? '--destructive' : level ? `--${level}` : '--muted-foreground'
    style.setProperty('--status-color', `var(${color})`)
    return () => { style.removeProperty('--status-color') }
  }, [level])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums',
        level ? badgeStyles[level] : 'border-input bg-card',
      )}
    >
      <span className={cn('size-2', level ? dotStyles[level] : 'bg-muted-foreground')} />
      {label}
    </div>
  )
}
```

### 5.2 Caption size and Daylight contrast

```tsx
import { useEffect, useState } from 'react'

const FONT_STEPS = ['1.25rem', '1.5rem', '1.75rem']

export function useCaptionSettings() {
  const [fontStep, setFontStep] = useState(0)
  const [daylight, setDaylight] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--caption-size', FONT_STEPS[fontStep])
  }, [fontStep])

  useEffect(() => {
    document.documentElement.dataset.theme = daylight ? 'swiss-light' : 'swiss'
  }, [daylight])

  return {
    daylight,
    nextFontSize: () => setFontStep((step) => (step + 1) % FONT_STEPS.length),
    toggleDaylight: () => setDaylight((value) => !value),
  }
}
```

### 5.3 Speaker 3-second hold-to-stop

Mount this control while the talk is live. Its confirmation callback starts the drain. The console owns the five-second finishing status and the transition to the ended view in §4.5.

```tsx
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const HOLD_MS = 3000

export function useHoldToStop(onConfirmStop: () => void) {
  const timer = useRef<number | null>(null)
  const source = useRef<string | number | null>(null)
  const [progress, setProgress] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  const cancel = useCallback(() => {
    if (timer.current === null) return
    clearInterval(timer.current)
    timer.current = null
    source.current = null
    setProgress(0)
  }, [])

  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      if (timer.current !== null) clearInterval(timer.current)
    }
  }, [cancel])

  const begin = (input: string | number) => {
    if (timer.current !== null || confirmed) return
    source.current = input
    const startedAt = performance.now()
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      setProgress(Math.min(1, elapsed / HOLD_MS))
      if (elapsed >= HOLD_MS) {
        clearInterval(id)
        timer.current = null
        setConfirmed(true)
        onConfirmStop()
      }
    }, 50)
    timer.current = id
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    begin(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) begin(event.key)
  }

  const release = (input: string | number) => {
    if (source.current === input) cancel()
  }

  const remainingSeconds = (((1 - progress) * HOLD_MS) / 1000).toFixed(1)
  const label = confirmed
    ? 'Finishing captions (5 s)'
    : progress > 0
      ? `HOLDING... ${remainingSeconds}s`
      : 'HOLD 3.0s TO END TALK'

  return {
    progress,
    label,
    buttonProps: {
      onPointerDown,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => release(event.pointerId),
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => release(event.pointerId),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => release(event.pointerId),
      onKeyDown,
      onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => release(event.key),
      onBlur: cancel,
      disabled: confirmed,
    },
  }
}

export function HoldToStopButton({ onConfirmStop }: { onConfirmStop: () => void }) {
  const hold = useHoldToStop(onConfirmStop)

  return (
    <button
      type="button"
      aria-describedby="stop-help"
      {...hold.buttonProps}
      className="relative min-h-[54px] w-full touch-none select-none overflow-hidden rounded-lg border-2 border-destructive bg-background font-mono text-sm font-bold tabular-nums text-foreground"
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-danger-tint"
        style={{ width: `${hold.progress * 100}%` }}
      />
      <span className="relative">{hold.label}</span>
    </button>
  )
}
```

---

## 6. Pre-PR Checklist for Coding Agents

Before opening a pull request touching `phone` or `speaker` frontend files, verify:

- [ ] Open the private speaker link, choose the transcript setting and select Start talk. Deny microphone access, follow the recovery instructions and retry. The choice persists and the talk goes live once capture starts.
- [ ] Try a short tap and short Space and Enter presses. Release early, move focus or switch windows during a hold. Each cancellation resets progress and leaves the talk live. In separate runs, hold with the pointer, Space and Enter for three seconds each. Each run produces one stop, displays the five-second drain, receives final captions and shows Talk ended.
- [ ] Post an unmatched question and verify the confirmation and list entry. For a Spanish question matching English captions, verify the timestamp, exact quote and score. Dismiss it and verify the list is unchanged. Repeat with Still ask and verify it appears once, with English above the original Spanish on the speaker console.
- [ ] Vote for a question and try voting for it again on the same device. Verify one increment and descending vote order on both views. Exercise the attendee filter if retained for the demo.
- [ ] Join before start, then start the talk. Check both waiting labels and that the first finalized live caption supplies the first lag value. Verify the badge at 6 s, at 10 s and above 10 s. Disconnect and reconnect with missed captions. Reconnecting replaces the stale value through replay. The first subsequent live segment restores the readout. Check the aggregate p95 separately in Dash0.
- [ ] Measure stop text contrast in both themes against the idle background and the progress fill. The instruction and countdown must each reach 7:1 throughout the hold.
- [ ] Zero gradients, blurs, rounded pills (`> 4px`), or sparkle icons exist in the diff.
- [ ] All numeric indicators (`t_start`, `lag`, `score`, `votes`, countdowns) have the `.mono` class with `font-variant-numeric: tabular-nums`.
- [ ] The `"MACHINE CAPTIONS · MAY CONTAIN ERRORS"` banner is visible without scrolling.
- [ ] All bottom bar controls meet `min-height: 48px` for one-handed thumb operation.
- [ ] If the Stretch Goal ("Catch me up") is implemented, every bullet point explicitly cites a valid `segment_id` (`#041`) and drops any bullet missing an ID.
