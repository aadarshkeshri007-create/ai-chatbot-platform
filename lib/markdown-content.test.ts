import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAssistantMarkdown,
  sanitizeMarkdownUrl,
  shouldRenderAsMarkdown,
} from "./markdown-content.ts";
import { contrastRatio } from "./brand-color.ts";

test("assistant Unicode bullets render as Markdown lists, including indentation", () => {
  assert.equal(
    normalizeAssistantMarkdown("• First\n  • Nested\nA • mid-line"),
    "- First\n  - Nested\nA • mid-line",
  );
});

test("assistant Unicode bullet variants normalize to markdown list items", () => {
  const input = [
    "• Standard bullet",
    "● Black circle bullet",
    "▪ Black small square",
    "◦ White bullet",
    "◆ Black diamond",
    "◇ White diamond",
    "\u2022 Unicode 2022",
    "\u2023 Triangular bullet",
    "\u25E6 White bullet 25E6",
    "\u2043 Hyphen bullet",
    "\u2219 Bullet operator",
    "\u25AA Small square 25AA",
    "\u25AB Small square 25AB",
    "\u25CF Geometric circle 25CF",
  ].join("\n");

  const expected = [
    "- Standard bullet",
    "- Black circle bullet",
    "- Black small square",
    "- White bullet",
    "- Black diamond",
    "- White diamond",
    "- Unicode 2022",
    "- Triangular bullet",
    "- White bullet 25E6",
    "- Hyphen bullet",
    "- Bullet operator",
    "- Small square 25AA",
    "- Small square 25AB",
    "- Geometric circle 25CF",
  ].join("\n");

  assert.equal(normalizeAssistantMarkdown(input), expected);
});

test("bullet lists with bold text render properly with markdown bold syntax", () => {
  const input = "• **Refund Window**: Customers may request a refund within **37 days** from the purchase date.\n• **Eligible Items**: Software subscriptions and digital licenses.";
  const expected = "- **Refund Window**: Customers may request a refund within **37 days** from the purchase date.\n- **Eligible Items**: Software subscriptions and digital licenses.";
  assert.equal(normalizeAssistantMarkdown(input), expected);
});

test("assistant bullet normalization preserves CRLF line endings cleanly", () => {
  const input = "• First line\r\n• Second line\r\n• Third line";
  const expected = "- First line\n- Second line\n- Third line";
  assert.equal(normalizeAssistantMarkdown(input), expected);
});

test("assistant bullet normalization leaves fenced code unchanged for backticks and tildes", () => {
  const inputWithBackticks = "```text\n• literal code bullet\n```\n• list item";
  const expectedBackticks = "```text\n• literal code bullet\n```\n- list item";
  assert.equal(normalizeAssistantMarkdown(inputWithBackticks), expectedBackticks);

  const inputWithTildes = "~~~python\n# • literal python comment bullet\n~~~\n• list item after";
  const expectedTildes = "~~~python\n# • literal python comment bullet\n~~~\n- list item after";
  assert.equal(normalizeAssistantMarkdown(inputWithTildes), expectedTildes);
});

test("empty or blank input normalization returns empty string", () => {
  assert.equal(normalizeAssistantMarkdown(""), "");
  assert.equal(normalizeAssistantMarkdown(null as unknown as string), "");
  assert.equal(normalizeAssistantMarkdown(undefined as unknown as string), "");
});

test("sanitizeMarkdownUrl accepts safe web URLs and safe relative paths", () => {
  assert.equal(sanitizeMarkdownUrl("https://example.com"), "https://example.com");
  assert.equal(sanitizeMarkdownUrl("https://example.com/refund-policy?ref=chat#faq"), "https://example.com/refund-policy?ref=chat#faq");
  assert.equal(sanitizeMarkdownUrl("http://example.com/docs"), "http://example.com/docs");
  assert.equal(sanitizeMarkdownUrl("mailto:support@example.com"), "mailto:support@example.com");
  assert.equal(sanitizeMarkdownUrl("tel:+1234567890"), "tel:+1234567890");
  assert.equal(sanitizeMarkdownUrl("/refund-policy"), "/refund-policy");
  assert.equal(sanitizeMarkdownUrl("#refund-policy"), "#refund-policy");
});

test("sanitizeMarkdownUrl rejects unsafe, scriptable, or protocol-relative URLs", () => {
  assert.equal(sanitizeMarkdownUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeMarkdownUrl("JAVASCRIPT:alert(document.domain)"), null);
  assert.equal(sanitizeMarkdownUrl("javascript:void(0)"), null);
  assert.equal(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(sanitizeMarkdownUrl("vbscript:msgbox(1)"), null);
  assert.equal(sanitizeMarkdownUrl("file:///etc/passwd"), null);
  assert.equal(sanitizeMarkdownUrl("//malicious-domain.com/evil"), null);
  assert.equal(sanitizeMarkdownUrl(""), null);
  assert.equal(sanitizeMarkdownUrl("   "), null);
  assert.equal(sanitizeMarkdownUrl(null), null);
  assert.equal(sanitizeMarkdownUrl(undefined), null);
});

test("shouldRenderAsMarkdown correctly differentiates assistant vs plain-text roles", () => {
  // Assistant / AI messages use Markdown rendering
  assert.equal(shouldRenderAsMarkdown("assistant"), true);
  assert.equal(shouldRenderAsMarkdown("ai"), true);
  assert.equal(shouldRenderAsMarkdown("ASSISTANT"), true);
  assert.equal(shouldRenderAsMarkdown(" AI "), true);

  // Visitor and human messages must remain plain text
  assert.equal(shouldRenderAsMarkdown("user"), false);
  assert.equal(shouldRenderAsMarkdown("customer"), false);
  assert.equal(shouldRenderAsMarkdown("human"), false);
  assert.equal(shouldRenderAsMarkdown("system"), false);
  assert.equal(shouldRenderAsMarkdown("admin"), false);
});

test("widget and chat history contrast ratios satisfy WCAG AA >= 4.5:1", () => {
  // Light mode widget contrast
  const lightBubbleBg = "#ffffff";
  const lightAssistantText = "#1e293b";
  const lightHeading = "#0f172a";
  const lightMuted = "#64748b";
  assert.ok(
    contrastRatio(lightAssistantText, lightBubbleBg) >= 4.5,
    `Light assistant text contrast ${contrastRatio(lightAssistantText, lightBubbleBg)} must be >= 4.5:1`,
  );
  assert.ok(
    contrastRatio(lightHeading, lightBubbleBg) >= 4.5,
    `Light heading contrast ${contrastRatio(lightHeading, lightBubbleBg)} must be >= 4.5:1`,
  );
  assert.ok(
    contrastRatio(lightMuted, lightBubbleBg) >= 4.5,
    `Light muted contrast ${contrastRatio(lightMuted, lightBubbleBg)} must be >= 4.5:1`,
  );

  // Dark mode widget contrast
  const darkBubbleBg = "#222826";
  const darkAssistantText = "#f1f3f0";
  const darkHeading = "#ffffff";
  const darkMuted = "#adb8b2";
  const darkLink = "#5eead4";
  assert.ok(
    contrastRatio(darkAssistantText, darkBubbleBg) >= 4.5,
    `Dark assistant text contrast ${contrastRatio(darkAssistantText, darkBubbleBg)} must be >= 4.5:1`,
  );
  assert.ok(
    contrastRatio(darkHeading, darkBubbleBg) >= 4.5,
    `Dark heading contrast ${contrastRatio(darkHeading, darkBubbleBg)} must be >= 4.5:1`,
  );
  assert.ok(
    contrastRatio(darkMuted, darkBubbleBg) >= 4.5,
    `Dark muted text contrast ${contrastRatio(darkMuted, darkBubbleBg)} must be >= 4.5:1`,
  );
  assert.ok(
    contrastRatio(darkLink, darkBubbleBg) >= 4.5,
    `Dark link contrast ${contrastRatio(darkLink, darkBubbleBg)} must be >= 4.5:1`,
  );

  // Chat History detail surfaces
  const historyLightBg = "#f2f4f1"; // --surface-muted
  const historyLightText = "#1e293b"; // slate-800
  assert.ok(
    contrastRatio(historyLightText, historyLightBg) >= 4.5,
    `History light text contrast ${contrastRatio(historyLightText, historyLightBg)} must be >= 4.5:1`,
  );

  const historyDarkBg = "#1d2321"; // --surface-muted dark
  const historyDarkText = "#e2e8f0"; // slate-200
  assert.ok(
    contrastRatio(historyDarkText, historyDarkBg) >= 4.5,
    `History dark text contrast ${contrastRatio(historyDarkText, historyDarkBg)} must be >= 4.5:1`,
  );
});

test("assistant markdown renders actual HTML elements for bold text and bullet lists rather than raw markdown syntax", async () => {
  const React = (await import("react")).default;
  const ReactDOMServer = (await import("react-dom/server")).default;
  const ReactMarkdown = (await import("react-markdown")).default;
  const remarkGfm = (await import("remark-gfm")).default;

  const rawModelResponse =
    "**Refund Window**: Customers may request a refund within **37 days** from the purchase date.\n" +
    "• First condition: Item must be in original condition.\n" +
    "• Second condition: Proof of purchase is required.\n\n" +
    "For more details, visit our [Refund Policy](https://example.com/refund).";

  const normalized = normalizeAssistantMarkdown(rawModelResponse);

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        components: {
          strong: ({ children }: { children?: React.ReactNode }) =>
            React.createElement("strong", { className: "font-semibold" }, children),
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
            const safeHref = sanitizeMarkdownUrl(href);
            return safeHref
              ? React.createElement("a", { href: safeHref }, children)
              : React.createElement("span", null, children);
          },
        },
      },
      normalized,
    ),
  );

  // Assert formatted strong elements exist
  assert.ok(html.includes('<strong class="font-semibold">Refund Window</strong>'), "Bold label must render as <strong> tag");
  assert.ok(html.includes('<strong class="font-semibold">37 days</strong>'), "Bold emphasis must render as <strong> tag");

  // Assert bullet list elements exist
  assert.ok(html.includes("<ul>"), "Must render <ul> list element");
  assert.ok(html.includes("<li>First condition: Item must be in original condition.</li>"), "First bullet must render as <li> element");
  assert.ok(html.includes("<li>Second condition: Proof of purchase is required.</li>"), "Second bullet must render as <li> element");

  // Assert safe link rendered
  assert.ok(html.includes('<a href="https://example.com/refund">Refund Policy</a>'), "Safe link must render as <a> tag with valid href");

  // Assert no raw markdown markers leaked into the rendered text
  assert.ok(!html.includes("**Refund Window**"), "Raw asterisks must not be present in output HTML");
  assert.ok(!html.includes("• First condition"), "Raw Unicode bullet must not be present in output HTML");
});

test("unsafe markdown link does not render clickable anchor tag with dangerous scheme", async () => {
  const React = (await import("react")).default;
  const ReactDOMServer = (await import("react-dom/server")).default;
  const ReactMarkdown = (await import("react-markdown")).default;

  const maliciousResponse = "[Click Here](javascript:alert(document.cookie))";
  const normalized = normalizeAssistantMarkdown(maliciousResponse);

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        components: {
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
            const safeHref = sanitizeMarkdownUrl(href);
            return safeHref
              ? React.createElement("a", { href: safeHref }, children)
              : React.createElement("span", { className: "sanitized-unsafe-link" }, children);
          },
        },
      },
      normalized,
    ),
  );

  assert.ok(!html.includes('href="javascript:'), "Must not render javascript: href");
  assert.ok(html.includes('<span class="sanitized-unsafe-link">Click Here</span>'), "Unsafe link must render as inert span");
});
