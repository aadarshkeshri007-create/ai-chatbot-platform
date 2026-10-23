import type { Message } from "@/types/message";
import { getChatSourceKey } from "./chat-source-key.ts";

export function getMessageCitationChips(message: Pick<Message, "sources">) {
  const chips = (message.sources ?? []).map((source) => {
    const documentId = source.document_id ?? source.label;
    return {
      key: getChatSourceKey({
        documentId,
        fileName: source.label,
        chunkId: source.chunk_id,
        chunkIndex: source.chunk_index,
      }),
      label: `${source.label}${Number.isInteger(source.chunk_index) ? ` · Section ${source.chunk_index! + 1}` : ""}`,
    };
  });
  return Array.from(new Map(chips.map((chip) => [chip.key, chip])).values());
}
