import { env } from '../config/env.js';
import { generateTotpToken } from './totp.services.js';

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function isAutomatedInstanceAuthEnabled() {
  return Boolean(
    env.INSTANCE_SERVICE_USERNAME &&
      env.INSTANCE_SERVICE_PASSWORD &&
      env.INSTANCE_SERVICE_TOTP_SECRET,
  );
}

export function resolveInstanceExecutionCredentials({
  username,
  password,
  code2fa,
} = {}) {
  if (isAutomatedInstanceAuthEnabled()) {
    return {
      username: env.INSTANCE_SERVICE_USERNAME,
      password: env.INSTANCE_SERVICE_PASSWORD,
      code2fa: generateTotpToken(env.INSTANCE_SERVICE_TOTP_SECRET, {
        digits: env.INSTANCE_SERVICE_TOTP_DIGITS,
        period: env.INSTANCE_SERVICE_TOTP_PERIOD_SECONDS,
      }),
      mode: 'service-account',
    };
  }

  const normalizedUsername = normalizeOptionalString(username);
  const normalizedPassword = normalizeOptionalString(password);
  const normalizedCode = normalizeOptionalString(code2fa);

  if (!normalizedUsername || !normalizedPassword || !normalizedCode) {
    throw new Error(
      'Credenciais da instancia indisponiveis. Configure INSTANCE_SERVICE_USERNAME, INSTANCE_SERVICE_PASSWORD e INSTANCE_SERVICE_TOTP_SECRET no backend ou informe username/password/code manualmente.',
    );
  }

  return {
    username: normalizedUsername,
    password: normalizedPassword,
    code2fa: normalizedCode,
    mode: 'manual',
  };
}
