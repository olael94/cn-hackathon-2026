# Accessibility (Captions Are for Deaf, Hard-of-Hearing and Second-Language Attendees)

The phone view is used by people who rely on it to follow the talk. Review `web/` changes for:

- Every button, icon button and toggle has a visible label or an `aria-label`. Icon-only buttons without one get flagged.
- The live caption region uses `aria-live="polite"` so screen readers announce new lines without interrupting.
- Nothing is shown by color alone (lag state, "possibly covered", errors). Pair color with text or an icon.
- Caption text uses the font-size and contrast settings (CSS variables or the settings state), never hardcoded small sizes. Minimum caption size is 18px.
- Tap targets are at least 44 by 44 px. The view works one-handed at 375px wide with no horizontal scroll.
- Machine captions carry the label "Machine captions, may contain errors".
- Loading, empty and error states exist on every screen of the demo path.
