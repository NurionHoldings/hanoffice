# HAN BIZ OFFICE 2.0
Status: implementation planned; production HOLD.
## Mandatory outcomes
1. Professional commercial editorial homepage: responsive typography, whitespace, asymmetric image/text sections, genuine property photography or clearly labeled licensed illustrative imagery. No repeated decorative cards or fabricated property images.
2. Durable integrated identity, contract, payment and customer records.
3. Unified customer journey from branch selection through quote, identity, signature, payment, activation and customer portal.
4. Operator dashboard backed by the same persisted records.
## Implementation order
- Verify current production deployment against source commit; establish staging and repeatable CI/CD.
- Build editorial homepage with approved photography and mobile accessibility. Preserve quote API and demo notices until launch.
- Provision PostgreSQL, apply reviewed migrations, enforce tenant authorization and secure sessions. Test persistence across restarts and cross-customer denial.
- Persist immutable quote snapshots and order IDs. Verify identity with contracted provider; retain minimum personal data.
- Generate versioned contracts, obtain consent and verifiable signature evidence, securely store documents and hashes.
- Integrate Hecto sandbox per merchant-specific official documentation. Server-side approval verification, amount/order matching, idempotency, virtual-account deposit confirmation, refund and reconciliation. Never trust browser callback alone.
- Activate contracts only after verified identity, signature, confirmed payment and branch eligibility. Use transactional state transitions and audit records.
- Customer and operator portals use persisted authorized data; implement renewal, mail and refund workflows.
## Release gates
All must pass: actual branch ownership/use eligibility and unit confirmed; pricing and contract terms approved; photography rights cleared; identity provider configured; DB migration and restore tested; sandbox payment and refund verified; duplicate callbacks and authorization tests pass; mobile and desktop visual acceptance; deployed commit verified; operator explicitly approves production.
## External prerequisites
Approved property photos, final pricing/terms, identity provider contract, Hecto test merchant credentials, database hosting, domain. Secrets must be configured in provider environment, not Git or chat.
No live checkout or personal data collection until gates pass.
