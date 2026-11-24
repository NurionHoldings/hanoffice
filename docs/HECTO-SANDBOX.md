# Hecto integration plan — not connected
Official guide: https://developers.hectofinancial.co.kr/docs/pg
Start with hosted payment window (SETTLE_PG.pay), not direct card data collection.
Test window: https://tbnpg.settlebank.co.kr ; test API: https://tbgw.settlebank.co.kr .
Production endpoints intentionally not configured. Merchant credentials must remain server-side.
Implement method-specific official request encoding and hash/AES requirements, nextUrl and notiUrl HTTPS callbacks, authoritative transaction verification, amount/order matching, event deduplication and transactional DB updates before activation.
Virtual-account issuance is not payment. Billing requires separate opt-in and applicable merchant approval.
Test matrix: approved, cancelled, timeout, mismatch, duplicate notification, delayed deposit, full refund, callback tampering. Partial refunds remain disabled until ledger supports them.
Current implementation is a pure MOCK state machine; no real provider calls or customer records. Database migration is authored but not applied. No payment or contract endpoint is enabled.
