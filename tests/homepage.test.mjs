import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../server.mjs";
import { contractPreviewHref, readContractPreviewQuery, nextQuoteSelection, quoteFailureMessage } from "../public/homepage-model.mjs";

test("contract preview href stays on the demo contract page", () => {
  assert.equal(contractPreviewHref(), "/contract.html?type=individual&months=12&mail=0&meeting=0");
  assert.equal(
    contractPreviewHref({ type: "corporate", months: 6, mail: true, meeting: false }),
    "/contract.html?type=corporate&months=6&mail=1&meeting=0"
  );
  assert.throws(() => contractPreviewHref({ type: "unknown", months: 12 }), TypeError);
  assert.throws(() => contractPreviewHref({ months: 2 }), TypeError);
  assert.throws(() => contractPreviewHref({ mail: "yes" }), TypeError);
  assert.deepEqual(readContractPreviewQuery("?type=corporate&months=24&mail=0&meeting=1"), {
    type: "corporate", months: 24, mail: false, meeting: true, quote: null, fromQuote: true
  });
  assert.equal(nextQuoteSelection({ type: "individual", months: 12, mail: true, meeting: true }, { type: "corporate", months: 6 }).mail, true);
  assert.equal(quoteFailureMessage(400).includes("기간"), true);
  assert.equal(quoteFailureMessage(500).includes("불러오지 못했습니다"), true);
  const rejected = readContractPreviewQuery("?type=person&months=2&mail=true");
  assert.equal(rejected.type, null);
  assert.equal(rejected.months, null);
  assert.equal(rejected.mail, null);
  assert.equal(rejected.fromQuote, false);
});

test("contract page reads the quote handoff without enabling checkout", async () => {
  const src = await readFile(new URL("../public/contract.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/contract.html", import.meta.url), "utf8");
  assert.match(src, /readContractPreviewQuery/);
  assert.match(src, /\$\("mail"\)\.checked/);
  assert.match(src, /\$\("meeting"\)\.checked/);
  assert.doesNotMatch(src, /mail:\s*false/);
  assert.match(html, /id="handoff"/);
  assert.match(html, /id="mail"/);
  assert.match(html, /id="meeting"/);
  assert.doesNotMatch(src, /\/api\/checkout/);
});

test("homepage keeps navigation, quote fields, notices, and licensed media", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  const index = await fetch(base + "/");
  assert.equal(index.status, 200);
  const html = await index.text();
  for (const id of ["nav-toggle", "site-nav", "quote-form", "quote-status", "total", "monthly", "subtotal", "vat", "copy-address", "copy-status", "naver", "to-contract", "journey-contract", "quote", "steps"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /HAN BIZ OFFICE/);
  assert.match(html, /실제 계약 및 결제는 아직 제공하지 않습니다/);
  assert.match(html, /실제 결제·전자계약은 현재 비활성화되어 있습니다/);
  assert.match(html, /승인된 사업장 사진이 없습니다/);
  assert.match(html, /임대 호실이 아닙니다/);
  assert.match(html, /Hoseoklee88/);
  assert.match(html, /CC BY-SA 3.0/);
  assert.match(html, /name="type"/);
  assert.match(html, /name="months"/);
  assert.match(html, /name="mail"/);
  assert.match(html, /name="meeting"/);
  assert.match(html, /href="\/location\.html"/);
  assert.match(html, /href="\/portal\.html"/);
  assert.match(html, /class="nav-cta" href="\/contract\.html"/);
  assert.match(html, /id="to-contract" href="\/contract\.html\?type=individual&months=12&mail=0&meeting=0"/);
  assert.match(html, /id="journey-contract" href="\/contract\.html\?type=individual&months=12&mail=0&meeting=0"/);
  assert.equal(html.includes("/api/checkout"), false);
  const quote = await fetch(base + "/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "individual", months: 12, mail: true, meeting: false })
  });
  assert.equal(quote.status, 200);
  assert.deepEqual(await quote.json(), {
    type: "individual", months: 12, mail: true, meeting: false,
    monthly: 34000, subtotal: 408000, vat: 40800, total: 448800,
    currency: "KRW", isIllustrative: true, canCheckout: false, priceVersion: "demo-2026-11-24"
  });
  assert.equal((await fetch(base + "/api/checkout", { method: "POST" })).status, 503);
  const photo = await fetch(base + "/media/saemunan-street.jpg");
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
  const font = await fetch(base + "/fonts/pretendard-700.woff2");
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  const credits = await fetch(base + "/media/CREDITS.txt");
  assert.equal(credits.status, 200);
  assert.match(await credits.text(), /CC BY-SA 3.0/);
  assert.equal((await fetch(base + "/secret.env")).status, 404);
});
