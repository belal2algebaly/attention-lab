# Attention Lab V15 — Semantic PDP Audit

Interactive static web app for simulating mobile product-page attention, semantic placement, and decision-flow clarity.

## V15 logic audit

- The engine now understands the role of every element, not only its movement or distance.
- Discount badges are evaluated as offer context and must remain connected to price and appear before the action.
- Size charts are evaluated as selection support and must remain attached to variants and before Add to cart.
- Price is evaluated as early-stage offer information and is penalized when buried or placed after options.
- Variants must precede and remain connected to Add to cart.
- CTA depth, visibility, and option-to-action continuity use hard bottleneck rules.
- Product image, title, and reviews form a flexible identity cluster; title/reviews can appear before the image when the group remains compact and early.
- Missing required and optional elements are reported separately.
- The selected element receives a live semantic diagnosis.
- Attention path order now follows the actual vertical arrangement inside each decision stage.

## Scientific note

Scores are heuristic comparison indices based on visual grouping, crowding, visibility, task continuity, viewport depth, and interface conventions. They are not biometric eye-tracking probabilities or conversion predictions.

## Deploy

Upload the folder contents to GitHub and deploy as a static project on Vercel. No build command is required.
