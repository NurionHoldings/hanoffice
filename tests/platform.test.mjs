import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.mjs";
import { hashPassword } from "../src/passwords.mjs";
import { exportSnapshot, restoreSnapshot, assertUntampered } from "../src/platform.mjs";
import { createTestDatabase } from "./helpers/database.mjs";

const exec = promisify(execFile);
const password = "test-password-1";

function cookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/han_session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function listen(database) {
  const server = createApp({ database }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, base: "http://127.0.0.1:" + server.address().port };
}

async function json(base, path, { method = "GET", body, token } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { cookie: `han_session=${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json(), token: cookie(response) || token };
}

test("durable routes fail closed without a database and checkout stays blocked", async (t) => {
  const { server, base } = await listen(null);
  t.after(() => server.close());
  const saved = await json(base, "/api/quotes", { method: "POST", body: { type: "individual", months: 12, mail: false, meeting: false } });
  assert.equal(saved.status, 503);
  assert.equal(saved.body.error, "DATABASE_UNAVAILABLE");
  const orders = await json(base, "/api/orders", { method: "POST", body: {} });
  assert.equal(orders.status, 503);
  assert.equal(orders.body.error, "LAUNCH_BLOCKED");
  const identity = await json(base, "/api/identity/verify", { method: "POST", body: {} });
  assert.equal(identity.status, 503);
  assert.equal(identity.body.error, "IDENTITY_NOT_CONNECTED");
  const status = await json(base, "/api/identity/status");
  assert.equal(status.body.connected, false);
  const quote = await json(base, "/api/quote", { method: "POST", body: { type: "individual", months: 12, mail: false, meeting: false } });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.canCheckout, false);
});

test("postgres records survive restart, isolation, tamper checks, and restore", async (t) => {
  const handle = await createTestDatabase();
  let db = handle.db;
  t.after(() => handle.close(db));
  const { server, base } = await listen(db);
  t.after(() => server.close());
  const stamp = Date.now().toString(36);
  const email = `customer-${stamp}@example.test`;
  const other = `other-${stamp}@example.test`;
  const operatorEmail = `operator-${stamp}@example.test`;
  assert.equal((await json(base, "/api/auth/register", { method: "POST", body: { email, password, displayName: "테스트고객", residentId: "900101-1234567" } })).status, 400);
  const created = await json(base, "/api/auth/register", { method: "POST", body: { email, password, displayName: "테스트고객" } });
  assert.equal(created.status, 201);
  assert.equal((await json(base, "/api/auth/register", { method: "POST", body: { email, password, displayName: "테스트고객" } })).status, 409);
  assert.equal((await json(base, "/api/auth/login", { method: "POST", body: { email, password: "wrong-password" } })).status, 401);
  const login = await json(base, "/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(login.status, 200);
  assert.equal((await json(base, "/api/auth/session", { token: login.token })).body.account.role, "customer");
  const otherLogin = await json(base, "/api/auth/register", { method: "POST", body: { email: other, password, displayName: "다른고객" } });
  assert.equal(otherLogin.status, 201);
  const otherSession = await json(base, "/api/auth/login", { method: "POST", body: { email: other, password } });
  await db.query(
    "INSERT INTO customers (id, auth_subject, email, password_hash, display_name, role) VALUES ($1,$2,$3,$4,$5,'operator')",
    [crypto.randomUUID(), `local:operator-${Date.now()}`, operatorEmail, await hashPassword(password), "운영자"]
  );
  const operator = await json(base, "/api/auth/login", { method: "POST", body: { email: operatorEmail, password } });
  assert.equal(operator.body.account.role, "operator");
  const quote = await json(base, "/api/quotes", { method: "POST", token: login.token, body: { type: "corporate", months: 6, mail: true, meeting: false, total: 1 } });
  assert.equal(quote.status, 201);
  assert.equal(quote.body.canCheckout, false);
  assert.equal(quote.body.total, 316140);
  assert.notEqual(quote.body.total, 1);
  assert.equal((await json(base, "/api/quotes/" + quote.body.id, { token: otherSession.token })).status, 404);
  assert.equal((await json(base, "/api/quotes/" + quote.body.id, { token: operator.token })).status, 200);
  const reloaded = await json(base, "/api/quotes/" + quote.body.id, { token: login.token });
  assert.equal(reloaded.body.mail, true);
  assert.equal(reloaded.body.months, 6);
  assert.throws(() => assertUntampered(reloaded.body, { total: 1 }), (error) => error.code === "QUOTE_TAMPERED");
  const order = await json(base, "/api/account/orders", { method: "POST", token: login.token, body: { quoteId: quote.body.id, total: quote.body.total } });
  assert.equal(order.status, 201);
  assert.equal(order.body.state, "DRAFT");
  assert.equal(order.body.canCheckout, false);
  assert.equal((await json(base, "/api/account/orders", { method: "POST", token: login.token, body: { quoteId: quote.body.id } })).status, 409);
  assert.equal((await json(base, "/api/account/orders", { method: "POST", token: login.token, body: { quoteId: quote.body.id, total: 1 } })).status, 409);
  assert.equal((await json(base, "/api/checkout", { method: "POST", token: login.token, body: { quoteId: quote.body.id } })).status, 503);
  const fresh = await json(base, "/api/quotes", { method: "POST", token: login.token, body: { type: "individual", months: 12, mail: false, meeting: false } });
  await db.query("UPDATE quotes SET expires_at = now() - interval '1 day' WHERE id = $1", [fresh.body.id]);
  assert.equal((await json(base, "/api/quotes/" + fresh.body.id, { token: login.token })).status, 410);
  for (let attempt = 0; attempt < 7; attempt += 1) {
    assert.equal((await json(base, "/api/auth/login", { method: "POST", body: { email, password: "wrong-password" } })).status, 401);
  }
  assert.equal((await json(base, "/api/auth/login", { method: "POST", body: { email, password } })).status, 429);
  await db.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE token_hash IS NOT NULL");
  assert.equal((await json(base, "/api/auth/session", { token: login.token })).status, 401);
  const marker = `rollback-${Date.now()}@example.test`;
  await assert.rejects(db.transaction(async (tx) => {
    await tx.query("INSERT INTO customers (id, auth_subject, email, role) VALUES ($1,$2,$3,'customer')", [crypto.randomUUID(), `local:${marker}`, marker]);
    throw new Error("stop");
  }));
  assert.equal((await db.query("SELECT id FROM customers WHERE email = $1", [marker])).length, 0);
  await assert.rejects(db.query(
    "INSERT INTO payments (id, order_id, provider, environment, provider_transaction_id, amount, state) VALUES ($1,$2,'MOCK','LIVE','live-1',1000,'VERIFIED')",
    [crypto.randomUUID(), order.body.id]
  ));
  const before = (await db.query("SELECT email FROM customers WHERE email = $1", [email])).length;
  const snapshot = await exportSnapshot(db);
  await db.query("DELETE FROM audit_events WHERE actor_subject = $1", [email]);
  await restoreSnapshot(db, snapshot);
  assert.equal((await db.query("SELECT email FROM customers WHERE email = $1", [email])).length, before);
  assert.equal((await db.query("SELECT id FROM orders WHERE id = $1", [order.body.id])).length, 1);
  db = await handle.reopen();
  assert.equal((await db.query("SELECT email FROM customers WHERE email = $1", [email])).length, 1);
  assert.equal((await db.query("SELECT public_number FROM quotes WHERE id = $1", [quote.body.id])).length, 1);
  if (handle.engine === "postgres") {
    try { await exec("pg_dump", ["--version"]); }
    catch { return; }
    const dumpDir = await mkdtemp(join(tmpdir(), "hanoffice-dump-"));
    t.after(() => rm(dumpDir, { recursive: true, force: true }));
    const dumpFile = join(dumpDir, "hanoffice.sql");
    await exec("pg_dump", ["--no-owner", "--no-acl", "--dbname", process.env.DATABASE_URL, "--file", dumpFile]);
    const sql = await readFile(dumpFile, "utf8");
    assert.match(sql, new RegExp(quote.body.number));
    await db.query("DROP DATABASE IF EXISTS hanoffice_restore");
    await db.query("CREATE DATABASE hanoffice_restore");
    const restoreUrl = new URL(process.env.DATABASE_URL);
    restoreUrl.pathname = "/hanoffice_restore";
    await exec("psql", ["--dbname", restoreUrl.toString(), "--file", dumpFile]);
    const pg = (await import("pg")).default;
    const restored = new pg.Pool({ connectionString: restoreUrl.toString(), max: 1 });
    t.after(() => restored.end());
    const found = await restored.query("SELECT public_number FROM quotes WHERE id = $1", [quote.body.id]);
    assert.equal(found.rows[0].public_number, quote.body.number);
  }
});
