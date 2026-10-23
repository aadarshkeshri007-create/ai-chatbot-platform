export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ label: string; document_id?: string; chunk_id?: string; chunk_index?: number }>;
  retrievalState?: "supported" | "insufficient";
};
