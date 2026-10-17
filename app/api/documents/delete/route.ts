import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function logDeletionFailure(category: string) {
  console.error(`[documents.delete] ${category}`);
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const documentId = body.documentId;

    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 },
      );
    }

    // 1. Fetch document and verify ownership
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, file_path")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      logDeletionFailure("document-lookup-failed");

      return NextResponse.json(
        {
          error: "Document not found.",
        },
        { status: 404 },
      );
    }

    // 2. Delete document chunks
    const { error: chunksError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", user.id);

    if (chunksError) {
      logDeletionFailure("chunks-delete-failed");

      return NextResponse.json(
        {
          error: "Failed to delete document chunks.",
        },
        { status: 500 },
      );
    }

    // 3. Delete Storage file
    const { error: storageError } = await supabase.storage
      .from("knowledge-base")
      .remove([document.file_path]);

    if (storageError) {
      logDeletionFailure("storage-delete-failed");

      return NextResponse.json(
        {
          error: "Failed to delete document file.",
        },
        { status: 500 },
      );
    }

    // 4. Delete document record
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id);

    if (deleteError) {
      logDeletionFailure("document-delete-failed");

      return NextResponse.json(
        {
          error: "Failed to delete document.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch {
    logDeletionFailure("unexpected-failure");

    return NextResponse.json(
      {
        error: "Something went wrong while deleting the document.",
      },
      { status: 500 },
    );
  }
}
