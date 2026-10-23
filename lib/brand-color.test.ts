import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastRatio,
  DEFAULT_BRAND_COLOR,
  getBrandLinkColor,
  getBrandTextColor,
  normalizeBrandColor,
} from "./brand-color.ts";

test("brand colors accept only six-digit hex values and normalize case", () => {
  assert.equal(normalizeBrandColor("#12AbEf"), "#12abef");
  for (const invalid of ["red", "#abc", "#12345678", "url(javascript:alert(1))", null]) {
    assert.equal(normalizeBrandColor(invalid), null);
  }
  assert.equal(normalizeBrandColor(undefined) ?? DEFAULT_BRAND_COLOR, DEFAULT_BRAND_COLOR);
});

test("brand text chooses an accessible foreground and links retain AA contrast", () => {
  for (const color of ["#236b5b", "#facc15", "#111111", "#ffffff"]) {
    assert.ok(contrastRatio(color, getBrandTextColor(color)) >= 4.5);
    assert.ok(contrastRatio(getBrandLinkColor(color), "#ffffff") >= 4.5);
  }
});
