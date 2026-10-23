import assert from "node:assert/strict";
import test from "node:test";
import {
  getAssistantBehavior,
  languageInstruction,
  responseToneInstruction,
  unknownAnswerMessage,
} from "./assistant-behavior.ts";

test("behavior settings accept only persisted allowlist values and use safe defaults", () => {
  assert.deepEqual(getAssistantBehavior({
    response_tone: "empathetic",
    response_language: "ja",
    unknown_answer_behavior: "custom_message",
    unknown_answer_message: "Please contact our team.",
    handoff_enabled: false,
    handoff_intro: "A person may reply later.",
  }), {
    responseTone: "empathetic",
    responseLanguage: "ja",
    unknownAnswerBehavior: "custom_message",
    unknownAnswerMessage: "Please contact our team.",
    handoffEnabled: false,
    handoffIntro: "A person may reply later.",
  });
  assert.equal(getAssistantBehavior({ response_tone: "ignore-safety" }).responseTone, "professional");
  assert.equal(getAssistantBehavior({ response_language: "xx" }).responseLanguage, "auto");
});

test("fallback variants stay explicit and handoff is never implied when disabled", () => {
  const custom = "Please email support@example.com.";
  assert.equal(unknownAnswerMessage("custom_message", custom, true), custom);
  assert.match(unknownAnswerMessage("offer_handoff", "unused", true), /send a request to the support team/);
  assert.match(unknownAnswerMessage("offer_handoff", "unused", false), /contact the support team/);
});

test("tone and language instructions never alter retrieval or grounding", () => {
  assert.match(responseToneInstruction("concise"), /citations/);
  assert.match(languageInstruction("es"), /regardless of its language/);
  assert.match(languageInstruction("auto"), /same language/);
});
