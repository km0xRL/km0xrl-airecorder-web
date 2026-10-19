"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-ink-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: value }) => (
            <h1 className="mt-7 font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{value}</h1>
          ),
          h2: ({ children: value }) => (
            <h2 className="mt-7 font-display text-[18px] font-medium tracking-[-0.015em] text-ink">{value}</h2>
          ),
          h3: ({ children: value }) => (
            <h3 className="mt-5 font-display text-[15px] font-medium text-ink">{value}</h3>
          ),
          p: ({ children: value }) => (
            <p className="mt-3 text-[13.5px] leading-[1.75] text-ink-700">{value}</p>
          ),
          ul: ({ children: value }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-[1.7]">{value}</ul>,
          ol: ({ children: value }) => (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-[1.7]">{value}</ol>
          ),
          li: ({ children: value }) => <li className="pl-0.5">{value}</li>,
          strong: ({ children: value }) => <strong className="font-medium text-ink">{value}</strong>,
          em: ({ children: value }) => <em className="italic">{value}</em>,
          a: ({ children: value, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-orange-text underline decoration-orange/30 underline-offset-2 hover:decoration-orange"
            >
              {value}
            </a>
          ),
          blockquote: ({ children: value }) => (
            <blockquote className="mt-4 border-l-2 border-orange/50 bg-orange-tint/50 py-2 pl-4 text-[13px] italic text-ink-500">
              {value}
            </blockquote>
          ),
          code: ({ children: value, className }) => {
            const isBlock = Boolean(className);
            if (isBlock) return <code className="font-mono text-[12px]">{value}</code>;
            return <code className="mono rounded bg-sunken px-1.5 py-0.5 text-[12px] text-ink-700">{value}</code>;
          },
          pre: ({ children: value }) => (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-[12px] leading-relaxed text-white">{value}</pre>
          ),
          table: ({ children: value }) => (
            <div className="mt-4 overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full border-collapse text-left text-[12.5px]">{value}</table>
            </div>
          ),
          th: ({ children: value }) => (
            <th className="border-b border-hairline bg-sunken/60 px-3 py-2 font-medium text-ink">{value}</th>
          ),
          td: ({ children: value }) => <td className="border-b border-hairline px-3 py-2 text-ink-600">{value}</td>,
          hr: () => <hr className="my-6 border-hairline" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
