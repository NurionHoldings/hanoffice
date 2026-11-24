import test from 'node:test';
import assert from 'node:assert/strict';
import {draftOrder,transition} from '../src/order-machine.mjs';
function pending(){let o=draftOrder('demo-1',{});o=transition(o,'review',{mockEligibility:true});o=transition(o,'sign',{mockDocumentDigest:'a'.repeat(64)});return transition(o,'requestPayment');}
const proof=o=>({provider:'MOCK',environment:'TEST',orderId:o.id,amount:o.amount,transactionId:'mock-1',verified:true});
test('mock order lifecycle',()=>{let o=pending();o=transition(o,'confirm',proof(o));assert.equal(o.state,'PAID');o=transition(o,'activate',{mockActivationApproval:true});assert.equal(o.state,'ACTIVE');assert.equal(transition(o,'refund',proof(o)).state,'REFUNDED');});
test('reject altered amount, foreign order, live and duplicate confirmation',()=>{const o=pending();for(const p of [{amount:1},{orderId:'other'},{provider:'HECTO'},{environment:'LIVE'},{verified:false}])assert.throws(()=>transition(o,'confirm',{...proof(o),...p}));const paid=transition(o,'confirm',proof(o));assert.throws(()=>transition(paid,'confirm',proof(o)));assert.throws(()=>transition({...o,environment:'LIVE'},'confirm',proof(o)));assert.throws(()=>transition(paid,'refund',{...proof(o),transactionId:'wrong'}));});
test('cannot bypass eligibility, signature or payment',()=>{const o=draftOrder('x',{});assert.throws(()=>transition(o,'review'));assert.throws(()=>transition(o,'activate'));assert.throws(()=>transition(transition(o,'review',{mockEligibility:true}),'sign'));});
