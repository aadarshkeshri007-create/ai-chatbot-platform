import {
  countConsecutiveAbstentions,
  evaluateEscalationTrigger,
  isExplicitHumanHandoffRequest,
  isKnownAbstentionMessage,
  type EscalationReason,
  type UnknownAnswerBehavior,
} from "./assistant-behavior.ts";
import { safeWidgetSources } from "./widget-conversation.ts";
import { widgetRetentionCutoff } from "./widget-retention.ts";

export const WIDGET_RESTORE_MESSAGE_LIMIT = 100;

export type StoredWidgetMessage = {
  role: string;
  content: string;
  created_at: string;
  sources?: unknown;
  client_message_id?: string | null;
};

/**
 * Persistence boundary for restoring a visitor conversation. Every method is
 * scoped by the validated assistant (tenant) AND the hashed visitor session, so
 * a conversation id alone can never select a row. Implementations throw on
 * infrastructure failure; callers must not treat that as "no conversation".
 */
export type WidgetRestoreStore = {
  /**
   * Detach the visitor session from a conversation whose last activity is
   * before `cutoff`. Returns true when a stale conversation was detached.
   * History is retained; only the resume link is removed.
   */
  detachStaleConversation(assistantId: string, sessionHash: string, cutoff: Date): Promise<boolean>;
  findConversation(assistantId: string, sessionHash: string): Promise<{ id: string } | null>;
  /** Newest first, at most `limit` rows. */
  listRecentMessages(conversationId: string, limit: number): Promise<StoredWidgetMessage[]>;
};

export type RestoredWidgetMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources: ReturnType<typeof safeWidgetSources>;
  request_id?: string;
};

export type WidgetRestoreResult =
  | { status: "empty" }
  | { status: "expired" }
  | { status: "restored"; conversationId: string; messages: RestoredWidgetMessage[] };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Enforce inactivity expiry for a session. Called before restore AND before a
 * new chat turn is persisted, so an expired conversation can neither be shown
 * nor silently revived by a new message.
 */
export async function expireStaleVisitorConversation(
  store: WidgetRestoreStore,
  input: { assistantId: string; sessionHash: string; retentionDays: number; now?: Date },
): Promise<boolean> {
  const cutoff = widgetRetentionCutoff(input.now ?? new Date(), input.retentionDays);
  return store.detachStaleConversation(input.assistantId, input.sessionHash, cutoff);
}

export async function restoreWidgetConversation(
  store: WidgetRestoreStore,
  input: { assistantId: string; sessionHash: string; retentionDays: number; now?: Date },
): Promise<WidgetRestoreResult> {
  const expired = await expireStaleVisitorConversation(store, input);
  if (expired) return { status: "expired" };

  const conversation = await store.findConversation(input.assistantId, input.sessionHash);
  // Unknown sessions look exactly like new visitors; never reveal whether a
  // conversation exists for some other session.
  if (!conversation) return { status: "empty" };

  const rows = await store.listRecentMessages(conversation.id, WIDGET_RESTORE_MESSAGE_LIMIT);
  const messages = [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((row): RestoredWidgetMessage[] => {
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return [];
      return [{
        role: row.role,
        content: row.content,
        created_at: row.created_at,
        sources: safeWidgetSources(row.sources),
        ...(typeof row.client_message_id === "string" && uuidPattern.test(row.client_message_id)
          ? { request_id: row.client_message_id }
          : {}),
      }];
    });
  return { status: "restored", conversationId: conversation.id, messages };
}

/**
 * If the visitor's last visible turn was an abstention that offered human
 * follow-up, return that turn's request id so the widget can re-offer it.
 */
export function pendingEscalationRequestId(
  messages: RestoredWidgetMessage[],
  fallbackMessage: string,
  handoffOfferedOnAbstention: boolean,
): string | null {
  if (!handoffOfferedOnAbstention) return null;
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.content === fallbackMessage && last.request_id) return last.request_id;
  return null;
}

export function resolveRestoredEscalation(
  messages: RestoredWidgetMessage[],
  options: {
    fallbackMessage: string;
    handoffEnabled: boolean;
    unknownAnswerBehavior: UnknownAnswerBehavior;
    hasExistingHandoff?: boolean;
  },
): {
  requestId: string | null;
  reason: EscalationReason | null;
} {
  if (!options.handoffEnabled || options.hasExistingHandoff) {
    return { requestId: null, reason: null };
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || !last.request_id) {
    return { requestId: null, reason: null };
  }

  const prev = messages[messages.length - 2];
  const userContent = prev?.role === "user" ? prev.content : "";

  if (userContent && isExplicitHumanHandoffRequest(userContent)) {
    return { requestId: last.request_id, reason: "explicit_request" };
  }

  const isAbstention = isKnownAbstentionMessage(last.content, options.fallbackMessage);
  if (!isAbstention) {
    return { requestId: null, reason: null };
  }

  const consecutiveAbstentions = countConsecutiveAbstentions(messages, options.fallbackMessage);
  const evaluation = evaluateEscalationTrigger({
    message: userContent,
    isAbstention: true,
    consecutiveAbstentions,
    handoffEnabled: options.handoffEnabled,
    unknownAnswerBehavior: options.unknownAnswerBehavior,
  });

  if (!evaluation.shouldOfferHandoff) {
    return { requestId: null, reason: null };
  }

  return { requestId: last.request_id, reason: evaluation.reason };
}
