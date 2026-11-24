import {randomUUID} from 'node:crypto';
const methods=new Set(['CARD','TRANSFER','VIRTUAL_ACCOUNT']);
export function createSandboxLedger({verifyTransaction}) {
 if(typeof verifyTransaction!=='function')throw Error('VERIFIER_REQUIRED');
 const orders=new Map(),transactions=new Map(),events=new Map();
 return {
 create({contractId,amount,method}){if(typeof contractId!=='string'||!contractId||!Number.isSafeInteger(amount)||amount<=0||!methods.has(method))throw Error('INVALID_ORDER');if([...orders.values()].some(o=>o.contractId===contractId))throw Error('DUPLICATE_CONTRACT');const o={id:randomUUID(),contractId,amount,method,state:'PENDING',environment:'TEST',transactionId:null};orders.set(o.id,o);return {...o}},
 get(id){const o=orders.get(id);return o?{...o}:null},
 async reconcile({orderId,transactionId,eventId}){if(![orderId,transactionId,eventId].every(v=>typeof v==='string'&&v.length>0&&v.length<=200))throw Error('INVALID_EVENT');const o=orders.get(orderId);if(!o)throw Error('UNKNOWN_ORDER');const proof=await verifyTransaction(transactionId);if(proof?.environment!=='TEST'||proof.orderId!==orderId||proof.transactionId!==transactionId||proof.amount!==o.amount||proof.method!==o.method)throw Error('MISMATCH');const fingerprint=JSON.stringify([orderId,transactionId,proof.status]);if(events.has(eventId)){if(events.get(eventId)!==fingerprint)throw Error('EVENT_COLLISION');return {...o}}if(transactions.has(transactionId)&&transactions.get(transactionId)!==orderId)throw Error('TRANSACTION_REUSED');if(o.transactionId&&o.transactionId!==transactionId)throw Error('TRANSACTION_CHANGED');const next={PENDING:{ISSUED:'AWAITING_DEPOSIT',APPROVED:'PAID',CANCELLED:'CANCELLED'},AWAITING_DEPOSIT:{APPROVED:'PAID',CANCELLED:'CANCELLED'},PAID:{REFUNDED:'REFUNDED'}}[o.state]?.[proof.status];if(!next||proof.status==='ISSUED'&&o.method!=='VIRTUAL_ACCOUNT')throw Error('INVALID_TRANSITION');if(proof.status==='REFUNDED'&&proof.refundedAmount!==o.amount)throw Error('PARTIAL_REFUND_BLOCKED');o.state=next;o.transactionId=transactionId;transactions.set(transactionId,orderId);events.set(eventId,fingerprint);return {...o}}
 };
}
