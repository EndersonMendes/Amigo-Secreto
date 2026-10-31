import "server-only";
import { createHmac, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const DUMMY_HASH =
  "scrypt$32768$8$1$" + "0".repeat(32) + "$" + "0".repeat(64);
const normalized = (code: string) => code.replace(/[\s-]/gu, "").toUpperCase();
const derive = (code: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(code, salt, 32, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export function generateCode(): string {
  return randomBytes(16)
    .toString("hex")
    .toUpperCase()
    .match(/.{8}/g)!
    .join("-");
}
export async function hashCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(normalized(code), salt);
  return `scrypt$32768$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyCode(
  code: string,
  stored: string,
  secret?: string,
): Promise<boolean> {
  if (stored.startsWith("scrypt-v2$")) {
    const match = /^scrypt-v2\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored);
    if (!secret || !match || !/^[0-9]{4,128}$/.test(code)) return false;
    const key = await derive(pepper(code, secret), Buffer.from(match[1], "hex"));
    return timingSafeEqual(key, Buffer.from(match[2], "hex"));
  }
  const valid = /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(
    stored,
  );
  const match =
    valid ??
    /^scrypt\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(DUMMY_HASH)!;
  const clean = normalized(code).slice(0, 100);
  const key = await derive(clean, Buffer.from(match[1], "hex"));
  return (
    timingSafeEqual(key, Buffer.from(match[2], "hex")) &&
    !!valid &&
    /^[A-F0-9]{32}$/.test(clean)
  );
}

const hmac = (domain: string, code: string, secret: string) => createHmac("sha256", Buffer.from(secret, "hex")).update(`${domain}\0${code}`).digest("hex");
const pepper = (code: string, secret: string) => hmac("amigo-code-verifier-v2", code, secret);
export const codeFingerprint = (code: string, secret: string) => hmac("amigo-code-lookup-v2", code, secret);
export async function hashNumericCode(code: string, secret: string): Promise<string> {
  if (!/^[0-9]{4,128}$/.test(code)) throw new Error("Invalid numeric code");
  const salt = randomBytes(16);
  const key = await derive(pepper(code, secret), salt);
  return `scrypt-v2$32768$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
export const generateRecoveryToken = () => randomBytes(32).toString("hex");
export const recoveryHash = (token: string) => createHash("sha256").update(`amigo-recovery-v1\0${token}`).digest("hex");
