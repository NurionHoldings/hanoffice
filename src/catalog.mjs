/** HAN BIZ OFFICE - catalog and quotations. Illustrative pricing only. */
export const platform = Object.freeze({
  brand: "HAN BIZ OFFICE",
  operator: "(주)청전에스오엔지",
  domain: null,
  pgProvider: "헥토파이낸셜",
  branchId: "jongno-001",
  headquarters: {
    address: "서울특별시 종로구 새문안로 15-1",
    jibun: "서울특별시 종로구 평동 169",
    zipcode: "03181",
    english: "15-1 Saemunan-ro, Jongno-gu, Seoul, Republic of Korea",
    latitude: 37.5672049,
    longitude: 126.9674861,
    floorSuite: null,
    ownership: "DECLARED_NOT_VERIFIED",
    zoningSuitability: "UNVERIFIED",
    operatingStatus: "PREPARATION",
    isForSale: false
  },
  launchGate: { propertyRightsVerified: false, permittedUseVerified: false,
    taxRegistrationSuitabilityVerified: false, operatorApproved: false, pgApproved: false,
    electronicContractVerified: false }
});
export const plans = Object.freeze({
  individual: { label: "개인사업자", monthlyBase: 29000 },
  corporate: { label: "법인사업자", monthlyBase: 39000 }
});
export const allowedTerms = Object.freeze([1, 3, 6, 12, 24]);
export const termFactor = Object.freeze({1: 1.5, 3: 1.25, 6: 1.1, 12: 1, 24: 0.9});
export function calculateQuote({type="individual", months=12, mail=false, meeting=false} = {}) {
  if (!Object.hasOwn(plans,type)) throw new RangeError("지원하지 않는 고객 유형입니다.");
  if (!allowedTerms.includes(months)) throw new RangeError("지원하지 않는 계약 기간입니다.");
  if (typeof mail!=="boolean" || typeof meeting!=="boolean") throw new TypeError("부가서비스 값이 올바르지 않습니다.");
  const base = Math.round(plans[type].monthlyBase * termFactor[months] / 100) * 100;
  const monthly = base + (mail?5000:0) + (meeting?10000:0);
  const subtotal = monthly * months;
  const vat = Math.round(subtotal / 10);
  return { type,months,mail,meeting,monthly,subtotal,vat,total:subtotal+vat,currency:"KRW",
    isIllustrative:true,canCheckout:false,priceVersion:"demo-2026-11-24" };
}
export function isLaunchReady(gates=platform.launchGate) {
  return gates!==null && typeof gates==='object' && Object.keys(gates).length===6 && Object.keys(platform.launchGate).every(key=>Object.hasOwn(gates,key)&&gates[key]===true);
}
