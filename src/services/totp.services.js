import crypto from 'crypto';

function normalizeBase32Secret(value) {
  return String(value || '')
    .trim()
    .replace(/^otpauth:\/\/[^?]+\?/i, '')
    .replace(/\s+/g, '')
    .replace(/=+$/g, '')
    .toUpperCase();
}

function extractSecretFromOtpAuthUri(value) {
  const raw = String(value || '').trim();
  if (!raw.toLowerCase().startsWith('otpauth://')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    return parsed.searchParams.get('secret') || raw;
  } catch {
    return raw;
  }
}

function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = normalizeBase32Secret(extractSecretFromOtpAuthUri(secret));

  if (!normalized) {
    throw new Error('TOTP secret nao configurado.');
  }

  let bits = '';
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error('TOTP secret invalido: esperado Base32.');
    }

    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateTotpToken(secret, options = {}) {
  const digits = Number(options.digits || 6);
  const period = Number(options.period || 30);
  const timestamp = Number(options.timestamp || Date.now());
  const key = decodeBase32(secret);

  const counter = Math.floor(timestamp / 1000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto
    .createHmac('sha1', key)
    .update(counterBuffer)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, '0');
}
