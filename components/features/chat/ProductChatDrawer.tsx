"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowDown,
  Bot,
  ChevronDown,
  ExternalLink,
  History,
  Loader2,
  LogIn,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import type { RetrievedProduct } from "@/lib/services/rag";
import { cn } from "@/lib/utils";

import { ChatMarkdown } from "./ChatMarkdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: RetrievedProduct[];
  failed?: boolean;
}

interface HistorySession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export type StoreAiOpenDetail = {
  prompt?: string;
  productName?: string;
};

const QUICK_PROMPTS = [
  "What watches do you have in stock?",
  "Show me products under $40",
  "Do you have black color items?",
  "Which products come in Free Size?",
];

const MD_QUERY = "(min-width: 768px)";
export const STORE_AI_OPEN_EVENT = "store-ai:open";

export function openStoreAi(detail: StoreAiOpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_AI_OPEN_EVENT, { detail }));
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

export function ProductChatDrawer() {
  const { data: authSession, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && Boolean(authSession?.user?.id);
  const isDesktop = useIsDesktop();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDesktopBreakpoint, setHistoryDesktopBreakpoint] = useState(isDesktop);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [productHint, setProductHint] = useState<string | null>(null);

  if (historyDesktopBreakpoint !== isDesktop) {
    setHistoryDesktopBreakpoint(isDesktop);
    setShowHistory(isDesktop);
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);
  const messageIdRef = useRef(0);

  const fetchSessions = useCallback(async () => {
    if (!isLoggedIn) {
      setSessions([]);
      return;
    }
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // Ignore
    } finally {
      setIsLoadingSessions(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isOpen && isLoggedIn) {
      setTimeout(() => void fetchSessions(), 0);
    }
  }, [isOpen, isLoggedIn, fetchSessions]);

  useEffect(() => {
    if (!isLoggedIn) {
      setTimeout(() => setSessions([]), 0);
      setTimeout(() => setActiveSessionId(null), 0);
    }
  }, [isLoggedIn]);

  const closeDrawer = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setPendingDeleteId(null);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingDeleteId) {
        setPendingDeleteId(null);
        return;
      }
      if (showHistory && !isDesktop) {
        setShowHistory(false);
        return;
      }
      closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, showHistory, isDesktop, pendingDeleteId, closeDrawer]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<StoreAiOpenDetail>).detail ?? {};
      setIsOpen(true);
      if (detail.productName) {
        setProductHint(detail.productName);
        const prompt =
          detail.prompt || `Tell me more about ${detail.productName} — colors, sizes, and stock.`;
        setInput(prompt);
      } else if (detail.prompt) {
        setInput(detail.prompt);
      }
      setTimeout(() => inputRef.current?.focus(), 160);
    };
    window.addEventListener(STORE_AI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(STORE_AI_OPEN_EVENT, onOpen);
  }, []);

  const displayProductHint = pathname?.startsWith("/products/") ? productHint : null;

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(true);
  }, [messages, isLoading, scrollToBottom]);

  const onScrollMessages = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 80;
    stickToBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom && messages.length > 0);
  };

  const closeHistoryOnMobile = () => {
    if (!isDesktop) setShowHistory(false);
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setMessages([]);
    setActiveSessionId(null);
    setInput("");
    setStatusHint(null);
    setPendingDeleteId(null);
    closeHistoryOnMobile();
    stickToBottomRef.current = true;
    inputRef.current?.focus();
  };

  const handleLoadSession = async (sessionId: string) => {
    if (!isLoggedIn || isLoadingSession) return;
    setIsLoadingSession(true);
    setPendingDeleteId(null);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load chat");
      const data = await res.json();
      const loaded: ChatMessage[] = (data.session?.messages ?? []).map(
        (m: {
          id: string;
          role: string;
          content: string;
          metadata?: { products?: RetrievedProduct[] } | null;
        }) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          products:
            m.role === "assistant" && m.metadata && Array.isArray(m.metadata.products)
              ? m.metadata.products
              : undefined,
        })
      );
      setMessages(loaded);
      setActiveSessionId(sessionId);
      stickToBottomRef.current = true;
      closeHistoryOnMobile();
      setTimeout(() => scrollToBottom(false), 50);
    } catch (err) {
      console.error(err);
      setStatusHint("Couldn’t load that chat. Try again.");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const confirmDeleteSession = async (sessionId: string) => {
    if (!isLoggedIn || isDeletingSession) return;
    setIsDeletingSession(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        setStatusHint("Couldn’t delete chat. Try again.");
        setTimeout(() => setStatusHint(null), 2500);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewChat();
      setPendingDeleteId(null);
      setStatusHint("Chat deleted");
      setTimeout(() => setStatusHint(null), 2000);
    } catch {
      setStatusHint("Couldn’t delete chat. Try again.");
      setTimeout(() => setStatusHint(null), 2500);
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  };

  const handleSendMessage = async (textToSend?: string, historyOverride?: ChatMessage[]) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    closeHistoryOnMobile();
    stickToBottomRef.current = true;

    const userMessageId = `user-${++messageIdRef.current}`;
    const userMsg: ChatMessage = { id: userMessageId, role: "user", content: query };
    const assistantMessageId = `assistant-${++messageIdRef.current}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      products: [],
    };

    const baseMessages = historyOverride ?? messages;
    const updatedMessages = [...baseMessages, userMsg];
    setMessages([...updatedMessages, initialAssistantMsg]);
    setIsLoading(true);
    setStatusHint(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const cappedHistory = updatedMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: cappedHistory,
          sessionId: isLoggedIn ? activeSessionId : null,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server responded with status ${res.status}`);
      }
      if (!res.body) throw new Error("No response body received from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let savedSessionId = activeSessionId as string | null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer = `${buffer}${decoder.decode(value, { stream: true })}`;
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const eventMatch = trimmed.match(/^event:\s*(\w+)/);
          const dataMatch = trimmed.match(/data:\s*(.+)$/m);
          const eventType = eventMatch ? eventMatch[1] : "delta";
          const dataRaw = dataMatch ? dataMatch[1] : "";

          if (eventType === "metadata" && dataRaw) {
            try {
              const meta = JSON.parse(dataRaw);
              if (meta.sessionId && isLoggedIn) {
                savedSessionId = meta.sessionId;
                setActiveSessionId(meta.sessionId);
              }
              if (meta.products && Array.isArray(meta.products)) {
                const products = meta.products as RetrievedProduct[];
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, products } : msg))
                );
              }
            } catch (e) {
              console.error("Failed to parse metadata event", e);
            }
          } else if (eventType === "delta" && dataRaw) {
            let chunk = dataRaw;
            try {
              const parsedData = JSON.parse(dataRaw);
              chunk = parsedData.text || "";
            } catch {
              // keep raw chunk
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `${msg.content}${chunk}`, failed: false }
                  : msg
              )
            );
          } else if (eventType === "done" && dataRaw) {
            try {
              const doneData = JSON.parse(dataRaw);
              if (doneData.sessionId && isLoggedIn) {
                savedSessionId = doneData.sessionId;
                setActiveSessionId(doneData.sessionId);
              }
            } catch {
              // Ignore
            }
          } else if (eventType === "error" && dataRaw) {
            let errorText = dataRaw;
            try {
              const parsedError = JSON.parse(dataRaw);
              errorText = parsedError.error || "Something went wrong.";
            } catch {
              // keep raw
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: errorText, failed: true } : msg
              )
            );
          }
        }
      }

      if (isLoggedIn && savedSessionId) {
        void fetchSessions();
        setStatusHint("Saved to history");
        setTimeout(() => setStatusHint(null), 2200);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || "Stopped.",
                  failed: false,
                }
              : msg
          )
        );
      } else {
        console.error("Chat error:", err);
        const errMsg = err instanceof Error ? err.message : "Failed to connect to the assistant.";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: errMsg, failed: true } : msg
          )
        );
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleRetry = (assistantId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    const priorUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!priorUser) return;
    const base = messages.slice(0, idx - 1);
    void handleSendMessage(priorUser.content, base);
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const onInputChange = (value: string) => {
    setInput(value);
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSendMessage();
  };

  const historyPanel = (
    <div className="flex h-full w-full flex-col bg-[#f4f7fb]">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-border/70 px-3 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
          <History className="h-3.5 w-3.5 text-brand-500" />
          History
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-neutral-muted hover:bg-white hover:text-neutral-900 md:hidden"
          onClick={() => setShowHistory(false)}
          aria-label="Close history"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2.5">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm shadow-brand-500/20 hover:bg-brand-600 transition"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!isLoggedIn ? (
          <div className="mx-1 rounded-xl border border-dashed border-neutral-border bg-white p-3 text-center">
            <LogIn className="mx-auto h-4 w-4 text-neutral-muted" />
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-muted">
              Sign in to save chats across devices.
            </p>
            <Link
              href="/login"
              className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-medium text-white"
            >
              Sign in
            </Link>
          </div>
        ) : isLoadingSessions ? (
          <div className="flex justify-center py-8 text-neutral-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-neutral-muted">
            No saved chats yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id}>
                {pendingDeleteId === s.id ? (
                  <div className="rounded-xl bg-white p-2.5 ring-1 ring-rose-200">
                    <p className="text-[11px] font-medium text-neutral-900">Delete this chat?</p>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={isDeletingSession}
                        onClick={() => confirmDeleteSession(s.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-70"
                      >
                        {isDeletingSession ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Deleting…
                          </>
                        ) : (
                          "Delete"
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingSession}
                        onClick={() => setPendingDeleteId(null)}
                        className="flex-1 rounded-lg bg-neutral-bg px-2 py-1.5 text-[11px] font-medium text-neutral-text disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLoadSession(s.id)}
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
                      activeSessionId === s.id
                        ? "bg-white shadow-sm ring-1 ring-brand-500/20"
                        : "hover:bg-white/90"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-xs font-medium",
                          activeSessionId === s.id ? "text-brand-700" : "text-neutral-900"
                        )}
                      >
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-muted">
                        {formatRelativeTime(s.updatedAt)} · {s._count.messages}
                      </p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        setPendingDeleteId(s.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setPendingDeleteId(s.id);
                        }
                      }}
                      className="mt-0.5 rounded-md p-1 text-neutral-muted opacity-0 group-hover:opacity-100 hover:bg-status-error-bg hover:text-status-error-fg transition"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        id="open-product-chat"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 sm:bottom-6 sm:right-6 sm:gap-2.5 sm:pl-3.5 sm:pr-4 sm:py-3",
          "h-12 w-12 justify-center sm:h-auto sm:w-auto sm:justify-start",
          isOpen && "pointer-events-none scale-0 opacity-0"
        )}
        aria-label="Open AI shopping assistant"
      >
        <Sparkles className="h-5 w-5 text-amber-300 sm:h-[18px] sm:w-[18px]" />
        <span className="hidden text-sm font-semibold tracking-wide sm:inline">Ask Store AI</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end overscroll-none"
          role="dialog"
          aria-modal="true"
          aria-label="Store AI assistant"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px]"
            aria-label="Close assistant backdrop"
            onClick={closeDrawer}
          />

          <aside
            className={cn(
              "relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl",
              "sm:max-w-[420px] md:max-w-[680px] md:flex-row",
              "max-sm:rounded-none sm:rounded-l-2xl",
              "animate-fade-in-up"
            )}
          >
            <div
              className={cn(
                "hidden shrink-0 border-r border-neutral-border/70 transition-[width] duration-200 md:block",
                showHistory ? "md:w-[220px]" : "md:w-0 md:border-r-0 md:overflow-hidden"
              )}
            >
              <div className="h-full w-[220px]">{historyPanel}</div>
            </div>

            {showHistory && !isDesktop && (
              <div className="absolute inset-0 z-20 flex md:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-neutral-900/30"
                  aria-label="Dismiss history"
                  onClick={() => setShowHistory(false)}
                />
                <div className="relative z-10 h-full w-[min(86vw,280px)] shadow-xl animate-fade-in-up">
                  {historyPanel}
                </div>
              </div>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="flex items-center gap-2 border-b border-neutral-border/70 px-3 py-2.5 sm:px-4 sm:py-3">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="rounded-lg p-2 text-neutral-muted hover:bg-neutral-bg hover:text-neutral-900"
                  aria-label={showHistory ? "Hide history" : "Show history"}
                >
                  <History className="h-4 w-4" />
                </button>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white sm:h-9 sm:w-9">
                  <Bot className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-neutral-900">
                    Store Assistant
                  </h3>
                  <p className="truncate text-[10px] text-neutral-muted sm:text-[11px]">
                    {statusHint
                      ? statusHint
                      : isLoading
                        ? "Searching catalog…"
                        : isLoggedIn
                          ? "History saved"
                          : "Guest · not saved"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNewChat}
                  className="rounded-lg p-2 text-neutral-muted hover:bg-neutral-bg hover:text-neutral-900 md:hidden"
                  aria-label="New chat"
                  title="New chat"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg p-2 text-neutral-muted hover:bg-neutral-bg hover:text-neutral-900"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {displayProductHint && (
                <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/70 px-3 py-2 sm:px-4">
                  <p className="min-w-0 truncate text-[11px] text-brand-700">
                    Asking about <span className="font-semibold">{displayProductHint}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductHint(null)}
                    className="shrink-0 rounded p-0.5 text-brand-600 hover:bg-brand-100"
                    aria-label="Dismiss product context"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div
                ref={scrollContainerRef}
                onScroll={onScrollMessages}
                className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
              >
                {isLoadingSession && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 py-2">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h4 className="text-base font-semibold text-neutral-900">Ask the store</h4>
                      <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-neutral-muted sm:text-xs">
                        Prices, sizes, stock, and recommendations from live inventory.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSendMessage(prompt)}
                          className="rounded-xl border border-neutral-border/70 bg-white px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-neutral-text transition hover:border-brand-500/40 hover:bg-brand-50/40 disabled:opacity-50 sm:text-xs"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col gap-1.5",
                            isUser ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "flex max-w-[min(100%,28rem)] items-end gap-2",
                              isUser ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                                isUser ? "bg-neutral-900 text-white" : "bg-brand-500 text-white"
                              )}
                            >
                              {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                            </div>
                            <div
                              className={cn(
                                "rounded-2xl px-3 py-2 text-[12px] leading-relaxed sm:text-sm",
                                isUser
                                  ? "rounded-br-md bg-brand-500 text-white whitespace-pre-wrap"
                                  : msg.failed
                                    ? "rounded-bl-md border border-rose-200 bg-rose-50 text-rose-800"
                                    : "rounded-bl-md border border-neutral-border/60 bg-white text-neutral-text"
                              )}
                            >
                              {!msg.content ? (
                                <span className="inline-flex items-center gap-1.5 text-neutral-muted">
                                  <span className="flex gap-0.5">
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:0ms]" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:150ms]" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:300ms]" />
                                  </span>
                                  Searching catalog…
                                </span>
                              ) : isUser || msg.failed ? (
                                <span className="whitespace-pre-wrap">{msg.content}</span>
                              ) : (
                                <ChatMarkdown content={msg.content} />
                              )}
                            </div>
                          </div>

                          {!isUser && msg.failed && (
                            <button
                              type="button"
                              onClick={() => handleRetry(msg.id)}
                              disabled={isLoading}
                              className="ml-8 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          )}

                          {!isUser && msg.products && msg.products.length > 0 && (
                            <div className="w-full max-w-[min(100%,28rem)] space-y-1.5 pl-8">
                              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-muted">
                                <Tag className="h-3 w-3" />
                                Matches ({msg.products.length})
                              </p>
                              <div className="space-y-1.5">
                                {msg.products.map((prod) => (
                                  <div
                                    key={prod.id}
                                    className="flex items-center gap-2.5 rounded-xl border border-neutral-border/60 bg-white p-2"
                                  >
                                    {prod.image ? (
                                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-bg">
                                        <Image
                                          src={prod.image}
                                          alt={prod.title}
                                          fill
                                          sizes="40px"
                                          className="object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-bg text-neutral-muted">
                                        <Tag className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-neutral-900">
                                        {prod.title}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-neutral-muted">
                                        <span className="font-semibold text-brand-600">
                                          ${prod.price.toFixed(2)}
                                        </span>
                                        {prod.color ? (
                                          <>
                                            {" · "}
                                            <span>{prod.color}</span>
                                          </>
                                        ) : null}
                                        {prod.size ? (
                                          <>
                                            {" · "}
                                            <span>{prod.size}</span>
                                          </>
                                        ) : null}
                                        {" · "}
                                        <span
                                          className={
                                            prod.stock > 0 ? "text-emerald-600" : "text-rose-500"
                                          }
                                        >
                                          {prod.stock > 0
                                            ? `${prod.stock} in stock`
                                            : "Out of stock"}
                                        </span>
                                      </p>
                                    </div>
                                    <Link
                                      href={`/products/${prod.id}`}
                                      className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:bg-brand-500 hover:text-white"
                                      onClick={closeDrawer}
                                    >
                                      <span className="inline-flex items-center gap-0.5">
                                        View
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </span>
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                {messages.length === 0 && <div ref={messagesEndRef} />}

                {showScrollDown && (
                  <button
                    type="button"
                    onClick={() => {
                      stickToBottomRef.current = true;
                      scrollToBottom(true);
                      setShowScrollDown(false);
                    }}
                    className="sticky bottom-2 left-1/2 z-10 mx-auto flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-border bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-text shadow-md"
                  >
                    <ArrowDown className="h-3 w-3" />
                    Latest
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
              </div>

              <footer className="border-t border-neutral-border/70 bg-white p-3 sm:p-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <form
                  onSubmit={onSubmit}
                  className="flex items-end gap-2 rounded-2xl border border-neutral-border/80 bg-neutral-bg px-2 py-1.5 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/15"
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Ask about products… (Enter to send)"
                    className="max-h-[120px] min-h-[36px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-neutral-text placeholder:text-neutral-muted focus:outline-none"
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
                      aria-label="Stop generating"
                      title="Stop"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-45"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </form>
                <p className="mt-1.5 text-center text-[10px] text-neutral-muted">
                  Ai Can Do mistakes, so please check the product details before buying.
                </p>
              </footer>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
