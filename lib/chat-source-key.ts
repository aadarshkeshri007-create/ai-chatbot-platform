export type ChatSourceIdentity = {
  documentId: string;
  fileName: string;
  chunkId?: string;
  chunkIndex?: number;
};

export function getChatSourceKey(source: ChatSourceIdentity): string {
  if (source.chunkId) return `${source.documentId}:chunk:${source.chunkId}`;
  if (Number.isInteger(source.chunkIndex)) return `${source.documentId}:section:${source.chunkIndex}`;
  return `${source.documentId}:file:${source.fileName}`;
}
