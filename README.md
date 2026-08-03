# Attention Lab V24 — Viewport Audit

Interactive static product-page attention simulator.

## V24 fixes

- Calculates the initial content viewport from the real rendered phone height on each device
- Measures full element coverage, not only whether an element's top edge is above the fold
- A partially visible Add to Cart is now an action blocker
- Mobile and desktop use the same geometry model with their own live dimensions
- Critical coverage, action readiness, character mood, recommendations, and score caps now share the same viewport logic
- Adds explicit findings for partially visible Price and Variants

Scores remain heuristic comparison indices, not biometric eye-tracking probabilities.
