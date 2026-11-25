import { randomBytes, randomUUID } from "node:crypto";
import { calculateQuote, platform } from "./catalog.mjs";
import { hashPassword, verifyPassword, newSessionToken, sha256 } from "./passwords.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RRN = /\d{6}-?\d{7}/;
export const QUOTE_DAYS = 14;
export const SESSION_HOURS = 8;
export const LOGIN_LIMIT = 8;

export function fail(status, error, message) {
  const err = new Error(message);
  err.status = status;
  err.code = error;
  return err;
}

export function assertNoSensitive(value) {
  if (RRN.test(JSON.stringify(value ?? ""))) throw fail(400, "SENSITIVE_DATA", "주민등록번호 형식은 저장하지 않습니다. 테스트 정보만 입력해 주세요.");
}

function cleanEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 254) throw fail(400, "INVALID_ACCOUNT", "테스트용 이메일 형식을 확인해 주세요.");
  return value;
}

function cleanPassword(password, email) {
  const value = String(password || "");
  if (value.length < 10 || value.length > 128) throw fail(400, "INVALID_ACCOUNT", "비밀번호는 10자 이상으로 정해 주세요.");
  if (value.toLowerCase() === email) throw fail(400, "INVALID_ACCOUNT", "비밀번호는 이메일과 다르게 정해 주세요.");
  return value;
}

function cleanName(name) {
  const value = String(name || "").trim();
  if (value.length < 1 || value.length > 30) throw fail(400, "INVALID_ACCOUNT", "표시 이름은 1자에서 30자까지 입력해 주세요.");
  return value;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function flag(value) {
  return value === true || value === "t" || value === "true";
}

export function mapQuote(row) {
  return {
    id: row.id,
    number: row.public_number,
    type: row.customer_type,
    months: Number(row.months),
    mail: flag(row.mail),
    meeting: flag(row.meeting),
    monthly: numberValue(row.monthly),
    subtotal: numberValue(row.subtotal),
    vat: numberValue(row.vat),
    total: numberValue(row.total),
    currency: row.currency,
    priceVersion: row.price_version,
    isIllustrative: true,
    canCheckout: false,
    expiresAt: new Date(row.expires_at).toISOString(),
    customerId: row.customer_id,
    branchId: row.branch_id,
    productId: row.product_id
  };
}

export function canReadQuote(actor, quote) {
  if (!quote.customerId) return true;
  if (!actor) return false;
  if (actor.role === "operator") return true;
  return actor.id === quote.customerId;
}

function quoteNumber() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `HBQ-${day}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function registerAccount(db, input) {
  assertNoSensitive(input);
  const email = cleanEmail(input.email);
  const password = cleanPassword(input.password, email);
  const name = cleanName(input.displayName);
  const id = randomUUID();
  try {
    await db.query(
      "INSERT INTO customers (id, auth_subject, email, password_hash, display_name, role) VALUES ($1,$2,$3,$4,$5,'customer')",
      [id, `local:${id}`, email, await hashPassword(password), name]
    );
  } catch (error) {
    if (error.code === "23505") throw fail(409, "ACCOUNT_EXISTS", "이미 등록된 테스트 이메일입니다.");
    throw error;
  }
  return { id, email, displayName: name, role: "customer" };
}

async function failedLogins(db, email) {
  const rows = await db.query(
    "SELECT count(*)::int AS n FROM login_attempts WHERE email = $1 AND succeeded = false AND attempted_at > now() - interval '15 minutes'",
    [email]
  );
  return Number(rows[0].n);
}

export async function loginAccount(db, input) {
  assertNoSensitive(input);
  const email = cleanEmail(input.email);
  const password = String(input.password || "");
  if (await failedLogins(db, email) >= LOGIN_LIMIT) throw fail(429, "LOGIN_LIMITED", "로그인 시도가 많아 잠시 후 다시 시도해 주세요.");
  const rows = await db.query("SELECT id, email, password_hash, role FROM customers WHERE lower(email) = $1", [email]);
  const account = rows[0];
  const valid = account?.password_hash ? await verifyPassword(password, account.password_hash) : false;
  await db.query("INSERT INTO login_attempts (email, succeeded) VALUES ($1,$2)", [email, valid]);
  if (!valid) throw fail(401, "LOGIN_FAILED", "이메일 또는 비밀번호가 올바르지 않습니다.");
  const session = newSessionToken();
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await db.query("INSERT INTO sessions (id, customer_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)", [randomUUID(), account.id, session.hash, expires.toISOString()]);
  return { token: session.token, expiresAt: expires.toISOString(), account: { id: account.id, email: account.email, role: account.role } };
}

export async function accountFromToken(db, token) {
  if (!token) return null;
  const rows = await db.query(
    `SELECT c.id, c.email, c.role, s.id AS session_id, s.expires_at
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1`,
    [sha256(token)]
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.query("DELETE FROM sessions WHERE id = $1", [row.session_id]);
    return null;
  }
  return { id: row.id, email: row.email, role: row.role };
}

export async function logoutAccount(db, token) {
  if (token) await db.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

export async function createStoredQuote(db, input, customerId = null) {
  assertNoSensitive(input);
  const quote = calculateQuote({
    type: input.type,
    months: Number(input.months),
    mail: input.mail === true,
    meeting: input.meeting === true
  });
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const rows = await db.query(
        `INSERT INTO quotes (id, public_number, customer_id, branch_id, product_id, customer_type, months, mail, meeting, price_version, monthly, subtotal, vat, total, expires_at)
         VALUES ($1,$2,$3,$4,'virtual-office',$5,$6,$7,$8,$9,$10,$11,$12,$13, now() + interval '14 days')
         RETURNING *`,
        [randomUUID(), quoteNumber(), customerId, platform.branchId, quote.type, quote.months, quote.mail, quote.meeting, quote.priceVersion, quote.monthly, quote.subtotal, quote.vat, quote.total]
      );
      return mapQuote(rows[0]);
    } catch (error) {
      lastError = error;
      if (error.code !== "23505") throw error;
    }
  }
  throw lastError;
}

export async function readStoredQuote(db, id, actor) {
  if (!UUID.test(String(id || ""))) throw fail(404, "QUOTE_NOT_FOUND", "견적을 찾을 수 없습니다.");
  const rows = await db.query("SELECT * FROM quotes WHERE id = $1", [id]);
  if (!rows[0]) throw fail(404, "QUOTE_NOT_FOUND", "견적을 찾을 수 없습니다.");
  const quote = mapQuote(rows[0]);
  if (!canReadQuote(actor, quote)) throw fail(404, "QUOTE_NOT_FOUND", "견적을 찾을 수 없습니다.");
  if (new Date(quote.expiresAt).getTime() <= Date.now()) throw fail(410, "QUOTE_EXPIRED", "견적 유효기간이 지났습니다. 이용료를 다시 계산해 주세요.");
  return quote;
}

export function assertUntampered(stored, claimed = {}) {
  const checks = [
    ["type", claimed.type, stored.type],
    ["months", claimed.months == null ? null : Number(claimed.months), stored.months],
    ["mail", claimed.mail, stored.mail],
    ["meeting", claimed.meeting, stored.meeting],
    ["total", claimed.total == null ? null : Number(claimed.total), stored.total],
    ["priceVersion", claimed.priceVersion, stored.priceVersion]
  ];
  for (const [name, given, expected] of checks) {
    if (given != null && given !== expected) throw fail(409, "QUOTE_TAMPERED", `견적 조건이 서버에 저장된 값과 다릅니다. (${name})`);
  }
}

export async function createDraftOrder(db, actor, input) {
  if (!actor) throw fail(401, "LOGIN_REQUIRED", "견적을 주문으로 남기려면 테스트 계정으로 로그인해 주세요.");
  assertNoSensitive(input);
  return db.transaction(async (tx) => {
    const rows = await tx.query("SELECT * FROM quotes WHERE id = $1 FOR UPDATE", [input.quoteId]);
    if (!rows[0]) throw fail(404, "QUOTE_NOT_FOUND", "견적을 찾을 수 없습니다.");
    const quote = mapQuote(rows[0]);
    if (!canReadQuote(actor, quote)) throw fail(404, "QUOTE_NOT_FOUND", "견적을 찾을 수 없습니다.");
    if (new Date(quote.expiresAt).getTime() <= Date.now()) throw fail(410, "QUOTE_EXPIRED", "견적 유효기간이 지났습니다.");
    assertUntampered(quote, input);
    if (!quote.customerId) await tx.query("UPDATE quotes SET customer_id = $1 WHERE id = $2", [actor.id, quote.id]);
    const customerId = quote.customerId || actor.id;
    const orderId = randomUUID();
    try {
      await tx.query(
        `INSERT INTO orders (id, customer_id, branch_id, price_version, amount, state, quote_id, months, mail, meeting)
         VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9)`,
        [orderId, customerId, quote.branchId, quote.priceVersion, quote.total, quote.id, quote.months, quote.mail, quote.meeting]
      );
    } catch (error) {
      if (error.code === "23505") throw fail(409, "ORDER_EXISTS", "이 견적으로는 주문을 한 번만 만들 수 있습니다.");
      throw error;
    }
    await tx.query("INSERT INTO audit_events (order_id, actor_subject, event_type) VALUES ($1,$2,'ORDER_DRAFTED')", [orderId, actor.email]);
    return { id: orderId, quoteId: quote.id, amount: quote.total, state: "DRAFT", canCheckout: false };
  });
}

const SNAPSHOT_TABLES = ["customers", "sessions", "login_attempts", "quotes", "orders", "contracts", "payments", "payment_events", "audit_events"];

export async function exportSnapshot(db) {
  const snapshot = {};
  for (const table of SNAPSHOT_TABLES) snapshot[table] = await db.query(`SELECT * FROM ${table}`);
  return snapshot;
}

export async function restoreSnapshot(db, snapshot) {
  await db.transaction(async (tx) => {
    for (const table of [...SNAPSHOT_TABLES].reverse()) await tx.query(`DELETE FROM ${table}`);
    for (const table of SNAPSHOT_TABLES) {
      for (const row of snapshot[table]) {
        const keys = Object.keys(row);
        const params = keys.map((key) => row[key]);
        const columns = keys.map((key) => `"${key}"`).join(",");
        const slots = keys.map((_, index) => `$${index + 1}`).join(",");
        const override = table === "audit_events" || table === "login_attempts" ? "OVERRIDING SYSTEM VALUE " : "";
        await tx.query(`INSERT INTO ${table} (${columns}) ${override}VALUES (${slots})`, params);
      }
    }
  });
}
