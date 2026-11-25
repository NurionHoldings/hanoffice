/** Quote-to-contract preview links. Illustrative only; checkout stays blocked. */
export const CUSTOMER_TYPES = Object.freeze(["individual", "corporate"]);
export const TERMS = Object.freeze([1, 3, 6, 12, 24]);

const QUOTE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function contractPreviewHref({ type = "individual", months = 12, mail = false, meeting = false, quoteId = null } = {}) {
  if (!CUSTOMER_TYPES.includes(type)) throw new TypeError("지원하지 않는 고객 유형입니다.");
  const term = Number(months);
  if (!TERMS.includes(term)) throw new TypeError("지원하지 않는 계약 기간입니다.");
  if (typeof mail !== "boolean" || typeof meeting !== "boolean") throw new TypeError("부가서비스 값이 올바르지 않습니다.");
  const params = new URLSearchParams({
    type,
    months: String(term),
    mail: mail ? "1" : "0",
    meeting: meeting ? "1" : "0"
  });
  if (quoteId) params.set("quote", quoteId);
  return "/contract.html?" + params.toString();
}

export function readContractPreviewQuery(search = "") {
  const raw = String(search).startsWith("?") ? String(search).slice(1) : String(search);
  const query = new URLSearchParams(raw);
  const type = CUSTOMER_TYPES.includes(query.get("type")) ? query.get("type") : null;
  const months = Number(query.get("months"));
  const validMonths = TERMS.includes(months) ? months : null;
  const flag = (name) => query.get(name) === "1" ? true : query.get(name) === "0" ? false : null;
  const quote = QUOTE_ID.test(query.get("quote") || "") ? query.get("quote") : null;
  return {
    type,
    months: validMonths,
    mail: flag("mail"),
    meeting: flag("meeting"),
    quote,
    fromQuote: type !== null || validMonths !== null || quote !== null
  };
}

export function nextQuoteSelection(selection, patch) {
  return {
    type: patch.type ?? selection.type,
    months: patch.months ?? selection.months,
    mail: Object.hasOwn(patch, "mail") ? patch.mail : selection.mail,
    meeting: Object.hasOwn(patch, "meeting") ? patch.meeting : selection.meeting
  };
}

export function quoteFailureMessage(status) {
  if (status === 400) return "선택하신 조건으로는 이용료를 계산할 수 없습니다. 사업자 유형과 기간을 다시 확인해 주세요.";
  return "이용료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
