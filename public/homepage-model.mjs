/** Quote-to-contract preview links. Illustrative only; checkout stays blocked. */
export const CUSTOMER_TYPES = Object.freeze(["individual", "corporate"]);
export const TERMS = Object.freeze([1, 3, 6, 12, 24]);

export function contractPreviewHref({ type = "individual", months = 12, mail = false, meeting = false } = {}) {
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
  return "/contract.html?" + params.toString();
}

export function readContractPreviewQuery(search = "") {
  const raw = String(search).startsWith("?") ? String(search).slice(1) : String(search);
  const query = new URLSearchParams(raw);
  const type = CUSTOMER_TYPES.includes(query.get("type")) ? query.get("type") : null;
  const months = Number(query.get("months"));
  const validMonths = TERMS.includes(months) ? months : null;
  const flag = (name) => query.get(name) === "1" ? true : query.get(name) === "0" ? false : null;
  return {
    type,
    months: validMonths,
    mail: flag("mail"),
    meeting: flag("meeting"),
    fromQuote: type !== null || validMonths !== null
  };
}
