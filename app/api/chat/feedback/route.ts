import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeedbackSources, isFeedbackCategory, isFeedbackType, isValidFeedbackPair } from "@/lib/testing-playground";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
  if (!profile?.assistant_id) return NextResponse.json({ items: [] });
  const { data: feedback, error } = await supabase.from("assistant_answer_feedback")
    .select("id, assistant_id, conversation_id, user_message_id, assistant_message_id, feedback_type, category, comment, source_refs, created_at")
    .eq("owner_user_id", user.id).eq("assistant_id", profile.assistant_id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Unable to load answer feedback." }, { status: 500 });
  const ids = (feedback ?? []).map((item) => item.id);
  const messageIds = (feedback ?? []).flatMap((item) => [item.user_message_id, item.assistant_message_id]);
  const [draftResult, messageResult] = await Promise.all([
    ids.length ? supabase.from("assistant_faq_drafts").select("id, feedback_id, draft_question, draft_answer, reason, source_refs, status, document_id, processing_error, updated_at").in("feedback_id", ids).eq("owner_user_id", user.id) : Promise.resolve({ data: [], error: null }),
    messageIds.length ? supabase.from("messages").select("id, content").in("id", messageIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (draftResult.error || messageResult.error) return NextResponse.json({ error: "Unable to load feedback details." }, { status: 500 });
  const messages = new Map((messageResult.data ?? []).map((item) => [item.id, item.content]));
  const drafts = new Map((draftResult.data ?? []).map((item) => [item.feedback_id, item]));
  return NextResponse.json({ items: (feedback ?? []).map((item) => ({
    ...item,
    original_question: messages.get(item.user_message_id) ?? "",
    original_answer: messages.get(item.assistant_message_id) ?? "",
    draft: drafts.get(item.id) ?? null,
  })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { conversationId, userMessageId, assistantMessageId, requestId, feedbackType, category, comment } = body;
  if (![conversationId, userMessageId, assistantMessageId, requestId].every((value) => typeof value === "string" && UUID.test(value)) || !isFeedbackType(feedbackType) || (category !== undefined && category !== null && !isFeedbackCategory(category)) || (comment !== undefined && comment !== null && (typeof comment !== "string" || comment.length > 2000))) {
    return NextResponse.json({ error: "Invalid feedback details." }, { status: 400 });
  }
  const { data: profile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
  if (!profile?.assistant_id) return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
  const { data: conversation } = await supabase.from("conversations").select("id, user_id, assistant_id, is_test")
    .eq("id", conversationId).eq("user_id", user.id).eq("assistant_id", profile.assistant_id).eq("is_test", true).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Test conversation not found." }, { status: 404 });
  const { data: messages } = await supabase.from("messages").select("id, conversation_id, role, content, sources, created_at")
    .in("id", [userMessageId, assistantMessageId]).eq("conversation_id", conversation.id);
  const question = messages?.find((item) => item.id === userMessageId && item.role === "user");
  const answer = messages?.find((item) => item.id === assistantMessageId && item.role === "assistant");
  if (!question || !answer || !isValidFeedbackPair(conversation.id, question, answer)) {
    return NextResponse.json({ error: "Feedback must refer to a saved assistant response in this test conversation." }, { status: 404 });
  }
  const { data: orderedMessages, error: sequenceError } = await supabase.from("messages").select("id, role")
    .eq("conversation_id", conversation.id).gte("created_at", question.created_at).lte("created_at", answer.created_at)
    .order("created_at", { ascending: true });
  if (sequenceError || orderedMessages?.length !== 2 || orderedMessages[0]?.id !== question.id || orderedMessages[1]?.id !== answer.id) {
    return NextResponse.json({ error: "Feedback must refer to the question answered immediately before this response." }, { status: 404 });
  }
  const sourceRefs = getFeedbackSources(answer.sources);
  const admin = createAdminClient();
  const { data: saved, error } = await admin.from("assistant_answer_feedback").insert({
    owner_user_id: user.id, assistant_id: profile.assistant_id, conversation_id: conversation.id,
    user_message_id: question.id, assistant_message_id: answer.id, request_id: requestId,
    feedback_type: feedbackType, category: feedbackType === "helpful" ? null : category ?? null,
    comment: comment ?? null, source_refs: sourceRefs,
  }).select("id, feedback_type, category, created_at").single();
  if (error || !saved) {
    const { data: existing } = await admin.from("assistant_answer_feedback").select("id, feedback_type, category, created_at")
      .eq("owner_user_id", user.id).eq("assistant_id", profile.assistant_id).eq("assistant_message_id", answer.id).maybeSingle();
    if (existing) return NextResponse.json({ feedback: existing, duplicate: true }, { status: 200 });
    return NextResponse.json({ error: "Unable to save answer feedback." }, { status: 500 });
  }
  return NextResponse.json({ feedback: saved }, { status: 201 });
}
