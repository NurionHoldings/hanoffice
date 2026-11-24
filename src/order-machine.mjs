// Pure test-domain logic; not connected to live routes or an actual PG.
import { calculateQuote } from './catalog.mjs';
export function draftOrder(id, options) {
 if(typeof id !== 'string'||!id) throw new Error('INVALID_ID');
 const quote=calculateQuote(options);
 return Object.freeze({id,amount:quote.total,priceVersion:quote.priceVersion,state:'DRAFT',version:0,environment:'TEST',transactionId:null});
}
export function transition(order,event,evidence={}) {
 if (order.environment!=='TEST') throw new Error('LIVE_BLOCKED');
 const next={DRAFT:{review:'REVIEWED',cancel:'CANCELLED'},REVIEWED:{sign:'SIGNED',cancel:'CANCELLED'},SIGNED:{requestPayment:'PAYMENT_PENDING',cancel:'CANCELLED'},PAYMENT_PENDING:{confirm:'PAID'},PAID:{activate:'ACTIVE',refund:'REFUNDED'},ACTIVE:{refund:'REFUNDED'}}[order.state]?.[event];
 if(!next) throw new Error('INVALID_TRANSITION');
 if(event==='review' && evidence.mockEligibility!==true) throw new Error('REVIEW_REQUIRED');
 if(event==='sign' && !/^[a-f0-9]{64}$/.test(evidence.mockDocumentDigest??'')) throw new Error('SIGNATURE_REQUIRED');
 if(event==='confirm' && (evidence.provider!=='MOCK'||evidence.environment!=='TEST'||evidence.orderId!==order.id||evidence.amount!==order.amount||typeof evidence.transactionId!=='string'||!evidence.transactionId||evidence.verified!==true)) throw new Error('PAYMENT_MISMATCH');
 if(event==='refund' && (evidence.provider!=='MOCK'||evidence.environment!=='TEST'||evidence.orderId!==order.id||evidence.transactionId!==order.transactionId||evidence.amount!==order.amount||evidence.verified!==true)) throw new Error('REFUND_MISMATCH');
 if(event==='activate' && evidence.mockActivationApproval!==true) throw new Error('ACTIVATION_REQUIRED');
 return Object.freeze({...order,state:next,version:order.version+1,transactionId:event==='confirm'?evidence.transactionId:order.transactionId});
}
