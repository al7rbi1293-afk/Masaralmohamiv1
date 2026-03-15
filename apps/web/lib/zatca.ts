/**
 * ZATCA (Fatoora) QR Code Generation Utility
 * Implements Phase 1 (Generation) requirements for E-Invoicing in KSA.
 * 
 * Requirements:
 * 1. Seller's Name
 * 2. Seller's VAT Number
 * 3. Timestamp (ISO 8601 with time)
 * 4. Invoice Total (with VAT)
 * 5. VAT Total
 */

export type ZatcaQrParams = {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalAmount: string | number;
  vatAmount: string | number;
};

/**
 * Encodes a Tag-Length-Value (TLV) structure.
 */
function encodeTlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, 'utf8');
  const tagBuffer = Buffer.from([tag]);
  const lengthBuffer = Buffer.from([valueBuffer.length]);
  return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

/**
 * Generates the Base64 encoded TLV string for ZATCA QR code.
 */
export function generateZatcaQrCode(params: ZatcaQrParams): string {
  const sellerNameTlv = encodeTlv(1, params.sellerName);
  const vatNumberTlv = encodeTlv(2, params.vatNumber);
  const timestampTlv = encodeTlv(3, params.timestamp);
  const totalAmountTlv = encodeTlv(4, String(params.totalAmount));
  const vatAmountTlv = encodeTlv(5, String(params.vatAmount));

  const combinedTlv = Buffer.concat([
    sellerNameTlv,
    vatNumberTlv,
    timestampTlv,
    totalAmountTlv,
    vatAmountTlv,
  ]);

  return combinedTlv.toString('base64');
}
