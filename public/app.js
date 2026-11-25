import { contractPreviewHref } from "./homepage-model.mjs";

const form = document.querySelector("#quote-form");
const status = document.querySelector("#quote-status");
const toggle = document.querySelector("#nav-toggle");
const nav = document.querySelector("#site-nav");
const won = (n) => new Intl.NumberFormat("ko-KR").format(n) + "원";
let revision = 0;

function selection() {
  return {
    type: form.elements.type.value,
    months: Number(form.elements.months.value),
    mail: form.elements.mail.checked,
    meeting: form.elements.meeting.checked
  };
}

function syncContractLinks() {
  const href = contractPreviewHref(selection());
  for (const id of ["to-contract", "journey-contract"]) {
    const node = document.getElementById(id);
    if (node) node.href = href;
  }
}

async function renderQuote(event) {
  const token = ++revision;
  event?.preventDefault();
  syncContractLinks();
  status.textContent = "서버에서 예시 견적을 계산하고 있습니다.";
  try {
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection())
    });
    const quote = await res.json();
    if (token !== revision) return;
    if (!res.ok) throw new Error(quote.message || "요청 실패");
    document.querySelector("#total").textContent = won(quote.total);
    document.querySelector("#monthly").textContent = won(quote.monthly);
    document.querySelector("#subtotal").textContent = won(quote.subtotal);
    document.querySelector("#vat").textContent = won(quote.vat);
    status.textContent = "서버 계산 완료 · 이 견적은 판매가격이 아닌 예시입니다.";
  } catch (error) {
    if (token !== revision) return;
    status.textContent = "견적 계산 실패: " + error.message;
  }
}

form.addEventListener("submit", renderQuote);
form.addEventListener("change", renderQuote);

toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "닫기" : "메뉴";
  nav.classList.toggle("is-open", open);
});

nav.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "메뉴";
  nav.classList.remove("is-open");
});

document.querySelector("#copy-address").addEventListener("click", async () => {
  const output = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText("서울특별시 종로구 새문안로 15-1");
    output.textContent = "도로명주소를 복사했습니다.";
  } catch {
    output.textContent = "복사를 지원하지 않는 환경입니다. 표시된 주소를 직접 복사해주세요.";
  }
});

renderQuote();
