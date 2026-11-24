// Test-only configuration. No network requests or provider credentials are collected.
export const hectoTest=Object.freeze({paymentOrigin:'https://tbnpg.settlebank.co.kr',apiOrigin:'https://tbgw.settlebank.co.kr',sdkMethod:'SETTLE_PG.pay',environment:'TEST'});
export function assertSandbox(env){if(env!=='TEST')throw Error('LIVE_PAYMENT_BLOCKED');return hectoTest;}
