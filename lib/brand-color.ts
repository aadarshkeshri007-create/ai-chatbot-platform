export const DEFAULT_BRAND_COLOR = "#236b5b";

export function normalizeBrandColor(value: unknown): string | null {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return value.toLowerCase();
}

function channelToLinear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const normalized = normalizeBrandColor(hex);
    if (!normalized) throw new TypeError("Expected a six-digit hex color.");
    const channels = [1, 3, 5].map((index) =>
      channelToLinear(Number.parseInt(normalized.slice(index, index + 2), 16)),
    );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function getBrandTextColor(value: string): "#ffffff" | "#111827" {
  const color = normalizeBrandColor(value) ?? DEFAULT_BRAND_COLOR;
  return contrastRatio(color, "#ffffff") >= contrastRatio(color, "#111827")
    ? "#ffffff"
    : "#111827";
}

export function getBrandLinkColor(value: string): string {
  const color = normalizeBrandColor(value) ?? DEFAULT_BRAND_COLOR;
  return contrastRatio(color, "#ffffff") >= 4.5 ? color : "#334155";
}
