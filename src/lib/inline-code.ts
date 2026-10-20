/** Splits text on backtick-delimited `code` spans. */
export function splitCode(text: string): { code: boolean; text: string }[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((part) =>
    part.startsWith('`') && part.endsWith('`') ? { code: true, text: part.slice(1, -1) } : { code: false, text: part },
  );
}
