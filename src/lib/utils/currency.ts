// Parse amount string to paise (integer)
export function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;

  // Remove currency symbols and whitespace
  let cleaned = amountStr
    .replace(/[₹$€£¥Rs\.INR]/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  // Handle "Rs 1,234.56" or "INR 1234.56" format
  cleaned = cleaned.replace(/^(rs|inr)/i, '').trim();

  // Parse the number
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) return null;

  // Convert to paise (multiply by 100)
  return Math.round(amount * 100);
}

// Format paise to display string
export function formatAmount(paise: number, currency = 'INR'): string {
  const amount = paise / 100;

  if (currency === 'INR') {
    // Indian number formatting (lakhs, crores)
    return '₹' + formatIndianNumber(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format number in Indian style (12,34,567.89)
function formatIndianNumber(num: number): string {
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Format integer part
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);

  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return (formatted ? formatted + ',' : '') + lastThree + '.' + decPart;
}

// Extract amount from text using common patterns
export function extractAmount(text: string): { amount: number; raw: string } | null {
  // Common amount patterns
  const patterns = [
    // Rs. 1,234.56 or Rs 1234.56
    /Rs\.?\s*([\d,]+\.?\d*)/i,
    // INR 1,234.56
    /INR\s*([\d,]+\.?\d*)/i,
    // ₹1,234.56
    /₹\s*([\d,]+\.?\d*)/,
    // 1,234.56 (standalone number with optional decimals)
    /([\d,]+\.\d{2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        return { amount, raw: match[0] };
      }
    }
  }

  return null;
}
