import { contractPreviewHref, quoteFailureMessage } from "./homepage-model.mjs";

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

function syncContractLinks(quoteId = null) {
  const href = contractPreviewHref({ ...selection(), quoteId });
  for (const id of ["to-contract", "journey-contract"]) {
    const node = document.getElementById(id);
    if (node) node.href = href;
  }
}

function clearTotals() {
  for (const id of ["total", "monthly", "subtotal", "vat"]) document.querySelector("#" + id).textContent = "—";
}

async function renderQuote(event) {
  const token = ++revision;
  event?.preventDefault();
  status.textContent = "예상 이용료를 계산하고 있습니다.";
  try {
    syncContractLinks();
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection())
    });
    let quote = null;
    try { quote = await res.json(); } catch { quote = null; }
    if (token !== revision) return;
    if (!res.ok) throw Object.assign(new Error(quote?.message || quoteFailureMessage(res.status)), { status: res.status });
    document.querySelector("#total").textContent = won(quote.total);
    document.querySelector("#monthly").textContent = won(quote.monthly);
    document.querySelector("#subtotal").textContent = won(quote.subtotal);
    document.querySelector("#vat").textContent = won(quote.vat);
    let note = "예상 이용료입니다. 판매 가격이 아니며 결제는 아직 열리지 않습니다.";
    try {
      const saved = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection())
      });
      if (token !== revision) return;
      if (saved.status === 503) note += " 견적번호는 시스템 연결 후 발급됩니다.";
      else if (saved.ok) {
        const stored = await saved.json();
        syncContractLinks(stored.id);
        note = `견적번호 ${stored.number}입니다. ${stored.expiresAt.slice(0, 10)}까지 이 조건으로 확인할 수 있습니다. 결제는 아직 열리지 않습니다.`;
      } else note += " 견적번호를 발급하지 못했습니다.";
    } catch {
      if (token !== revision) return;
      note += " 견적번호를 발급하지 못했습니다.";
    }
    status.textContent = note;
  } catch (error) {
    if (token !== revision) return;
    clearTotals();
    status.textContent = error instanceof TypeError || error.status === 400
      ? quoteFailureMessage(400)
      : error.status
        ? quoteFailureMessage(error.status)
        : "이용료를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
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
    output.textContent = "이 브라우저에서는 복사할 수 없습니다. 주소를 길게 눌러 복사해 주세요.";
  }
});

renderQuote();
