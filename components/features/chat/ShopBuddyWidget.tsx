"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Bot, MessageCircle, Minimize2, RefreshCw, Send, Trash2, X } from "lucide-react";

import type { ChatbotProduct, ChatbotResponse } from "@/lib/chatbot/types";

import { ProductCarousel } from "./ProductCarousel";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  type?: ChatbotResponse["type"];
  products?: ChatbotProduct[];
  quickReplies?: string[];
  isError?: boolean;
}

let messageIdSeq = 0;

function nextMessageId(prefix: string): string {
  messageIdSeq += 1;
  return `${prefix}-${messageIdSeq}`;
}

function formatChatTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: "welcome-1",
  sender: "bot",
  text: "Hello! I'm ShopBuddy, your personal shopping assistant. Looking for something specific, or would you like to explore popular items?",
  timestamp: "",
  type: "small_talk",
  quickReplies: [
    "Watches under $150",
    "Running sneakers",
    "Cotton t-shirts",
    "What is your return policy?",
  ],
};

export function ShopBuddyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize unique session ID and load from local storage
  useEffect(() => {
    let sid = localStorage.getItem("shopbuddy_session_id");
    if (!sid) {
      sid = `sb_sess_${nextMessageId("sess")}`;
      localStorage.setItem("shopbuddy_session_id", sid);
    }
    // Avoid setting state synchronously in useEffect body
    setTimeout(() => setSessionId(sid), 0);

    const saved = localStorage.getItem("shopbuddy_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Avoid setting state synchronously in useEffect body
          setTimeout(() => setMessages(parsed), 0);
        }
      } catch {
        // use default
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("shopbuddy_chat_history", JSON.stringify(messages));
      } catch {
        // storage quota exceeded or disabled
      }
    }
  }, [messages]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isTyping, scrollToBottom]);

  // Toast banner dismiss
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    localStorage.removeItem("shopbuddy_chat_history");
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMessage: Message = {
      id: nextMessageId("user"),
      sender: "user",
      text,
      timestamp: formatChatTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const response = await fetch("/api/store-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          message: text,
          sessionId,
          history: historyPayload,
        }),
      });

      const data: ChatbotResponse = await response.json();

      const botMessage: Message = {
        id: nextMessageId("bot"),
        sender: "bot",
        text: data.message || "Here is what I found for you.",
        timestamp: formatChatTimestamp(),
        type: data.type,
        products: data.products,
        quickReplies: data.quick_replies,
        isError: data.type === "error",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const errorMessage: Message = {
        id: nextMessageId("bot-err"),
        sender: "bot",
        text: "I'm having trouble connecting right now. Please check your internet connection or click retry below.",
        timestamp: formatChatTimestamp(),
        type: "error",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <aside
      aria-label="ShopBuddy shopping assistant"
      className="fixed bottom-5 right-5 z-50 font-sans"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-200 border border-gray-700"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open ShopBuddy Shopping Chat"
          aria-expanded={isOpen}
          className="relative group flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold tracking-wide hidden sm:inline">
            Ask ShopBuddy
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="w-[92vw] sm:w-[410px] md:w-[440px] h-[580px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="ShopBuddy Shopping Assistant Window"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold">ShopBuddy</h3>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500 text-white">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-blue-100">Verified Catalog & Cart Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear conversation"
                aria-label="Clear conversation history"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                aria-label="Minimize shopping chat"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close shopping chat"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-200"
            role="log"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : msg.isError
                        ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-xs"
                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Retry Action for errors */}
                  {msg.isError && (
                    <button
                      type="button"
                      onClick={() => {
                        const lastUserMsg = [...messages]
                          .reverse()
                          .find((m) => m.sender === "user");
                        if (lastUserMsg) sendMessage(lastUserMsg.text);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-100/70 px-2 py-1 rounded"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry query
                    </button>
                  )}
                </div>

                {/* Message Timestamp */}
                <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>

                {/* Recommended Product Carousel */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full mt-2">
                    <ProductCarousel
                      products={msg.products}
                      onAddToCartSuccess={(name, qty) =>
                        showToast(`Added ${qty}x "${name}" to your cart!`)
                      }
                      onAddToCartError={(err) => showToast(`Cart Error: ${err}`)}
                    />
                  </div>
                )}

                {/* Quick Reply Suggestions */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.quickReplies.map((reply, idx) => (
                      <button
                        key={`${msg.id}-reply-${idx}`}
                        type="button"
                        onClick={() => sendMessage(reply)}
                        className="text-[11px] font-medium bg-white hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 text-gray-700 border border-gray-200 rounded-full px-2.5 py-1 transition-colors shadow-2xs"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-2xl rounded-bl-xs px-3.5 py-2.5 w-fit shadow-xs">
                <span className="text-xs text-gray-500 font-medium">ShopBuddy is searching</span>
                <span className="flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about products, orders, shipping..."
                maxLength={500}
                disabled={isTyping}
                aria-label="Type your shopping question"
                className="flex-1 bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || isTyping}
                aria-label="Send message"
                className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-lg transition-colors focus:outline-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-1 px-1 text-[10px] text-gray-400">
              <span>Powered by real catalog data</span>
              <span>{inputMessage.length}/500</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
