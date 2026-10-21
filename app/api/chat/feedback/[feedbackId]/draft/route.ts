import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await context.params;
  if (!UUID.test(feedbackId)) return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
  if (!profile?.assistant_id) return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
  const { data: feedback } = await supabase.from("assistant_answer_feedback").select("*")
    .eq("id", feedbackId).eq("owner_user_id", user.id).eq("assistant_id", profile.assistant_id).maybeSingle();
  if (!feedback) return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
  if (feedback.feedback_type === "helpful") return NextResponse.json({ error: "FAQ drafts can be created from feedback that reports an issue." }, { status: 409 });
  const { data: existing } = await supabase.from("assistant_faq_drafts").select("id, status")
    .eq("feedback_id", feedback.id).eq("owner_user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ draft: existing });
  const { data: messages } = await supabase.from("messages").select("id, role, content")
    .in("id", [feedback.user_message_id, feedback.assistant_message_id]).eq("conversation_id", feedback.conversation_id);
  const question = messages?.find((item) => item.id === feedback.user_message_id && item.role === "user");
  const answer = messages?.find((item) => item.id === feedback.assistant_message_id && item.role === "assistant");
  if (!question || !answer) return NextResponse.json({ error: "The source answer is no longer available." }, { status: 409 });
  const reason = [feedback.category, feedback.comment].filter(Boolean).join(": ").slice(0, 2000);
  const admin = createAdminClient();
  const { data: draft, error } = await admin.from("assistant_faq_drafts").insert({
    feedback_id: feedback.id, owner_user_id: user.id, assistant_id: profile.assistant_id,
    conversation_id: feedback.conversation_id, original_question: question.content,
    original_answer: answer.content, draft_question: question.content,
    draft_answer: answer.content.slice(0, 8000), reason, source_refs: feedback.source_refs ?? [],
  }).select("id, status").single();
  if (error || !draft) {
    const { data: retried } = await admin.from("assistant_faq_drafts").select("id, status").eq("feedback_id", feedback.id).eq("owner_user_id", user.id).maybeSingle();
    if (retried) return NextResponse.json({ draft: retried });
    return NextResponse.json({ error: "Unable to create the FAQ draft." }, { status: 500 });
  }
  return NextResponse.json({ draft }, { status: 201 });
}
