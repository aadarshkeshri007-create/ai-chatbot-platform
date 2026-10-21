import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFaqDraftEditable, isFaqDraftProcessable } from "@/lib/testing-playground";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await context.params;
  if (!UUID.test(draftId)) return NextResponse.json({ error: "FAQ draft not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
  if (!profile?.assistant_id) return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { action, question, answer, reason } = body;
  if ((action !== "save" && action !== "approve") || typeof question !== "string" || typeof answer !== "string" || typeof reason !== "string" || question.trim().length < 1 || question.trim().length > 8000 || answer.length > 8000 || reason.length > 2000) {
    return NextResponse.json({ error: "Check the FAQ question, answer, and review note." }, { status: 400 });
  }
  const { data: draft } = await supabase.from("assistant_faq_drafts").select("*")
    .eq("id", draftId).eq("owner_user_id", user.id).eq("assistant_id", profile.assistant_id).maybeSingle();
  if (!draft) return NextResponse.json({ error: "FAQ draft not found." }, { status: 404 });
  if (draft.status === "approved" && !draft.document_id) {
    // Resume a prior approval that was interrupted before document registration.
  } else if (!isFaqDraftEditable(draft.status)) {
    if (action === "approve" && draft.document_id && draft.status === "approved") return NextResponse.json({ documentId: draft.document_id, status: draft.status });
    return NextResponse.json({ error: "This FAQ draft can no longer be edited." }, { status: 409 });
  }
  if (action === "save") {
    const { data: saved, error } = await supabase.from("assistant_faq_drafts").update({ draft_question: question.trim(), draft_answer: answer, reason: reason.trim(), updated_at: new Date().toISOString() })
      .eq("id", draft.id).eq("owner_user_id", user.id).select("id, status").single();
    if (error || !saved) return NextResponse.json({ error: "Unable to save the FAQ draft." }, { status: 500 });
    return NextResponse.json({ draft: saved });
  }
  if (!(draft.status === "approved" && !draft.document_id) && !isFaqDraftProcessable(draft.status, answer)) {
    return NextResponse.json({ error: "Add a reviewed answer of at least 10 characters before approval." }, { status: 400 });
  }

  // Persist explicit owner approval first. A retry can reuse the deterministic document path below.
  const admin = createAdminClient();
  const { error: approvalError } = await admin.from("assistant_faq_drafts").update({
    draft_question: question.trim(), draft_answer: answer.trim(), reason: reason.trim(), status: "approved", processing_error: null, updated_at: new Date().toISOString(),
  }).eq("id", draft.id).eq("owner_user_id", user.id).in("status", ["pending_review", "failed"]);
  if (approvalError) return NextResponse.json({ error: "Unable to record FAQ approval." }, { status: 500 });

  const fileName = `Reviewed FAQ - ${question.trim().slice(0, 72).replace(/[\\/:*?"<>|]/g, " ").trim() || "Support"}.txt`;
  const faqText = `Question: ${question.trim()}\n\nAnswer: ${answer.trim()}\n`;
  // Bind the stored source path to this exact approved content. If an owner
  // edits a failed draft and retries, the old failed file cannot be reprocessed.
  const contentVersion = createHash("sha256").update(faqText, "utf8").digest("hex").slice(0, 20);
  const filePath = `${user.id}/faq-drafts/${draft.id}-${contentVersion}.txt`;
  let { data: document } = await supabase.from("documents").select("id, file_name, file_path, file_type, file_size, status")
    .eq("user_id", user.id).eq("file_path", filePath).maybeSingle();
  if (!document) {
    const { error: storageError } = await supabase.storage.from("knowledge-base").upload(filePath, new Blob([faqText], { type: "text/plain;charset=utf-8" }), { upsert: false, contentType: "text/plain" });
    if (storageError) {
      // A concurrent or earlier attempt may have stored the same deterministic object.
      const { data: retryDocument } = await supabase.from("documents").select("id, file_name, file_path, file_type, file_size, status").eq("user_id", user.id).eq("file_path", filePath).maybeSingle();
      if (!retryDocument) return NextResponse.json({ error: "FAQ was approved, but its knowledge document could not be created. Retry approval." }, { status: 503 });
      document = retryDocument;
    } else {
      const { data: inserted, error: documentError } = await supabase.from("documents").insert({
        user_id: user.id, file_name: fileName, file_path: filePath, file_type: "text/plain", file_size: new TextEncoder().encode(faqText).length, status: "uploaded",
      }).select("id, file_name, file_path, file_type, file_size, status").single();
      if (documentError || !inserted) {
        await supabase.storage.from("knowledge-base").remove([filePath]);
        return NextResponse.json({ error: "FAQ was approved, but its knowledge document could not be registered. Retry approval." }, { status: 503 });
      }
      document = inserted;
    }
  }
  const { error: linkError } = await admin.from("assistant_faq_drafts").update({ document_id: document.id, status: "approved", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("owner_user_id", user.id);
  if (linkError) return NextResponse.json({ error: "The FAQ was approved, but its processing record could not be linked." }, { status: 503 });
  return NextResponse.json({ documentId: document.id, status: "approved", message: "Approved. The FAQ still needs processing before it is searchable." });
}
