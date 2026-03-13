export type SupportedPhoneCountryCode =
  | 'SA'
  | 'AE'
  | 'KW'
  | 'QA'
  | 'BH'
  | 'OM'
  | 'EG'
  | 'JO';

type PhoneCountryConfig = {
  code: SupportedPhoneCountryCode;
  nameAr: string;
  dialCode: string;
  nationalLengths: readonly number[];
  stripLeadingZero?: boolean;
  nationalPattern?: RegExp;
  example: string;
};

export const DEFAULT_PHONE_COUNTRY_CODE: SupportedPhoneCountryCode = 'SA';

export const PHONE_COUNTRIES: readonly PhoneCountryConfig[] = [
  {
    code: 'SA',
    nameAr: 'السعودية',
    dialCode: '966',
    nationalLengths: [9],
    stripLeadingZero: true,
    nationalPattern: /^5\d{8}$/,
    example: '5XXXXXXXX',
  },
  {
    code: 'AE',
    nameAr: 'الإمارات',
    dialCode: '971',
    nationalLengths: [9],
    stripLeadingZero: true,
    nationalPattern: /^5\d{8}$/,
    example: '5XXXXXXXX',
  },
  {
    code: 'KW',
    nameAr: 'الكويت',
    dialCode: '965',
    nationalLengths: [8],
    nationalPattern: /^[569]\d{7}$/,
    example: '5XXXXXXX',
  },
  {
    code: 'QA',
    nameAr: 'قطر',
    dialCode: '974',
    nationalLengths: [8],
    nationalPattern: /^[3567]\d{7}$/,
    example: '3XXXXXXX',
  },
  {
    code: 'BH',
    nameAr: 'البحرين',
    dialCode: '973',
    nationalLengths: [8],
    nationalPattern: /^3\d{7}$/,
    example: '3XXXXXXX',
  },
  {
    code: 'OM',
    nameAr: 'عُمان',
    dialCode: '968',
    nationalLengths: [8],
    nationalPattern: /^[79]\d{7}$/,
    example: '9XXXXXXX',
  },
  {
    code: 'EG',
    nameAr: 'مصر',
    dialCode: '20',
    nationalLengths: [10],
    stripLeadingZero: true,
    nationalPattern: /^1\d{9}$/,
    example: '10XXXXXXXX',
  },
  {
    code: 'JO',
    nameAr: 'الأردن',
    dialCode: '962',
    nationalLengths: [9],
    stripLeadingZero: true,
    nationalPattern: /^7\d{8}$/,
    example: '7XXXXXXXX',
  },
] as const;

const PHONE_COUNTRY_MAP = new Map(PHONE_COUNTRIES.map((country) => [country.code, country]));

type ValidatePhoneInput = {
  countryCode?: string | null;
  nationalNumber?: string | null;
  fieldLabel?: string;
};

type ValidatePhoneSuccess = {
  ok: true;
  country: PhoneCountryConfig;
  nationalNumber: string;
  e164: string;
  display: string;
};

type ValidatePhoneFailure = {
  ok: false;
  country: PhoneCountryConfig;
  message: string;
};

export type ValidatePhoneResult = ValidatePhoneSuccess | ValidatePhoneFailure;

export function getPhoneCountryConfig(countryCode?: string | null) {
  const normalizedCode = String(countryCode ?? '').trim().toUpperCase() as SupportedPhoneCountryCode;
  return PHONE_COUNTRY_MAP.get(normalizedCode) ?? PHONE_COUNTRY_MAP.get(DEFAULT_PHONE_COUNTRY_CODE)!;
}

export function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

export function sanitizePhoneDigits(value: string) {
  return normalizeDigits(value).replace(/\D+/g, '');
}

export function getPhoneInputMaxLength(countryCode?: string | null) {
  const country = getPhoneCountryConfig(countryCode);
  const baseLength = Math.max(...country.nationalLengths);
  return country.stripLeadingZero ? baseLength + 1 : baseLength;
}

export function validateInternationalPhone(input: ValidatePhoneInput): ValidatePhoneResult {
  const country = getPhoneCountryConfig(input.countryCode);
  const fieldLabel = input.fieldLabel ?? 'رقم الجوال';

  const initialDigits = sanitizePhoneDigits(String(input.nationalNumber ?? ''));
  if (!initialDigits) {
    return {
      ok: false,
      country,
      message: `يرجى إدخال ${fieldLabel}.`,
    };
  }

  const nationalNumber = normalizeNationalNumberForCountry(initialDigits, country);
  if (!nationalNumber) {
    return {
      ok: false,
      country,
      message: `${fieldLabel} غير صالح.`,
    };
  }

  if (!country.nationalLengths.includes(nationalNumber.length)) {
    return {
      ok: false,
      country,
      message: `${fieldLabel} في ${country.nameAr} يجب أن يكون ${toArabicLengths(country.nationalLengths)} رقمًا بعد رمز الدولة +${country.dialCode}.`,
    };
  }

  if (country.nationalPattern && !country.nationalPattern.test(nationalNumber)) {
    return {
      ok: false,
      country,
      message: `${fieldLabel} غير مطابق لصيغة الأرقام المعتمدة في ${country.nameAr}.`,
    };
  }

  return {
    ok: true,
    country,
    nationalNumber,
    e164: `+${country.dialCode}${nationalNumber}`,
    display: `+${country.dialCode} ${nationalNumber}`,
  };
}

function normalizeNationalNumberForCountry(rawDigits: string, country: PhoneCountryConfig) {
  let normalized = rawDigits;

  const doubleZeroDialCode = `00${country.dialCode}`;
  if (normalized.startsWith(doubleZeroDialCode)) {
    normalized = normalized.slice(doubleZeroDialCode.length);
  } else if (normalized.startsWith(country.dialCode)) {
    normalized = normalized.slice(country.dialCode.length);
  }

  if (country.stripLeadingZero) {
    normalized = normalized.replace(/^0+/, '');
  }

  return normalized;
}

function toArabicLengths(lengths: readonly number[]) {
  if (lengths.length === 1) {
    return String(lengths[0]);
  }
  return lengths.map(String).join(' أو ');
}
