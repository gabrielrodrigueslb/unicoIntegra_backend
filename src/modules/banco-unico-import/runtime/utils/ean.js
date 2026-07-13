export function normalizeEan(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(/\D+/g, "");
  return normalized || null;
}

function computeCheckDigit(baseDigits) {
  let sum = 0;
  let weight = 3;

  for (let index = baseDigits.length - 1; index >= 0; index -= 1) {
    sum += Number(baseDigits[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return String((10 - (sum % 10)) % 10);
}

export function isValidEan(value) {
  const normalized = normalizeEan(value);
  if (!normalized) {
    return false;
  }

  if (!/^\d+$/.test(normalized)) {
    return false;
  }

  if (![8, 12, 13, 14].includes(normalized.length)) {
    return false;
  }

  const body = normalized.slice(0, -1);
  const checkDigit = normalized.slice(-1);
  return computeCheckDigit(body) === checkDigit;
}
