# Website 7.1 → 9.0 Pass Plan

## Phase 1 — Correctness & Edge Stability
- Remove SVG console/runtime errors on landing timeline graphics.
- Eliminate horizontal overflow on narrow mobile widths (320px class devices). [next]
- Reduce aggressive pin durations that create dead-scroll perception. [next]

## Phase 2 — Visual Rhythm & Conversion Lift
- Tighten vertical spacing between sections for stronger narrative pace.
- Ensure CTA appears in first meaningful fold on common laptop heights (768–900px).
- Normalize heading line lengths for readability consistency.

## Phase 3 — Motion Quality
- Keep desktop motion cinematic but reduce overlong scrub windows.
- Add motion-reduce fallback for accessibility.
- Cap animation density on lower-powered mobile devices.

## Phase 4 — UX Quality Gates
- Add Playwright visual smoke snapshots for desktop + mobile landing.
- Add console-error check in CI for key routes.
- Track Lighthouse performance/accessibility baseline and target deltas.

## Target outcomes for a 9.0 feel
- No visible console errors in normal flows.
- No mobile horizontal overflow in 320px viewport.
- Faster perceived progression across hero → proof → pricing → CTA.
- Stronger trust and polish with stable, clean interactions.
