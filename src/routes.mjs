import { getDatabase } from "./db.mjs";
import {
  fail, registerAccount, loginAccount, accountFromToken, logoutAccount,
  createStoredQuote, readStoredQuote, createDraftOrder, SESSION_HOURS
} from "./platform.mjs";

const QUOTE_PATH = /^\/api\/quotes\/([^/]+)$/;

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionCookie(token) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  const value = token ? `${encodeURIComponent(token)}; Max-Age=${SESSION_HOURS * 3600}` : "; Max-Age=0";
  return `han_session=${value}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function rejectCrossSite(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch { throw fail(403, "BAD_ORIGIN", "요청 출처를 확인할 수 없습니다."); }
  if (host !== req.headers.host) throw fail(403, "BAD_ORIGIN", "다른 사이트의 요청은 거절됩니다.");
}

async function databaseFor(option) {
  if (option === null) return null;
  if (option) return option;
  try { return await getDatabase(); }
  catch { return null; }
}

function unavailable(reply, res) {
  return reply(res, 503, { error: "DATABASE_UNAVAILABLE", message: "데이터베이스가 연결되지 않아 요청을 저장할 수 없습니다." });
}

export async function handlePlatform(req, res, path, databaseOption, readJson, reply) {
  const quoteMatch = path.match(QUOTE_PATH);
  const claimed = path === "/api/auth/register" || path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/session" || path === "/api/quotes" || quoteMatch || path === "/api/account/orders" || path === "/api/identity/status" || path === "/api/identity/verify";
  if (!claimed) return false;
  try {
    if (path === "/api/identity/status" && req.method === "GET") {
      reply(res, 200, { connected: false, provider: null, message: "본인인증 사업자가 연결되지 않았습니다." });
      return true;
    }
    if (path === "/api/identity/verify") {
      reply(res, 503, { error: "IDENTITY_NOT_CONNECTED", message: "본인인증 사업자가 연결되지 않았습니다." });
      return true;
    }
    const db = await databaseFor(databaseOption);
    if (!db) { unavailable(reply, res); return true; }
    const token = cookies(req).han_session;
    if (req.method === "POST") rejectCrossSite(req);
    if (path === "/api/auth/register" && req.method === "POST") {
      const account = await registerAccount(db, await readJson(req));
      reply(res, 201, { account });
      return true;
    }
    if (path === "/api/auth/login" && req.method === "POST") {
      const session = await loginAccount(db, await readJson(req));
      reply(res, 200, { account: session.account, expiresAt: session.expiresAt }, { "Set-Cookie": sessionCookie(session.token) });
      return true;
    }
    if (path === "/api/auth/logout" && req.method === "POST") {
      await logoutAccount(db, token);
      reply(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("") });
      return true;
    }
    if (path === "/api/auth/session" && req.method === "GET") {
      const account = await accountFromToken(db, token);
      reply(res, account ? 200 : 401, account ? { account } : { error: "LOGIN_REQUIRED", message: "로그인이 필요합니다." });
      return true;
    }
    const actor = await accountFromToken(db, token);
    if (path === "/api/quotes" && req.method === "POST") {
      reply(res, 201, await createStoredQuote(db, await readJson(req), actor?.id ?? null));
      return true;
    }
    if (quoteMatch && req.method === "GET") {
      reply(res, 200, await readStoredQuote(db, decodeURIComponent(quoteMatch[1]), actor));
      return true;
    }
    if (path === "/api/account/orders" && req.method === "POST") {
      reply(res, 201, await createDraftOrder(db, actor, await readJson(req)));
      return true;
    }
    reply(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  } catch (error) {
    reply(res, error.status || 500, { error: error.code || (error.status ? "BAD_REQUEST" : "SERVER_ERROR"), message: error.status ? error.message : "요청을 처리하지 못했습니다." });
    return true;
  }
}
