"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type ChatMarkdownProps = {
  content: string;
  className?: string;
};

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={cn("chat-md text-[12px] leading-relaxed sm:text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          a: ({ href, children }) => {
            const url = href || "#";
            const isInternal = url.startsWith("/");
            if (isInternal) {
              return (
                <Link
                  href={url}
                  className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
              >
                {children}
              </a>
            );
          },
          h1: ({ children }) => (
            <p className="mb-1.5 text-sm font-bold text-neutral-900">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-1.5 text-sm font-bold text-neutral-900">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mb-1 text-xs font-bold text-neutral-900 sm:text-sm">{children}</p>
          ),
          hr: () => <hr className="my-2 border-neutral-border/70" />,
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-neutral-bg p-2 text-[11px] text-neutral-800">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-neutral-bg px-1 py-0.5 text-[11px] text-neutral-800">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-lg bg-neutral-bg p-2 last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full min-w-[220px] border-collapse text-left text-[11px] sm:text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-neutral-bg">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-neutral-border/60 last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1.5 font-semibold text-neutral-900">{children}</th>
          ),
          td: ({ children }) => <td className="px-2 py-1.5 text-neutral-text">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-brand-500/40 pl-2 text-neutral-muted last:mb-0">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
