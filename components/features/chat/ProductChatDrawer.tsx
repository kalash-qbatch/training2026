"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowDown,
  Bot,
  ChevronDown,
  History,
  Loader2,
  LogIn,
  MessageSquarePlus,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import type { ChatbotProduct } from "@/lib/chatbot/types";
import type { RetrievedProduct } from "@/lib/services/rag";
import { cn } from "@/lib/utils";

import { ChatMarkdown } from "./ChatMarkdown";
import { ProductCarousel } from "./ProductCarousel";

const FALLBACK_CHAT_ERROR = "I'm having trouble right now. Please try again in a moment.";

function looksLikeHtml(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("__next_error__");
}

/** Prefer JSON error fields; never surface Next.js HTML error pages in the chat UI. */
function friendlyApiError(raw: string, status: number): string {
  const trimmed = raw.trim();
  if (!trimmed || looksLikeHtml(trimmed)) {
    return status >= 500 ? FALLBACK_CHAT_ERROR : `Request failed (${status}). Please try again.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // not JSON
  }
  if (looksLikeHtml(trimmed) || trimmed.length > 280) return FALLBACK_CHAT_ERROR;
  return trimmed.slice(0, 240);
}

function sanitizeChatContent(content: string): string {
  if (!content || looksLikeHtml(content)) return FALLBACK_CHAT_ERROR;
  return content;
}

/** Map a RAG RetrievedProduct to the ChatbotProduct shape expected by ProductChatCard */
function mapToChatbotProduct(p: RetrievedProduct): ChatbotProduct {
  const matchingSpec =
    p.specifications.find(
      (s) =>
        (!p.color || s.color.toLowerCase() === p.color.toLowerCase()) &&
        (!p.size || !s.size || s.size.toLowerCase() === p.size.toLowerCase())
    ) || p.specifications[0];

  return {
    id: p.id,
    name: p.title,
    price: p.price,
    currency: "USD",
    image: p.image?.trim() || "/placeholder-product.png",
    rating: 4.5,
    in_stock: p.stock > 0,
    short_description: [
      p.color ? `Color: ${p.color}` : "",
      p.size ? `Size: ${p.size}` : "",
      p.categoryName ? p.categoryName : "",
    ]
      .filter(Boolean)
      .join(" · "),
    category: p.categoryName ?? undefined,
    stock: p.stock,
    specificationId: matchingSpec?.id,
    actions: [],
  };
}

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

const QUICK_PROMPTS_STORE = [
  "How many orders do I have?",
  "What's my latest order status?",
  "What watches do you have in stock?",
  "Show me products under $40",
];

const QUICK_PROMPTS_ADMIN = [
  "What is our total revenue?",
  "How many orders by status?",
  "How many products are active?",
  "How do I update order status?",
];

const ADMIN_SESSION_PREFIX = "[Admin] ";

export type AssistantVariant = "store" | "admin";

type AssistantConfig = {
  variant: AssistantVariant;
  chatUrl: string;
  title: string;
  fabLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  loadingHint: string;
  placeholder: string;
  footerNote: string;
  quickPrompts: string[];
  dialogLabel: string;
  showProductMatches: boolean;
  enableStoreOpenEvent: boolean;
};

function getAssistantConfig(variant: AssistantVariant): AssistantConfig {
  if (variant === "admin") {
    return {
      variant,
      chatUrl: "/api/admin/chat",
      title: "Admin Assistant",
      fabLabel: "Ask Admin AI",
      emptyTitle: "Ask the admin assistant",
      emptySubtitle: "Revenue, orders, products, inventory, and admin how-tos.",
      loadingHint: "Working on it…",
      placeholder: "Ask about admin tasks… (Enter to send)",
      footerNote: "Admin-only · refuses non-admin questions.",
      quickPrompts: QUICK_PROMPTS_ADMIN,
      dialogLabel: "Admin AI assistant",
      showProductMatches: false,
      enableStoreOpenEvent: false,
    };
  }
  return {
    variant,
    chatUrl: "/api/chat",
    title: "Store Assistant",
    fabLabel: "Ask Store AI",
    emptyTitle: "Ask the store",
    emptySubtitle: "Prices, sizes, stock, recommendations, and your order status.",
    loadingHint: "Searching catalog…",
    placeholder: "Ask about products… (Enter to send)",
    footerNote: "Ai Can Do mistakes, so please check the product details before buying.",
    quickPrompts: QUICK_PROMPTS_STORE,
    dialogLabel: "Store AI assistant",
    showProductMatches: true,
    enableStoreOpenEvent: true,
  };
}

const MD_QUERY = "(min-width: 768px)";
export const STORE_AI_OPEN_EVENT = "store-ai:open";

/** sessionStorage keys used to preserve guest chat across the login redirect */
const GUEST_CHAT_KEY = "store_ai_guest_messages";
const GUEST_OPEN_KEY = "store_ai_guest_open";

export function openStoreAi(detail: StoreAiOpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_AI_OPEN_EVENT, { detail }));
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const FAB_EDGE = 16;
const FAB_DRAG_THRESHOLD = 6;

type FabPoint = { x: number; y: number };

function fabBounds(width: number, height: number) {
  const viewW = document.documentElement.clientWidth;
  const viewH = document.documentElement.clientHeight;
  const maxX = Math.max(0, viewW - width);
  const maxY = Math.max(0, viewH - height);
  const left = Math.min(FAB_EDGE, maxX);
  const top = Math.min(FAB_EDGE, maxY);
  const right = Math.max(left, maxX - FAB_EDGE);
  const bottom = Math.max(top, maxY - FAB_EDGE);
  return { left, top, right, bottom };
}

/** Keep the button fully inside the viewport while dragging. */
function clampFabPosition(x: number, y: number, width: number, height: number): FabPoint {
  const { left, top, right, bottom } = fabBounds(width, height);
  return {
    x: Math.min(Math.max(left, x), right),
    y: Math.min(Math.max(top, y), bottom),
  };
}

/** Snap to the nearest top/bottom × left/right corner, like the Next.js badge. */
function snapFabToNearestCorner(x: number, y: number, width: number, height: number): FabPoint {
  const { left, top, right, bottom } = fabBounds(width, height);
  const corners: FabPoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ];
  let best = corners[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const corner of corners) {
    const dist = (corner.x - x) ** 2 + (corner.y - y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }
  return best;
}

export function ProductChatDrawer({ variant = "store" }: { variant?: AssistantVariant } = {}) {
  const config = getAssistantConfig(variant);
  const isAdmin = variant === "admin";
  const { data: authSession, status: authStatus } = useSession();
  const isLoggedIn = isAdmin || (authStatus === "authenticated" && Boolean(authSession?.user?.id));
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const fabPosRef = useRef<FabPoint | null>(null);
  const suppressFabClickRef = useRef(false);
  const fabDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [fabPos, setFabPos] = useState<FabPoint | null>(null);
  const [isFabDragging, setIsFabDragging] = useState(false);

  useEffect(() => {
    fabPosRef.current = fabPos;
  }, [fabPos]);

  useEffect(() => {
    const onResize = () => {
      const prev = fabPosRef.current;
      const el = fabRef.current;
      if (!prev || !el) return;
      const next = snapFabToNearestCorner(prev.x, prev.y, el.offsetWidth, el.offsetHeight);
      if (next.x !== prev.x || next.y !== prev.y) setFabPos(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    suppressFabClickRef.current = false;
    const el = fabRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    fabDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore when pointer capture isn't available (e.g. synthetic events).
    }
  };

  const onFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) return;
    drag.moved = true;
    const el = fabRef.current;
    if (!el) return;
    setIsFabDragging(true);
    setFabPos(
      clampFabPosition(drag.originX + dx, drag.originY + dy, el.offsetWidth, el.offsetHeight)
    );
  };

  const onFabPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) suppressFabClickRef.current = true;
    fabDragRef.current = null;
    const el = fabRef.current;
    if (el?.hasPointerCapture?.(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore.
      }
    }
    if (drag.moved && el) {
      const released = clampFabPosition(
        drag.originX + (e.clientX - drag.startX),
        drag.originY + (e.clientY - drag.startY),
        el.offsetWidth,
        el.offsetHeight
      );
      const snapped = snapFabToNearestCorner(
        released.x,
        released.y,
        el.offsetWidth,
        el.offsetHeight
      );
      // Keep the free-drag position first, re-enable transition, then snap next frame
      // so the corner move animates (like the Next.js badge).
      setFabPos(released);
      setIsFabDragging(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFabPos(snapped);
        });
      });
      return;
    }
    setIsFabDragging(false);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);
  const messageIdRef = useRef(0);
  /** Tracks the previous authStatus to detect the exact unauthenticated→authenticated transition */
  const prevAuthStatusRef = useRef(authStatus);

  const appendProductActionMessages = useCallback(
    (action: {
      type: "add_to_cart" | "add_to_cart_failed" | "view_details" | "view_cart" | "login";
      product: ChatbotProduct;
      quantity?: number;
      result?: string;
    }) => {
      const qty = action.quantity ?? 1;
      const name = action.product.name;
      const userText =
        action.type === "add_to_cart" || action.type === "add_to_cart_failed"
          ? `Add ${qty}× "${name}" to cart`
          : action.type === "view_details"
            ? `View details for "${name}"`
            : action.type === "view_cart"
              ? "View my cart"
              : `Log in to continue with "${name}"`;

      const assistantText =
        action.result ||
        (action.type === "add_to_cart"
          ? `Done — added ${qty}× "${name}" to your cart.`
          : action.type === "add_to_cart_failed"
            ? `Couldn't add "${name}" to your cart.`
            : action.type === "view_details"
              ? `Opening product details for "${name}".`
              : action.type === "view_cart"
                ? "Opening your cart."
                : "Opening sign-in so you can continue.");

      stickToBottomRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `action-user-${++messageIdRef.current}`,
          role: "user",
          content: userText,
        },
        {
          id: `action-assistant-${++messageIdRef.current}`,
          role: "assistant",
          content: assistantText,
        },
      ]);

      if (action.type === "add_to_cart") {
        showToast(`✓ Added ${qty}× "${name}" to your cart!`);
      } else if (action.type === "add_to_cart_failed") {
        showToast(`Cart error: ${action.result || "Failed"}`);
      }
    },
    [showToast]
  );

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
      const allSessions: HistorySession[] = data.sessions ?? [];
      setSessions(
        isAdmin
          ? allSessions.filter((s) => s.title.startsWith(ADMIN_SESSION_PREFIX))
          : allSessions.filter((s) => !s.title.startsWith(ADMIN_SESSION_PREFIX))
      );
    } catch {
      // Ignore
    } finally {
      setIsLoadingSessions(false);
    }
  }, [isLoggedIn, isAdmin]);

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

  // ── Guest chat persistence ──────────────────────────────────────────────
  // Continuously save guest messages so they survive a page navigation to /login
  useEffect(() => {
    if (isAdmin || isLoggedIn || authStatus === "loading") return;
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(GUEST_CHAT_KEY, JSON.stringify(messages));
    } catch {
      // Storage unavailable (private browsing quota, etc.) — ignore silently
    }
  }, [messages, isLoggedIn, isAdmin, authStatus]);

  // Save whether the drawer was open when the guest left
  useEffect(() => {
    if (isAdmin || isLoggedIn || authStatus === "loading") return;
    try {
      sessionStorage.setItem(GUEST_OPEN_KEY, isOpen ? "1" : "0");
    } catch {}
  }, [isOpen, isLoggedIn, isAdmin, authStatus]);

  // ── Post-login restore ──────────────────────────────────────────────────
  // When authStatus transitions unauthenticated → authenticated, restore guest chat
  useEffect(() => {
    const prev = prevAuthStatusRef.current;
    prevAuthStatusRef.current = authStatus;

    if (isAdmin) return; // admin drawer doesn't need guest restore
    if (prev === "authenticated" || authStatus !== "authenticated") return;

    // The user just logged in — check for a saved guest chat
    try {
      const raw = sessionStorage.getItem(GUEST_CHAT_KEY);
      const wasOpen = sessionStorage.getItem(GUEST_OPEN_KEY);

      sessionStorage.removeItem(GUEST_CHAT_KEY);
      sessionStorage.removeItem(GUEST_OPEN_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map((m) =>
            m.role === "assistant" && looksLikeHtml(m.content)
              ? { ...m, content: FALLBACK_CHAT_ERROR, failed: true }
              : m
          );
          // Avoid setting state synchronously in useEffect body
          setTimeout(() => setMessages(cleaned), 0);
          stickToBottomRef.current = true;
          // Avoid setting state synchronously in useEffect body
          setTimeout(() => setIsOpen(true), 0); // auto-open with restored history
          setTimeout(() => {
            showToast("✓ Welcome back! Your conversation has been restored.");
          }, 400);
          return;
        }
      }

      // No saved messages but the drawer was open — just reopen it
      if (wasOpen === "1") {
        // Avoid setting state synchronously in useEffect body
        setTimeout(() => setIsOpen(true), 0);
      }
    } catch {
      // sessionStorage unavailable or JSON parse error — open empty
      // Avoid setting state synchronously in useEffect body
      setTimeout(() => setIsOpen(true), 0);
    }
  }, [authStatus, isAdmin, showToast]);

  const closeDrawer = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setPendingDeleteId(null);
    setIsOpen(false);
  }, []);

  // Close drawer on route / query change; keep conversation messages intact
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    if (isOpen) {
      setIsLoading(false);
      setPendingDeleteId(null);
      setIsOpen(false);
    }
  }

  useEffect(() => {
    if (isOpen) return;
    if (!abortRef.current) return;
    abortRef.current.abort();
    abortRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingDeleteId) {
        setPendingDeleteId(null);
        return;
      }
      if (showHistory) {
        setShowHistory(false);
        return;
      }
      closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, showHistory, pendingDeleteId, closeDrawer]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!config.enableStoreOpenEvent) return;
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
  }, [config.enableStoreOpenEvent]);

  const displayProductHint = !isAdmin && pathname?.startsWith("/products/") ? productHint : null;

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
        content: looksLikeHtml(m.content) ? "[previous reply unavailable]" : m.content,
      }));

      const res = await fetch(config.chatUrl, {
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
        const raw = await res.text().catch(() => "");
        throw new Error(friendlyApiError(raw, res.status));
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") && !contentType.includes("application/json")) {
        const raw = await res.text().catch(() => "");
        throw new Error(friendlyApiError(raw, res.status || 500));
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
              errorText = parsedError.error || FALLBACK_CHAT_ERROR;
            } catch {
              // keep raw
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: sanitizeChatContent(errorText), failed: true }
                  : msg
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
            msg.id === assistantMessageId
              ? { ...msg, content: sanitizeChatContent(errMsg), failed: true }
              : msg
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
    <div className="flex h-full w-full flex-col bg-[#f8fafc]">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-border/70 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
          <History className="h-3.5 w-3.5 text-brand-500" />
          Chat history
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-neutral-muted hover:bg-white hover:text-neutral-900"
          onClick={() => setShowHistory(false)}
          aria-label="Close history"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2.5">
        <button
          type="button"
          onClick={() => {
            handleNewChat();
            setShowHistory(false);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition"
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
              onClick={closeDrawer}
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
                    onClick={() => {
                      void handleLoadSession(s.id);
                      setShowHistory(false);
                    }}
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
                      className="mt-0.5 rounded-md p-1 text-neutral-muted opacity-0 transition group-hover:opacity-100 hover:bg-status-error-bg hover:text-status-error-fg"
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

  const fabStyle =
    fabPos != null
      ? {
          position: "fixed" as const,
          left: fabPos.x,
          top: fabPos.y,
          right: "auto",
          bottom: "auto",
          transition: isFabDragging
            ? "none"
            : "left 280ms cubic-bezier(0.2, 0.8, 0.2, 1), top 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }
      : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 font-sans">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto absolute bottom-28 right-5 z-[60] flex max-w-[min(92vw,320px)] items-center gap-2.5 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-xs text-white shadow-xl sm:right-6 sm:text-sm"
        >
          <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {!isOpen && (
        <button
          ref={fabRef}
          type="button"
          id="open-product-chat"
          style={fabStyle}
          onClick={() => {
            if (suppressFabClickRef.current) {
              suppressFabClickRef.current = false;
              return;
            }
            setIsOpen(true);
          }}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onPointerCancel={onFabPointerUp}
          aria-label={config.dialogLabel}
          aria-expanded={false}
          className={cn(
            "pointer-events-auto flex h-12 cursor-grab touch-none select-none items-center justify-center gap-2.5 rounded-full bg-brand-500 px-3.5 text-white shadow-lg shadow-brand-500/30 transition-[color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-brand-300 sm:h-auto sm:py-3 sm:pl-3.5 sm:pr-4",
            fabPos == null ? "absolute bottom-4 right-4 sm:bottom-6 sm:right-6" : "absolute",
            isFabDragging && "cursor-grabbing hover:translate-y-0"
          )}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <Sparkles className="h-5 w-5 text-amber-200" />
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">
            {config.fabLabel}
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className="pointer-events-auto absolute bottom-4 right-4 flex h-[min(640px,78vh)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-neutral-border/80 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:bottom-6 sm:right-6 sm:w-[420px]"
          role="dialog"
          aria-modal="true"
          aria-label={config.dialogLabel}
        >
          <header className="flex shrink-0 items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-3 text-white sm:px-3.5">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="rounded-lg p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
              aria-label={showHistory ? "Hide history" : "Show history"}
              title="Chat history"
            >
              <History className="h-4 w-4" />
            </button>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
              <Bot className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-bold">{config.title}</h3>
                <span className="inline-flex items-center rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Online
                </span>
              </div>
              <p className="truncate text-[11px] text-brand-100">
                {statusHint
                  ? statusHint
                  : isLoading
                    ? config.loadingHint
                    : isLoggedIn
                      ? "History saved"
                      : "Guest · not saved"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-lg p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
              aria-label="New chat"
              title="New chat"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
              aria-label="Close"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col">
            {showHistory && (
              <div className="absolute inset-0 z-20 flex">
                <button
                  type="button"
                  className="absolute inset-0 bg-neutral-900/25"
                  aria-label="Dismiss history"
                  onClick={() => setShowHistory(false)}
                />
                <div className="relative z-10 h-full w-[min(100%,280px)] overflow-hidden border-r border-neutral-border/70 bg-[#f8fafc] shadow-xl animate-in slide-in-from-left-2 duration-200">
                  {historyPanel}
                </div>
              </div>
            )}

            {displayProductHint && (
              <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/70 px-3 py-2">
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
              className="relative min-h-0 flex-1 overflow-y-auto bg-gray-50/60 px-3 py-3"
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
                    <h4 className="text-base font-semibold text-neutral-900">
                      {config.emptyTitle}
                    </h4>
                    <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-neutral-muted sm:text-xs">
                      {config.emptySubtitle}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {config.quickPrompts.map((prompt) => (
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
                            "flex max-w-[92%] items-end gap-2",
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
                                {config.loadingHint}
                              </span>
                            ) : isUser || msg.failed ? (
                              <span className="whitespace-pre-wrap">
                                {msg.failed ? sanitizeChatContent(msg.content) : msg.content}
                              </span>
                            ) : (
                              <ChatMarkdown content={msg.content} onNavigate={closeDrawer} />
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

                        {!isUser &&
                          config.showProductMatches &&
                          msg.products &&
                          msg.products.length > 0 && (
                            <div className="mt-1.5 w-full pl-8">
                              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-muted">
                                <Tag className="h-3 w-3" />
                                Matches ({msg.products.length})
                              </p>
                              <ProductCarousel
                                products={msg.products.map(mapToChatbotProduct)}
                                onAction={appendProductActionMessages}
                              />
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

            <footer className="shrink-0 border-t border-neutral-border/70 bg-white p-3">
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
                  placeholder={config.placeholder}
                  className="max-h-[100px] min-h-[36px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-neutral-text placeholder:text-neutral-muted focus:outline-none"
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
                {config.footerNote}
              </p>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
