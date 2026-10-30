import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  chatApi,
  ChatApiError,
  notifyHabitsChanged,
  toMessageViews,
  type ChatMessageView,
  type ChatStreamEvent,
  type ToolCardData,
} from "../../lib/chat";
import { todayKey } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import MochiFace, { type MochiStatus } from "./MochiFace";

const TOOL_ICONS: Record<string, string> = {
  list_habits: "📋",
  get_dashboard: "📊",
  get_habit_stats: "📈",
  create_habit: "✨",
  mark_day: "🗓️",
  add_coins: "🪙",
  delete_habit: "🗑️",
};

const WRITE_TOOLS = new Set(["create_habit", "mark_day", "add_coins"]);

const LazyMochi3D = lazy(() => import("./Mochi3D"));

class MochiBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function MochiAvatar({ status }: { status: MochiStatus }) {
  const [use3D] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      webglAvailable()
  );
  const [failed, setFailed] = useState(false);
  return (
    <div className={`chat-avatar chat-avatar-${status}`} aria-hidden="true">
      {use3D && !failed ? (
        <MochiBoundary onError={() => setFailed(true)}>
          <Suspense fallback={<MochiFace size={62} />}>
            <LazyMochi3D status={status} />
          </Suspense>
        </MochiBoundary>
      ) : (
        <MochiFace size={62} />
      )}
    </div>
  );
}

let tmpSeq = 0;
const tmpId = () => `tmp-${++tmpSeq}-${Date.now()}`;

export default function ChatPanel() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<MochiStatus>("idle");
  const [notConfigured, setNotConfigured] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const loadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const erroredRef = useRef(false);

  const statusText =
    status === "thinking"
      ? t("chat.statusThinking")
      : status === "tool"
        ? t("chat.statusWorking")
        : status === "speaking"
          ? t("chat.statusSpeaking")
          : status === "celebrate"
            ? t("chat.statusCelebrate")
            : status === "error"
              ? t("chat.statusError")
              : t("chat.statusOnline");

  const patchAssistant = useCallback(
    (id: string, patch: (view: ChatMessageView) => ChatMessageView) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
    },
    []
  );

  const resyncThread = useCallback(async () => {
    try {
      const data = await chatApi.getThread();
      setThreadId(data.threadId);
      setMessages(toMessageViews(data.messages, data.actions));
    } catch {
      // keep local state; next open retries
    }
  }, []);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    setLoadingThread(true);
    chatApi
      .getThread()
      .then((data) => {
        setThreadId(data.threadId);
        setMessages(toMessageViews(data.messages, data.actions));
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoadingThread(false));
  }, [open ]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else if (loadedRef.current) {
      fabRef.current?.focus();
    }
  }, [open ]);

  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, status, open]);

  const applyEvent = useCallback(
    (assistantId: string) =>
      (e: ChatStreamEvent) => {
        switch (e.type) {
          case "thread":
            setThreadId(e.threadId);
            break;
          case "text_delta":
            setStatus("speaking");
            patchAssistant(assistantId, (m) => ({ ...m, content: m.content + e.text }));
            break;
          case "tool_start":
            setStatus("tool");
            patchAssistant(assistantId, (m) => ({
              ...m,
              toolCards: [
                ...m.toolCards,
                { callId: e.callId, tool: e.tool, label: e.label, status: "running" },
              ],
            }));
            break;
          case "tool_result":
            patchAssistant(assistantId, (m) => ({
              ...m,
              toolCards: m.toolCards.map((card) =>
                card.callId === e.callId
                  ? {
                      ...card,
                      status: e.ok ? "ok" : "error",
                      summary: e.summary,
                      undoActionId: e.undoActionId,
                    }
                  : card
              ),
            }));
            if (e.ok && e.undoActionId) {
              notifyHabitsChanged();
              setStatus("celebrate");
              if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
              celebrateTimer.current = setTimeout(() => {
                setStatus(streamingRef.current ? "thinking" : "idle");
              }, 1500);
            }
            break;
          case "confirm_required":
            patchAssistant(assistantId, (m) => ({
              ...m,
              confirm: {
                pendingActionId: e.pendingActionId,
                label: e.label,
                detail: e.detail,
                state: "pending",
              },
            }));
            break;
          case "done":
            patchAssistant(assistantId, (m) => ({ ...m, id: e.messageId }));
            setStatus("idle");
            break;
          case "error":
            erroredRef.current = true;
            setStatus("error");
            patchAssistant(assistantId, (m) => ({ ...m, error: true }));
            break;
        }
      },
    [patchAssistant]
  );

  const runStream = useCallback(
    async (
      assistantId: string,
      start: (onEvent: (e: ChatStreamEvent) => void, signal: AbortSignal) => Promise<void>
    ): Promise<boolean> => {
      const controller = new AbortController();
      abortRef.current = controller;
      streamingRef.current = true;
      setStreaming(true);
      setStatus("thinking");
      erroredRef.current = false;
      let succeeded = true;
      try {
        await start(applyEvent(assistantId), controller.signal);
        if (erroredRef.current) {
          await resyncThread();
          setStatus("error");
        } else {
          setStatus((s) => (s === "error" ? s : "idle"));
        }
      } catch (err) {
        succeeded = false;
        if (err instanceof ChatApiError && err.code === "assistant_not_configured") {
          setNotConfigured(true);
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantId && !m.id.startsWith("tmp-user-"))
          );
          setStatus("idle");
        } else if (err instanceof DOMException && err.name === "AbortError") {
          setTimeout(() => void resyncThread(), 400);
          setStatus("idle");
        } else {
          await resyncThread();
          setStatus("error");
        }
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
      }
      return succeeded;
    },
    [applyEvent, resyncThread]
  );

  const cancelPendingConfirms = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.confirm?.state === "pending"
          ? { ...m, confirm: { ...m.confirm, state: "cancelled" as const } }
          : m
      )
    );
  }, []);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || streamingRef.current) return;
      cancelPendingConfirms();
      setInput("");
      const userId = `tmp-user-${tmpId()}`;
      const assistantId = tmpId();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: text, toolCards: [] },
        { id: assistantId, role: "assistant", content: "", toolCards: [] },
      ]);
      nearBottomRef.current = true;
      await runStream(assistantId, (onEvent, signal) =>
        chatApi.sendMessage(
          { threadId: threadId ?? undefined, message: text, today: todayKey(), lang },
          onEvent,
          signal
        )
      );
    },
    [input, threadId, lang, runStream, cancelPendingConfirms]
  );

  const retry = useCallback(
    async (view: ChatMessageView) => {
      if (!view.retryMessageId || streamingRef.current) return;
      setMessages((prev) => prev.filter((m) => m.id !== view.id));
      const assistantId = tmpId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", toolCards: [] },
      ]);
      await runStream(assistantId, (onEvent, signal) =>
        chatApi.sendMessage(
          { threadId: threadId ?? undefined, retryMessageId: view.retryMessageId, today: todayKey(), lang },
          onEvent,
          signal
        )
      );
    },
    [threadId, lang, runStream]
  );

  const handleConfirm = useCallback(
    async (view: ChatMessageView, approve: boolean) => {
      if (!view.confirm || streamingRef.current) return;
      const pendingActionId = view.confirm.pendingActionId;
      const assistantId = tmpId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", toolCards: [] },
      ]);
      const succeeded = await runStream(assistantId, (onEvent, signal) =>
        chatApi.confirm({ pendingActionId, approve, today: todayKey(), lang }, onEvent, signal)
      );
      if (succeeded) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === view.id && m.confirm
              ? { ...m, confirm: { ...m.confirm, state: approve ? "approved" : "declined" } }
              : m
          )
        );
        if (approve) notifyHabitsChanged();
      } else if (!notConfigured) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === view.id && m.confirm
              ? { ...m, confirm: { ...m.confirm, state: "expired" } }
              : m
          )
        );
      }
    },
    [lang, runStream]
  );

  const handleUndo = useCallback(async (viewId: string, card: ToolCardData) => {
    if (!card.undoActionId) return;
    try {
      const result = await chatApi.undo(card.undoActionId);
      if (result.undone || result.changed) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === viewId
              ? {
                  ...m,
                  toolCards: m.toolCards.map((c) =>
                    c.callId === card.callId ? { ...c, status: "undone" as const } : c
                  ),
                }
              : m
          )
        );
        notifyHabitsChanged();
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === viewId
              ? {
                  ...m,
                  toolCards: m.toolCards.map((c) =>
                    c.callId === card.callId ? { ...c, summary: result.summary } : c
                  ),
                }
              : m
          )
        );
      }
    } catch {
      // card keeps its state; user can retry the undo
    }
  }, []);

  const newChat = useCallback(async () => {
    if (streamingRef.current) return;
    try {
      const { threadId: id } = await chatApi.newThread();
      setThreadId(id);
      setMessages([]);
      setStatus("idle");
    } catch {
      // keep current thread
    }
  }, []);

  const prompts = [t("chat.promptStats"), t("chat.promptCheckin"), t("chat.promptNew")];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-panel"
            role="dialog"
            aria-label={t("chat.title")}
            tabIndex={-1}
            ref={panelRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
          >
            <div className="chat-header">
              <MochiAvatar status={status} />
              <div className="chat-header-text">
                <strong>{t("chat.title")}</strong>
                <span aria-live="polite">{statusText}</span>
              </div>
              <button
                type="button"
                className="chat-icon-btn"
                onClick={newChat}
                disabled={streaming}
                aria-label={t("chat.newChat")}
                title={t("chat.newChat")}
              >
                ↺
              </button>
              <button
                type="button"
                className="chat-icon-btn"
                onClick={() => setOpen(false)}
                aria-label={t("chat.close")}
              >
                ✕
              </button>
            </div>

            {notConfigured ? (
              <div className="chat-notice">
                <MochiFace size={72} />
                <h3>{t("chat.notConfiguredTitle")}</h3>
                <p>{t("chat.notConfiguredBody")}</p>
              </div>
            ) : (
              <>
                <div
                  className="chat-messages"
                  ref={listRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                  }}
                >
                  {loadingThread ? (
                    <div className="center-screen" style={{ minHeight: "30vh" }}>
                      <div className="spinner" />
                    </div>
                  ) : loadFailed ? (
                    <p className="chat-load-error">{t("chat.loadFailed")}</p>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty">
                      <MochiFace size={84} />
                      <h3>{t("chat.emptyTitle")}</h3>
                      <p>{t("chat.emptyBody")}</p>
                    </div>
                  ) : null}

                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id} className="chat-bubble chat-bubble-user">
                        {m.content}
                      </div>
                    ) : (
                      <div key={m.id} className="chat-turn">
                        {(m.content || m.toolCards.length === 0) && (
                          <div className="chat-bubble chat-bubble-assistant">
                            {m.content || (
                              <span className="chat-typing" aria-hidden="true">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                          </div>
                        )}
                        {m.toolCards.map((card) => (
                          <div key={card.callId} className={`chat-tool chat-tool-${card.status}`}>
                            <div className="chat-tool-head">
                              <span className="chat-tool-icon">
                                {TOOL_ICONS[card.tool] ?? "🔧"}
                              </span>
                              <span className="chat-tool-label">{card.label}</span>
                              <span className="chat-tool-state">
                                {card.status === "running" ? (
                                  <span className="chat-mini-spinner" aria-label="…" />
                                ) : card.status === "ok" ? (
                                  "✓"
                                ) : card.status === "error" ? (
                                  "!"
                                ) : (
                                  "↩"
                                )}
                              </span>
                            </div>
                            {card.summary && <p className="chat-tool-summary">{card.summary}</p>}
                            {card.status === "ok" && card.undoActionId && (
                              <button
                                type="button"
                                className="chat-undo-btn"
                                onClick={() => handleUndo(m.id, card)}
                              >
                                ↩ {t("chat.undo")}
                              </button>
                            )}
                            {card.status === "undone" && (
                              <p className="chat-tool-summary">{t("chat.undone")}</p>
                            )}
                          </div>
                        ))}
                        {m.confirm && (
                          <div className="chat-confirm">
                            <strong>{t("chat.confirmTitle")}</strong>
                            <p>{t("chat.confirmBody", { name: m.confirm.detail })}</p>
                            {m.confirm.state === "pending" ? (
                              <div className="chat-confirm-actions">
                                <button
                                  type="button"
                                  className="chat-delete-btn"
                                  onClick={() => handleConfirm(m, true)}
                                  disabled={streaming}
                                >
                                  {t("chat.delete")}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => handleConfirm(m, false)}
                                  disabled={streaming}
                                >
                                  {t("common.cancel")}
                                </button>
                              </div>
                            ) : (
                              <p className="chat-confirm-state">
                                {m.confirm.state === "approved"
                                  ? t("chat.confirmApproved")
                                  : m.confirm.state === "declined"
                                    ? t("chat.confirmDeclined")
                                    : m.confirm.state === "expired"
                                      ? t("chat.confirmExpired")
                                      : t("chat.confirmCancelled")}
                              </p>
                            )}
                          </div>
                        )}
                        {(m.interrupted || m.error) && (
                          <div className="chat-retry-row">
                            <span>{m.interrupted ? t("chat.interrupted") : t("chat.genericError")}</span>
                            {m.retryMessageId && (
                              <button
                                type="button"
                                className="chat-undo-btn"
                                onClick={() => retry(m)}
                                disabled={streaming}
                              >
                                {t("chat.retry")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="chat-chips">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="chat-chip"
                      disabled={streaming}
                      onClick={() => void send(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("chat.placeholder")}
                    rows={1}
                    maxLength={2000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  {streaming ? (
                    <button
                      type="button"
                      className="chat-send-btn chat-stop-btn"
                      onClick={() => abortRef.current?.abort()}
                    >
                      ■ {t("chat.stop")}
                    </button>
                  ) : (
                    <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
                      {t("chat.send")}
                    </button>
                  )}
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          ref={fabRef}
          type="button"
          className="chat-fab"
          onClick={() => setOpen(true)}
          aria-label={t("chat.fab")}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.35 }}
          whileTap={{ scale: 0.94 }}
        >
          <MochiFace size={32} />
          <span>{t("chat.fab")}</span>
        </motion.button>
      )}
    </>
  );
}
