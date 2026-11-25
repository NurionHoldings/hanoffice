import { consentItems, draftContract, mockSign } from "./contract-model.mjs";
import { readContractPreviewQuery } from "./homepage-model.mjs";

const $ = (id) => document.getElementById(id);
let draft = null;
let revision = 0;
let extras = { mail: false, meeting: false };
const preview = readContractPreviewQuery(location.search);

function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function updateHandoff() {
  const node = $("handoff");
  if (!node) return;
  if (!preview.fromQuote) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  const parts = ["홈 견적에서 이어진 미리보기입니다. 실제 본인인증·결제·계약은 시작되지 않습니다."];
  if (extras.mail) parts.push("우편물 스캔 옵션이 모의 견적에 포함됩니다.");
  if (extras.meeting) parts.push("회의실 옵션이 모의 견적에 포함됩니다.");
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

for (const id of ["type", "months"]) {
  $(id).addEventListener("change", () => {
    extras = { mail: false, meeting: false };
    updateHandoff();
    reset();
  });
}
$("start").addEventListener("change", reset);

if (preview.type) $("type").value = preview.type;
if (preview.months) $("months").value = String(preview.months);
extras = { mail: preview.mail === true, meeting: preview.meeting === true };
updateHandoff();

$("generate").addEventListener("click", async () => {
  reset();
  const token = revision;
  try {
    const type = $("type").value;
    const months = Number($("months").value);
    const start = $("start").value;
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, months, mail: extras.mail, meeting: extras.meeting })
    });
    if (!res.ok) throw new Error("quote");
    const quote = await res.json();
    if (token !== revision) return;
    draft = draftContract({ type, months, start, quote });
    $("document").replaceChildren(
      el("h2", "02 비상주사무실 임대차계약서 (모의)"),
      el("p", "임대인: " + draft.operator + "\n임차인: " + draft.tenant + "\n소재지: " + draft.address + "\n기간: " + draft.start + " ~ " + draft.end + "\n예시 총액(VAT 포함): " + draft.total.toLocaleString("ko-KR") + "원"),
      el("p", "제1조 목적: 사업자등록용 주소 사용을 위한 임대 조건의 예시. 실제 주소 사용 권한을 부여하지 않는다."),
      el("p", "제2조 사용범위: 실제 업종 적합성, 층·호실, 건축물 용도 및 임대 권리는 별도 검증한다."),
      el("p", "제3조 대금 및 해지: 표시 금액은 예시이며 환불·해지·갱신 조건은 정식 계약 전 확정한다."),
      el("p", "제4조 효력: 본 문서는 개발 검수용이며 당사자 본인인증 및 실제 서명·결제를 수행하지 않는다.")
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
    if (token === revision) $("status").textContent = "계약서 생성 실패: 날짜 또는 견적 연결을 확인하십시오.";
  }
});

$("sign").addEventListener("click", async () => {
  const token = revision;
  $("sign").disabled = true;
  try {
    const evidence = await mockSign(draft, [...$("consents").querySelectorAll("input")].map((input) => input.checked));
    if (token !== revision) return;
    $("receipt").replaceChildren(
      el("h2", "04 모의 서명 증빙"),
      el("p", "SHA-256: " + evidence.digest),
      el("p", "본인인증 미완료 · 법적 효력 없음 · 서버 저장 없음")
    );
    $("receipt").hidden = false;
    $("print").hidden = false;
    for (const box of $("consents").querySelectorAll("input")) box.disabled = true;
  } catch {
    if (token === revision) {
      $("status").textContent = "모의 서명 실패";
      $("sign").disabled = false;
    }
  }
});

$("print").addEventListener("click", () => window.print());
