// Staff authenticator setup for the shared STAFF_TOTP_SECRET in server/.env.
//   npm run totp:setup               prints the setup key to add in Google Authenticator or Authy
//   npm run totp:setup -- --rotate   writes a new random secret and prints nothing secret
//   --env <path>                     uses another env file
// Every staff account shares this one code until per-person enrolment lands (milestone B4).
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const LINE = /^STAFF_TOTP_SECRET=(.*)$/m;
const ISSUER = "Tian dev";

const args = process.argv.slice(2);
const envAt = args.indexOf("--env");
const envPath = envAt >= 0 ? resolve(args[envAt + 1] ?? "") : resolve(dirname(fileURLToPath(import.meta.url)), "../.env");

function base32(bytes) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

let text;
try {
  text = readFileSync(envPath, "utf8");
} catch {
  console.error(`Cannot read ${envPath}. Copy server/.env.example to server/.env first.`);
  process.exit(1);
}

if (args.includes("--rotate")) {
  const secret = base32(randomBytes(20)); // 160 bits, the RFC 4226 recommended length
  const next = LINE.test(text) ? text.replace(LINE, `STAFF_TOTP_SECRET=${secret}`) : `${text.replace(/\s*$/, "\n")}STAFF_TOTP_SECRET=${secret}\n`;
  writeFileSync(envPath, next);
  console.log(`Wrote a new STAFF_TOTP_SECRET to ${envPath}.`);
  console.log("Copy that line to the API server's server/.env, restart the API, then run npm run totp:setup to add it to your authenticator.");
  process.exit(0);
}

const secret = (text.match(LINE)?.[1] ?? "").trim().replace(/^["']|["']$/g, "").toUpperCase();
if (!secret) {
  console.error(`STAFF_TOTP_SECRET is empty in ${envPath}. Run npm run totp:setup -- --rotate first.`);
  process.exit(1);
}
const uri = `otpauth://totp/${encodeURIComponent(`${ISSUER}:staff`)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
console.log("In Google Authenticator or Authy choose 'Enter a setup key', then:");
console.log(`  Account:   ${ISSUER} staff`);
console.log(`  Key:       ${secret.match(/.{1,4}/g).join(" ")}`);
console.log("  Type:      time based, 6 digits, every 30 seconds");
console.log(`  URI:       ${uri}`);
console.log("Keep this key private: anyone with it can make admin sign-in codes.");
