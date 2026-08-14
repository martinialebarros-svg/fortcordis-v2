export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D+/g, "");
}

/**
 * Meta may identify the same Brazilian WhatsApp account with or without the
 * mobile ninth digit after country code and DDD. Use the legacy eight-digit
 * representation only as an internal identity key; keep the original number
 * when calling the Graph API.
 */
export function canonicalWhatsAppIdentity(value: unknown): string {
  const digits = digitsOnly(value);

  if (/^55\d{2}9\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}${digits.slice(5)}`;
  }

  return digits;
}

export function areEquivalentWhatsAppNumbers(left: unknown, right: unknown): boolean {
  const leftDigits = digitsOnly(left);
  const rightDigits = digitsOnly(right);

  if (!leftDigits || !rightDigits) {
    return false;
  }

  return canonicalWhatsAppIdentity(leftDigits) === canonicalWhatsAppIdentity(rightDigits);
}
