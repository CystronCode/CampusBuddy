"use client";

import React, { useMemo } from "react";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className = "chat-answer" }: MarkdownViewProps) {
  const rendered = useMemo(() => {
    if (!content) return null;
    return parseMarkdown(content);
  }, [content]);

  return <div className={`markdown-content ${className}`}>{rendered}</div>;
}

/**
 * Parses markdown text into React elements.
 * Handles headings, code blocks, blockquotes, ordered/unordered lists, and paragraphs.
 */
function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let index = 0;

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];

  let currentListType: "ul" | "ol" | null = null;
  let currentListItems: React.ReactNode[] = [];

  function flushList() {
    if (currentListType && currentListItems.length > 0) {
      if (currentListType === "ul") {
        elements.push(
          <ul key={`ul-${index++}`} className="chat-ul">
            {currentListItems.map((item, i) => (
              <li key={i} className="chat-li">
                {item}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${index++}`} className="chat-ol">
            {currentListItems.map((item, i) => (
              <li key={i} className="chat-li">
                {item}
              </li>
            ))}
          </ol>
        );
      }
      currentListType = null;
      currentListItems = [];
    }
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    // 1. Code blocks (```lang ... ```)
    if (trimmed.startsWith("```")) {
      flushList();
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <div key={`code-${index++}`} className="chat-code-wrapper">
            {codeBlockLang && <div className="chat-code-lang">{codeBlockLang}</div>}
            <pre className="chat-code-block">
              <code>{codeBlockLines.join("\n")}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 2. Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // 3. Headings (#, ##, ###, ####)
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const textContent = match[2];
        const parsedInline = parseInline(textContent);

        if (level === 1) {
          elements.push(
            <h2 key={`h1-${index++}`} className="chat-h2">
              {parsedInline}
            </h2>
          );
        } else if (level === 2) {
          elements.push(
            <h3 key={`h2-${index++}`} className="chat-h3">
              {parsedInline}
            </h3>
          );
        } else {
          elements.push(
            <h4 key={`h-${level}-${index++}`} className="chat-h4">
              {parsedInline}
            </h4>
          );
        }
        continue;
      }
    }

    // 4. Blockquotes (> ...)
    if (trimmed.startsWith(">")) {
      flushList();
      const quoteText = trimmed.replace(/^>\s?/, "");
      elements.push(
        <blockquote key={`quote-${index++}`} className="chat-quote">
          {parseInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered list (- ... or * ...)
    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (currentListType !== "ul") {
        flushList();
        currentListType = "ul";
      }
      currentListItems.push(parseInline(ulMatch[1]));
      continue;
    }

    // 6. Ordered list (1. ... or 2. ...)
    const olMatch = trimmed.match(/^\d+[\.\)]\s+(.*)$/);
    if (olMatch) {
      if (currentListType !== "ol") {
        flushList();
        currentListType = "ol";
      }
      currentListItems.push(parseInline(olMatch[1]));
      continue;
    }

    // Regular line / paragraph
    flushList();

    // Check if line is a category line like "**Lunch**: ..." or "**Snacks**: ..."
    const isCategoryLead = /^\*\*([^*]+)\*\*:\s*(.*)$/.test(trimmed);

    elements.push(
      <p
        key={`p-${index++}`}
        className={`chat-p ${isCategoryLead ? "chat-category-lead" : ""}`}
      >
        {parseInline(rawLine)}
      </p>
    );
  }

  flushList();

  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre key={`code-${index++}`} className="chat-code-block">
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
  }

  return elements;
}

/**
 * Parses inline markdown:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Code: `code`
 * - Links: [label](url)
 * - Source citations: [Source | Section | Page]
 */
function parseInline(text: string): React.ReactNode[] {
  if (!text) return [];

  // Combined token regex:
  // 1. Bold: \*\*([^*]+)\*\*
  // 2. Inline code: `([^`]+)`
  // 3. Link: \[([^\]]+)\]\(([^)]+)\)
  // 4. Citation pill: \[([^\]|]+(?:\|[^\]]+)+)\]
  // 5. Italic: \*([^*]+)\*
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\[([^\]|]+(?:\|[^\]]+)+)\]|\*([^*]+)\*)/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  let keyIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];

    if (fullMatch.startsWith("**") && fullMatch.endsWith("**")) {
      // Bold
      const boldText = match[2];
      result.push(
        <strong key={`bold-${keyIndex++}`} className="chat-bold">
          {boldText}
        </strong>
      );
    } else if (fullMatch.startsWith("`") && fullMatch.endsWith("`")) {
      // Code
      const codeText = match[3];
      result.push(
        <code key={`code-${keyIndex++}`} className="chat-inline-code">
          {codeText}
        </code>
      );
    } else if (match[4] && match[5]) {
      // Link
      const linkLabel = match[4];
      const linkUrl = match[5];
      result.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-link"
        >
          {linkLabel}
        </a>
      );
    } else if (match[6]) {
      // Citation pill like [Campus Faculty | Section: Live Records | Page 1]
      const citationText = match[6];
      result.push(
        <span key={`cite-${keyIndex++}`} className="chat-citation-pill">
          {citationText}
        </span>
      );
    } else if (fullMatch.startsWith("*") && fullMatch.endsWith("*")) {
      // Italic
      const italicText = match[7];
      result.push(
        <em key={`em-${keyIndex++}`} className="chat-italic">
          {italicText}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  // Push remainder
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
