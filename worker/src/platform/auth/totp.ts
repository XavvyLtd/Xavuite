/**
 * platform/auth/totp.ts
 * TOTP (RFC 6238) implementation using Web Crypto API.
 * Works in Cloudflare Workers — no external dependencies.
 */

// ── Base32 encoding/decoding ──────────────────────────────────────────────────
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(str: string): Uint8Array {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length * 5 / 8));
  let bits = 0, value = 0, idx = 0;
  for (const char of clean) {
    value = (value << 5) | BASE32_CHARS.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes[idx++] = (value >>> (bits - 8)) & 0xFF;
      bits -= 8;
    }
  }
  return bytes;
}

// ── Generate TOTP secret ──────────────────────────────────────────────────────
export function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

// ── HOTP (HMAC-based OTP) ─────────────────────────────────────────────────────
async function hotp(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xFF;
    counter = Math.floor(counter / 256);
  }

  const sig    = await crypto.subtle.sign('HMAC', key, counterBytes);
  const arr    = new Uint8Array(sig);
  const offset = arr[19] & 0x0F;
  const code   = (
    ((arr[offset]     & 0x7F) << 24) |
    ((arr[offset + 1] & 0xFF) << 16) |
    ((arr[offset + 2] & 0xFF) << 8)  |
     (arr[offset + 3] & 0xFF)
  ) % 1_000_000;

  return String(code).padStart(6, '0');
}

// ── TOTP verify (window ±1 step) ──────────────────────────────────────────────
export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  const step    = 30; // 30-second window
  const counter = Math.floor(Date.now() / 1000 / step);

  for (const delta of [-1, 0, 1]) {
    const expected = await hotp(secret, counter + delta);
    if (expected === token.trim()) return true;
  }
  return false;
}

// ── Generate current TOTP (for testing) ───────────────────────────────────────
export async function generateTOTP(secret: string): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotp(secret, counter);
}

// ── Build otpauth:// URL for QR code ─────────────────────────────────────────
export function buildOTPAuthURL(
  secret: string,
  email: string,
  issuer: string
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits:    '6',
    period:    '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
}

// ── Generate backup codes ─────────────────────────────────────────────────────
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  });
}

// ── Hash a backup code for storage ───────────────────────────────────────────
export async function hashBackupCode(code: string): Promise<string> {
  const data   = new TextEncoder().encode(code.toUpperCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// ── Verify backup code (constant-time comparison) ────────────────────────────
export async function verifyBackupCode(
  code: string,
  hashes: string[]
): Promise<number> {
  const inputHash = await hashBackupCode(code);
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i] === inputHash) return i; // return index so we can remove it
  }
  return -1;
}
