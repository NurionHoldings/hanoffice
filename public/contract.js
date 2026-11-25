import { consentItems, draftContract, mockSign } from "./contract-model.mjs";
import { readContractPreviewQuery } from "./homepage-model.mjs";

const $ = (id) => document.getElementById(id);
let draft = null;
let revision = 0;
let storedQuote = null;
const preview = readContractPreviewQuery(location.search);

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function selection() {
  return {
    type: $("type").value,
    months: Number($("months").value),
    mail: $("mail").checked,
    meeting: $("meeting").checked
  };
}

function updateHandoff() {
  const node = $("handoff");
  if (!node) return;
  const parts = [];
  if (storedQuote) parts.push(`견적번호 ${storedQuote.number} 조건으로 안내합니다. ${storedQuote.expiresAt.slice(0, 10)}까지 확인할 수 있습니다.`);
  else if (preview.fromQuote) parts.push("홈에서 고르신 조건으로 예상 이용료를 확인합니다.");
  if ($("mail").checked) parts.push("우편물 스캔이 포함됩니다.");
  if ($("meeting").checked) parts.push("회의실 이용이 포함됩니다.");
  parts.push("본인 확인과 결제는 아직 시작되지 않습니다.");
  node.hidden = false;
  node.textContent = parts.join(" ");
}

function reset() {
  revision += 1;
  draft = null;
  for (const id of ["document", "review", "receipt", "print"]) $(id).hidden = true;
  $("sign").disabled = true;
  $("status").textContent = "";
}

for (const id of ["type", "months", "mail", "meeting", "start"]) {
  $(id).addEventListener("change", () => {
    if (storedQuote) {
      const current = selection();
      const same = current.type === storedQuote.type && current.months === storedQuote.months && current.mail === storedQuote.mail && current.meeting === storedQuote.meeting;
      if (!same) storedQuote = null;
    }
    reset();
    updateHandoff();
  });
}

if (preview.type) $("type").value = preview.type;
if (preview.months) $("months").value = String(preview.months);
if (preview.mail !== null) $("mail").checked = preview.mail;
if (preview.meeting !== null) $("meeting").checked = preview.meeting;
updateHandoff();

if (preview.quote) {
  const savedId = preview.quote;
  fetch("/api/quotes/" + savedId).then(async (response) => {
    if (!response.ok) {
      $("status").textContent = "저장된 견적을 불러오지 못했습니다. 선택한 조건으로 다시 안내합니다.";
      return;
    }
    storedQuote = await response.json();
    $("type").value = storedQuote.type;
    $("months").value = String(storedQuote.months);
    $("mail").checked = storedQuote.mail;
    $("meeting").checked = storedQuote.meeting;
    updateHandoff();
  }).catch(() => {
    $("status").textContent = "저장된 견적을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  });
}

$("generate").addEventListener("click", async () => {
  reset();
  const token = revision;
  try {
    const { type, months, mail, meeting } = selection();
    const start = $("start").value;
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, months, mail, meeting })
    });
    if (!response.ok) throw new Error("quote");
    const quote = await response.json();
    if (token !== revision) return;
    if (storedQuote && (storedQuote.total !== quote.total || storedQuote.mail !== mail || storedQuote.meeting !== meeting)) {
      $("status").textContent = "저장된 견적과 현재 선택이 다릅니다. 홈에서 이용료를 다시 계산해 주세요.";
      return;
    }
    draft = draftContract({ type, months, start, quote });
    const heading = storedQuote ? `견적번호 ${storedQuote.number}` : "안내 견적";
    $("document").replaceChildren(
      el("h2", "02 비상주사무실 이용 조건"),
      el("p", `임대인: ${draft.operator}\n임차인: ${draft.tenant}\n소재지: ${draft.address}\n기간: ${draft.start} ~ ${draft.end}\n${heading}\n예상 총액(부가세 포함): ${draft.total.toLocaleString("ko-KR")}원`),
      el("p", "제1조 목적: 사업자등록용 주소 사용을 위한 임대 조건의 예시. 실제 주소 사용 권한을 부여하지 않는다."),
      el("p", "제2조 사용범위: 실제 업종 적합성, 층·호실, 건축물 용도 및 임대 권리는 별도 검증한다."),
      el("p", "제3조 대금 및 해지: 표시 금액은 예시이며 환불·해지·갱신 조건은 정식 계약 전 확정한다."),
      el("p", "제4조 효력: 본 문서는 안내 문서이며 본인 확인, 실제 서명, 결제를 수행하지 않는다.")
    );
    $("document").hidden = false;
    $("review").hidden = false;
    $("consents").replaceChildren();
    for (const item of consentItems) {
      const label = el("label", "");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", () => {
        $("sign").disabled = ![...$("consents").querySelectorAll("input")].every((input) => input.checked);
      });
      label.append(box, document.createTextNode(item));
      $("consents").append(label);
    }
  } catch {
    if (token === revision) $("status").textContent = "계약 내용을 만들지 못했습니다. 날짜와 견적을 다시 확인해 주세요.";
  }
});

$("sign").addEventListener("click", async () => {
  const token = revision;
  $("sign").disabled = true;
  try {
    const evidence = await mockSign(draft, [...$("consents").querySelectorAll("input")].map((input) => input.checked));
    if (token !== revision) return;
    $("receipt").replaceChildren(
      el("h2", "04 서명 안내"),
      el("p", "SHA-256: " + evidence.digest),
      el("p", "본인 확인 전 · 법적 효력 없음 · 서버에 계약이 저장되지 않음")
    );
    $("receipt").hidden = false;
    $("print").hidden = false;
    for (const box of $("consents").querySelectorAll("input")) box.disabled = true;
  } catch {
    if (token === revision) {
      $("status").textContent = "서명 안내를 완료하지 못했습니다.";
      $("sign").disabled = false;
    }
  }
});

$("print").addEventListener("click", () => window.print());
