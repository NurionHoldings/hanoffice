import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, length: 32 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.length, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), Buffer.from(hash, "base64url").length, {
    N: Number(n), r: Number(r), p: Number(p)
  });
  const expected = Buffer.from(hash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newSessionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
