import { convert } from 'html-to-text';

// Convert HTML to plain text
export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'table', options: { uppercaseHeaderCells: false } },
    ],
  });
}

// Clean and normalize text
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .replace(/[ \t]+/g, ' ') // Reduce multiple spaces
    .trim();
}

// Extract text from email body (handles both HTML and plain text)
export function extractEmailText(body: string): string {
  // Check if it's HTML
  const isHtml = /<[^>]+>/.test(body);

  if (isHtml) {
    return cleanText(htmlToText(body));
  }

  return cleanText(body);
}
