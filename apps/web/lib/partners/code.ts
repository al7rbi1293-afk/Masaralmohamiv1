const CODE_PREFIX = 'MASAR';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomFromAlphabet(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let output = '';
  for (let i = 0; i < bytes.length; i += 1) {
    output += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return output;
}

export function generatePartnerCode() {
  return `${CODE_PREFIX}-${randomFromAlphabet(6)}`;
}

export function partnerSlugFromCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
