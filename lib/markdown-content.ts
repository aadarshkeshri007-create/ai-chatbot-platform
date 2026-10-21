const UNICODE_BULLETS_PATTERN = /^(\s*)[•●▪◦◆◇\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF]\s+/;

/**
 * Normalizes model responses to standard GitHub-flavored Markdown.
 * Specifically converts line-leading Unicode bullets to Markdown list markers (`- `)
 * while preserving code fences (``` and ~~~) and indentation.
 */
export function normalizeAssistantMarkdown(content: string): string {
  if (!content) return "";
  let fenced = false;
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line.replace(UNICODE_BULLETS_PATTERN, "$1- ");
    })
    .join("\n");
}

/**
 * Validates and sanitizes URLs used in Markdown links.
 * Only allows safe protocols: http:, https:, mailto:, tel:, or relative paths (/... or #...).
 * Rejects javascript:, vbscript:, data:, file:, protocol-relative (//...), etc.
 */
export function sanitizeMarkdownUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Reject protocol-relative URLs (e.g. //attacker.com)
  if (trimmed.startsWith("//")) return null;

  // Allow safe relative paths and fragment anchors
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (
      protocol === "http:" ||
      protocol === "https:" ||
      protocol === "mailto:" ||
      protocol === "tel:"
    ) {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a message role should be rendered with Markdown.
 * Assistant and AI messages use Markdown rendering. Visitor and human messages are plain text.
 */
export function shouldRenderAsMarkdown(role: string): boolean {
  const normalized = role.toLowerCase().trim();
  return normalized === "assistant" || normalized === "ai";
}
