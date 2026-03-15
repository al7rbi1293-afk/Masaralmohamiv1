import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { normalizeDigits } from '@/lib/phone';

export const DEFAULT_CLIENT_PORTAL_COUNTRY = 'SA' as const;

export type ClientPortalPhoneCountryOption = {
  code: string;
  nameAr: string;
  dialCode: string;
};

const displayNames = new Intl.DisplayNames(['ar'], { type: 'region' });

const COUNTRY_OPTIONS: ClientPortalPhoneCountryOption[] = getCountries()
  .map((code) => {
    const countryCode = String(code || '').toUpperCase();
    const dialCode = getCountryCallingCode(code);
    const nameAr = displayNames.of(countryCode) || countryCode;

    return {
      code: countryCode,
      nameAr,
      dialCode,
    };
  })
  .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));

// Keep Saudi Arabia pinned at top to preserve current default UX.
const saIndex = COUNTRY_OPTIONS.findIndex((country) => country.code === DEFAULT_CLIENT_PORTAL_COUNTRY);
if (saIndex > 0) {
  const [sa] = COUNTRY_OPTIONS.splice(saIndex, 1);
  COUNTRY_OPTIONS.unshift(sa);
}

const COUNTRY_CODE_SET = new Set(COUNTRY_OPTIONS.map((country) => country.code));

export const CLIENT_PORTAL_PHONE_COUNTRIES = COUNTRY_OPTIONS;

export function resolveClientPortalCountryCode(rawCode?: string | null) {
  const normalized = String(rawCode ?? '').trim().toUpperCase();
  if (!normalized || !COUNTRY_CODE_SET.has(normalized)) {
    return DEFAULT_CLIENT_PORTAL_COUNTRY;
  }
  return normalized;
}

export function getClientPortalCountryOption(code?: string | null) {
  const resolvedCode = resolveClientPortalCountryCode(code);
  return (
    COUNTRY_OPTIONS.find((country) => country.code === resolvedCode) ||
    COUNTRY_OPTIONS[0]
  );
}

export type NormalizeClientPortalPhoneResult =
  | { ok: true; e164: string; countryCode: string }
  | { ok: false; message: string };

export function normalizeClientPortalPhoneInput(params: {
  countryCode?: string | null;
  phoneNational?: string | null;
  rawPhone?: string | null;
  fieldLabel?: string;
}): NormalizeClientPortalPhoneResult {
  const countryCode = resolveClientPortalCountryCode(params.countryCode);
  const fieldLabel = params.fieldLabel ?? 'رقم الجوال';
  const input = String(params.phoneNational ?? params.rawPhone ?? '').trim();

  if (!input) {
    return {
      ok: false,
      message: `يرجى إدخال ${fieldLabel}.`,
    };
  }

  const normalizedInput = normalizeDigits(input)
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');

  const parsed = parsePhoneNumberFromString(
    normalizedInput,
    countryCode as CountryCode,
  );

  if (!parsed || !parsed.isValid()) {
    const country = getClientPortalCountryOption(countryCode);
    return {
      ok: false,
      message: `${fieldLabel} غير صالح في ${country.nameAr}.`,
    };
  }

  return {
    ok: true,
    e164: parsed.number,
    countryCode: String(parsed.country || countryCode),
  };
}

