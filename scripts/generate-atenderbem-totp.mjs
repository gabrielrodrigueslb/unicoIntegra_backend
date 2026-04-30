import crypto from 'node:crypto';

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--secret' && next) {
      result.secret = next;
      index += 1;
      continue;
    }

    if (current === '--otpauth' && next) {
      result.otpauth = next;
      index += 1;
      continue;
    }

    if (current === '--digits' && next) {
      result.digits = Number(next);
      index += 1;
      continue;
    }

    if (current === '--period' && next) {
      result.period = Number(next);
      index += 1;
      continue;
    }
  }

  return result;
}

function normalizeSecretInput({ secret, otpauth }) {
  if (otpauth && String(otpauth).trim()) {
    const parsedUrl = new URL(String(otpauth).trim());
    const secretFromUrl = parsedUrl.searchParams.get('secret');
    const digitsFromUrl = parsedUrl.searchParams.get('digits');
    const periodFromUrl = parsedUrl.searchParams.get('period');

    if (!secretFromUrl) {
      throw new Error('A URL otpauth:// nao contem o parametro secret.');
    }

    return {
      secret: secretFromUrl,
      digits: digitsFromUrl ? Number(digitsFromUrl) : undefined,
      period: periodFromUrl ? Number(periodFromUrl) : undefined,
    };
  }

  if (secret && String(secret).trim()) {
    return {
      secret: String(secret).trim(),
      digits: undefined,
      period: undefined,
    };
  }

  const envSecret = process.env.INSTANCE_SERVICE_TOTP_SECRET?.trim();
  if (!envSecret) {
    throw new Error(
      'Informe --secret, --otpauth ou defina INSTANCE_SERVICE_TOTP_SECRET.',
    );
  }

  if (envSecret.startsWith('otpauth://')) {
    return normalizeSecretInput({ otpauth: envSecret });
  }

  return {
    secret: envSecret,
    digits: undefined,
    period: undefined,
  };
}

function base32ToBuffer(input) {
  const normalized = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');

  if (!normalized) {
    throw new Error('Secret Base32 invalido ou vazio.');
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value === -1) {
      throw new Error(`Caractere Base32 invalido: ${character}`);
    }

    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotp({ secret, digits = 6, period = 30, timestamp = Date.now() }) {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(timestamp / 1000 / period);
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const token = String(binary % 10 ** digits).padStart(digits, '0');

  return {
    token,
    digits,
    period,
    counter,
  };
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const normalized = normalizeSecretInput(cli);

  const digits =
    Number.isFinite(cli.digits) && cli.digits > 0
      ? cli.digits
      : Number.isFinite(normalized.digits) && normalized.digits > 0
        ? normalized.digits
        : Number(process.env.INSTANCE_SERVICE_TOTP_DIGITS || 6);

  const period =
    Number.isFinite(cli.period) && cli.period > 0
      ? cli.period
      : Number.isFinite(normalized.period) && normalized.period > 0
        ? normalized.period
        : Number(process.env.INSTANCE_SERVICE_TOTP_PERIOD_SECONDS || 30);

  const result = generateTotp({
    secret: normalized.secret,
    digits,
    period,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Erro ao gerar TOTP: ${error.message}\n`);
  process.exitCode = 1;
}

