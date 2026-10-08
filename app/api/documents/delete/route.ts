import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      console.error("Document lookup error:", documentError);

      return NextResponse.json(
        {
          error: "Document not found.",
          details: documentError?.message,
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
      console.error("Error deleting document chunks:", chunksError);

      return NextResponse.json(
        {
          error: "Failed to delete document chunks.",
          details: chunksError.message,
          code: chunksError.code,
          hint: chunksError.hint,
          detailsFromSupabase: chunksError.details,
        },
        { status: 500 },
      );
    }

    // 3. Delete Storage file
    const { error: storageError } = await supabase.storage
      .from("knowledge-base")
      .remove([document.file_path]);

    if (storageError) {
      console.error("Error deleting storage file:", storageError);

      return NextResponse.json(
        {
          error: "Failed to delete document file.",
          details: storageError.message,
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
      console.error("Error deleting document:", deleteError);

      return NextResponse.json(
        {
          error: "Failed to delete document.",
          details: deleteError.message,
          code: deleteError.code,
          hint: deleteError.hint,
          detailsFromSupabase: deleteError.details,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (error) {
    console.error("Delete document error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while deleting the document.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
