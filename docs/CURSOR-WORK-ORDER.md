# Cursor work order — HAN BIZ OFFICE 2.0
Status: READY FOR LOCAL CURSOR EXECUTION; production HOLD.
Branch: feat/han-commercial-v2
Read docs/COMMERCIAL-V2.md and .cursor/rules/han-commercial.mdc.
## Task 01 — audit and editorial homepage
Inspect repository and current tests; record baseline. Redesign public homepage with photo-led editorial layout, Korean typography, generous whitespace, asymmetric sections, responsive navigation and integrated quote-to-contract preview. Use only approved or licensed images with source attribution; if unavailable use explicit image placeholders, not invented property photos. Preserve quote API and required element IDs, preview notices, blocked live transactions. Run existing tests and add navigation/quote regression coverage. Capture desktop and mobile screenshots using available browser tooling. Commit and push to this branch, not main. Report results and stop for review.
## Subsequent tasks (not authorized for live operation)
02 durable PostgreSQL and authentication; 03 identity and signature adapters; 04 Hecto sandbox and reconciliation; 05 unified customer/operator flow; 06 staging acceptance and production gate. Do not invent provider credentials or claim actual integration without evidence.
## Report format
Task ID; commit SHA; files changed; tests executed and results; screenshot paths; blockers; risks; proposed next task; status PASS/PARTIAL/BLOCKED.
