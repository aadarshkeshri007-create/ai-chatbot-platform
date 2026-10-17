export type TranscriptRole = "customer" | "assistant" | "human";

export type HandoffTranscriptRecord = {
  id: string;
  role: TranscriptRole;
  content: string;
  created_at: string;
  source: "transcript" | "handoff_message";
};

type SnapshotMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type PersistedMessage = {
  id: string;
  role: "customer" | "human";
  content: string;
  created_at: string;
};

export function mergeHandoffTranscript(
  snapshot: SnapshotMessage[],
  persisted: PersistedMessage[],
): HandoffTranscriptRecord[] {
  const records: HandoffTranscriptRecord[] = snapshot.map((message, index) => ({
    id: message.id ?? `transcript-${index}`,
    role: message.role === "assistant" ? "assistant" : "customer",
    content: message.content,
    created_at: message.created_at ?? "",
    source: "transcript",
  }));
  const usedPersistedIds = new Set<string>();

  for (const message of persisted) {
    if (usedPersistedIds.has(message.id)) continue;
    usedPersistedIds.add(message.id);

    const duplicate = records.find((record) =>
      record.source === "transcript" &&
      record.role === message.role &&
      record.content === message.content &&
      !record.id.startsWith("persisted:"),
    );
    if (duplicate) {
      duplicate.id = message.id;
      duplicate.created_at = message.created_at;
      duplicate.source = "handoff_message";
      continue;
    }

    records.push({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
      source: "handoff_message",
    });
  }

  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      if (!left.record.created_at || !right.record.created_at) return left.index - right.index;
      return left.record.created_at.localeCompare(right.record.created_at) || left.index - right.index;
    })
    .map(({ record }) => record);
}
