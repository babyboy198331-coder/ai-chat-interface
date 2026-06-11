"use client";

import { useState } from "react";

/* ── Lightweight zero-dependency markdown renderer ──
   Supports: ```fenced code blocks```, `inline code`,
   **bold**, *italic*, [links](url), # headings, - lists, 1. lists */

function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={copy}
      className={`text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
        copied
          ? "text-emerald-400"
          : "text-neutral-400 hover:text-white hover:bg-white/10"
      } ${className}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ lang, code }) {
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-neutral-700/60 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-neutral-700/60">
        <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
          {lang || "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="font-mono text-[#e6edf3]">{code}</code>
      </pre>
    </div>
  );
}

/* Inline tokens: `code`, **bold**, *italic*, [text](url) */
function renderInline(text, keyPrefix = "") {
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/g;
  const parts = [];
  let last = 0;
  let match;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("`")) {
      parts.push(
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/10 font-mono text-[0.85em] text-cyan-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={key} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("[")) {
      const m = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      parts.push(
        <a
          key={key}
          href={m[2]}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
        >
          {m[1]}
        </a>
      );
    } else {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* Block-level rendering for a non-code text segment */
function renderTextBlock(text, keyPrefix) {
  const lines = text.split("\n");
  const out = [];
  let listItems = null;
  let listOrdered = false;

  const flushList = (key) => {
    if (!listItems) return;
    const Tag = listOrdered ? "ol" : "ul";
    out.push(
      <Tag
        key={key}
        className={`my-2 ml-5 space-y-1 ${listOrdered ? "list-decimal" : "list-disc"}`}
      >
        {listItems}
      </Tag>
    );
    listItems = null;
  };

  lines.forEach((line, idx) => {
    const key = `${keyPrefix}-l${idx}`;
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)/);
    const heading = line.match(/^(#{1,4})\s+(.*)/);

    if (bullet || ordered) {
      const content = (bullet || ordered)[1];
      if (!listItems || listOrdered !== Boolean(ordered)) {
        flushList(`${key}-flush`);
        listItems = [];
        listOrdered = Boolean(ordered);
      }
      listItems.push(<li key={key}>{renderInline(content, key)}</li>);
      return;
    }

    flushList(`${key}-flush`);

    if (heading) {
      const level = heading[1].length;
      const sizes = {
        1: "text-xl font-bold mt-4 mb-2",
        2: "text-lg font-bold mt-3 mb-2",
        3: "text-base font-semibold mt-3 mb-1",
        4: "text-sm font-semibold mt-2 mb-1",
      };
      out.push(
        <p key={key} className={sizes[level]}>
          {renderInline(heading[2], key)}
        </p>
      );
      return;
    }

    if (line.trim() === "") {
      out.push(<div key={key} className="h-2" />);
      return;
    }

    out.push(
      <p key={key} className="leading-relaxed">
        {renderInline(line, key)}
      </p>
    );
  });

  flushList(`${keyPrefix}-finalflush`);
  return out;
}

export default function Markdown({ content }) {
  // Split on fenced code blocks first
  const segments = content.split(/(```[\s\S]*?(?:```|$))/g);

  return (
    <div className="text-sm">
      {segments.map((seg, i) => {
        if (seg.startsWith("```")) {
          const body = seg.replace(/```$/, "").slice(3);
          const newline = body.indexOf("\n");
          const lang = newline === -1 ? "" : body.slice(0, newline).trim();
          const code = newline === -1 ? body : body.slice(newline + 1);
          return <CodeBlock key={i} lang={lang} code={code.replace(/\n$/, "")} />;
        }
        return seg ? <div key={i}>{renderTextBlock(seg, `s${i}`)}</div> : null;
      })}
    </div>
  );
}

export { CopyButton };
