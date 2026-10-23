import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HANDOFF_INTRO,
  DEFAULT_UNKNOWN_ANSWER_MESSAGE,
  REPEATED_ABSTENTION_THRESHOLD,
  countConsecutiveAbstentions,
  evaluateEscalationTrigger,
  explicitHandoffResponseMessage,
  getAssistantBehavior,
  isExplicitHumanHandoffRequest,
  isKnownAbstentionMessage,
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
  assert.equal(unknownAnswerMessage("contact_support", "unused", true), DEFAULT_UNKNOWN_ANSWER_MESSAGE);
});

test("tone and language instructions never alter retrieval or grounding", () => {
  assert.match(responseToneInstruction("concise"), /citations/);
  assert.match(languageInstruction("es"), /regardless of its language/);
  assert.match(languageInstruction("auto"), /same language/);
});

test("detects explicit natural-language human escalation requests without false positives", () => {
  const positivePhrases = [
    "talk to a human",
    "Can I speak to an agent?",
    "contact support",
    "I want a real person",
    "can someone from your team help me?",
    "connect me to support",
    "human please",
    "live agent",
    "Please transfer me to a customer service representative.",
    "I need human help with my order",
  ];
  for (const phrase of positivePhrases) {
    assert.equal(isExplicitHumanHandoffRequest(phrase), true, `expected positive match for: ${phrase}`);
  }

  const negativePhrases = [
    "What is your human resources policy?",
    "How do I change the user agent header?",
    "Does this product support dark mode?",
    "What browsers do you support?",
    "How long after delivery can I request a refund?",
    "Tell me about your real estate agent plan",
    "Was this caused by human error?",
  ];
  for (const phrase of negativePhrases) {
    assert.equal(isExplicitHumanHandoffRequest(phrase), false, `expected negative match for: ${phrase}`);
  }
});

test("explicit human request triggers handoff offer only when handoff_enabled is true", () => {
  const enabledEval = evaluateEscalationTrigger({
    message: "I want to talk to a human",
    isAbstention: false,
    consecutiveAbstentions: 0,
    handoffEnabled: true,
    unknownAnswerBehavior: "custom_message",
  });
  assert.deepEqual(enabledEval, {
    shouldOfferHandoff: true,
    reason: "explicit_request",
  });
  assert.match(
    explicitHandoffResponseMessage(DEFAULT_HANDOFF_INTRO, true),
    /connect you with our support team/,
  );

  const disabledEval = evaluateEscalationTrigger({
    message: "I want to talk to a human",
    isAbstention: false,
    consecutiveAbstentions: 0,
    handoffEnabled: false,
    unknownAnswerBehavior: "offer_handoff",
  });
  assert.deepEqual(disabledEval, {
    shouldOfferHandoff: false,
    reason: null,
  });
  assert.match(
    explicitHandoffResponseMessage(DEFAULT_HANDOFF_INTRO, false),
    /Human support requests aren’t available right now/,
  );
});

test("unknown_answer_behavior modes and repeated unsuccessful attempts follow deterministic policy", () => {
  // 1. contact_support offers handoff on first abstention when handoffEnabled is true
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "What is your mars colony address?",
      isAbstention: true,
      consecutiveAbstentions: 1,
      handoffEnabled: true,
      unknownAnswerBehavior: "contact_support",
    }),
    { shouldOfferHandoff: true, reason: "insufficient_evidence" },
  );

  // 2. offer_handoff offers handoff only when handoffEnabled is true
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "Unknown question",
      isAbstention: true,
      consecutiveAbstentions: 1,
      handoffEnabled: true,
      unknownAnswerBehavior: "offer_handoff",
    }),
    { shouldOfferHandoff: true, reason: "insufficient_evidence" },
  );
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "Unknown question",
      isAbstention: true,
      consecutiveAbstentions: 1,
      handoffEnabled: false,
      unknownAnswerBehavior: "offer_handoff",
    }),
    { shouldOfferHandoff: false, reason: null },
  );

  // 3. custom_message does not force handoff on a single abstention, but offers handoff on repeated abstentions
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "Unknown question 1",
      isAbstention: true,
      consecutiveAbstentions: 1,
      handoffEnabled: true,
      unknownAnswerBehavior: "custom_message",
    }),
    { shouldOfferHandoff: false, reason: null },
  );
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "Unknown question 2",
      isAbstention: true,
      consecutiveAbstentions: REPEATED_ABSTENTION_THRESHOLD,
      handoffEnabled: true,
      unknownAnswerBehavior: "custom_message",
    }),
    { shouldOfferHandoff: true, reason: "repeated_failures" },
  );

  // 4. Normal supported answers never trigger escalation
  assert.deepEqual(
    evaluateEscalationTrigger({
      message: "How long after delivery can I request a refund?",
      isAbstention: false,
      consecutiveAbstentions: 0,
      handoffEnabled: true,
      unknownAnswerBehavior: "offer_handoff",
    }),
    { shouldOfferHandoff: false, reason: null },
  );
});

test("countConsecutiveAbstentions tracks consecutive grounded abstentions and resets on supported answers", () => {
  const customFallback = "We could not find that in our docs.";
  const history = [
    { role: "user", content: "q1" },
    { role: "assistant", content: customFallback },
    { role: "user", content: "q2" },
    { role: "assistant", content: "Customers can request a refund within 30 days." },
    { role: "user", content: "q3" },
    { role: "assistant", content: customFallback },
    { role: "user", content: "q4" },
    { role: "assistant", content: DEFAULT_UNKNOWN_ANSWER_MESSAGE },
  ];
  assert.equal(countConsecutiveAbstentions(history, customFallback), 2);
  assert.equal(
    countConsecutiveAbstentions([
      ...history,
      { role: "user", content: "q5" },
      { role: "assistant", content: "Supported answer with citations." },
    ], customFallback),
    0,
  );
  // Straight vs curly apostrophe normalization in abstention matching
  assert.equal(
    isKnownAbstentionMessage(
      "I'm sorry, but the knowledge base doesn't contain enough information to answer that. Please contact the support team for help.",
    ),
    true,
  );
});
