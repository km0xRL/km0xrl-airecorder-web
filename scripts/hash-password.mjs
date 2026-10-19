#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const password = process.argv[2];

if (!password) {
  console.error("Использование: node scripts/hash-password.mjs 'ваш-пароль'");
  process.exit(1);
}
if (password.length < 4) {
  console.error("Пароль короче 4 символов.");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 });
const hash = ["scrypt", 16384, 8, 1, salt.toString("base64url"), derived.toString("base64url")].join("$");
console.log(hash);
console.error("\nПоложите это значение в OWNER_PASSWORD_HASH (в кавычках, если в .env).");
