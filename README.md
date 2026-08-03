# Attention Lab V14 — Audited Logic Build

Interactive product-page attention and decision-flow simulator.

## Audit changes

- Recalibrated the fold using the actual visible content boundary inside the phone, not the outer screen height.
- Added continuous action bottlenecks so a deeply buried, hidden, missing, or disconnected CTA cannot be masked by high averages.
- Replaced exact-distance Gaussian relationship scoring with monotonic proximity decay; close related elements are not punished, while overlap is handled by crowding and occlusion.
- Normalized relationship distances to the responsive phone width.
- Removed reassurance elements from the mandatory purchase-stage sequence.
- Prioritized CTA blockers in the critical banner and shopper reaction.
- Made hard score ceilings continuous to avoid flat score plateaus during movement.
- Increased metric display precision to two decimals.
- Rebuilt presets so optional elements do not overlap on mobile.
- Added explicit evidence boundaries: indices are heuristic comparison scores, not biometric probabilities or conversion predictions.

## Validation performed

Tested at desktop and mobile widths for:

- Default layout
- All presets
- CTA placed at the bottom
- Missing CTA
- CTA overlapping variants
- Alternative title/reviews/image ordering
- One-pixel movement sensitivity
- JavaScript runtime and syntax errors

The heatmap and scan path remain simulated educational outputs, not real eye tracking.
