/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import StudioChatCopy from './StudioChatCopy';

/**
 * Claude's words as a chat shows them. Claude writes a little Markdown even
 * when asked for plain sentences — paragraphs, a list, **bold**, `code`, a
 * fenced block of code — and printed raw that is asterisks and backticks in
 * the member's chat. Those five are drawn; nothing else is interpreted, and
 * everything stays text: no HTML from a reply ever reaches the page.
 */

const inline = (text: string, key: string): ReactNode[] =>
  text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => {
    const id = `${key}-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={id}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={id}>{part.slice(1, -1)}</code>;
    }
    return part;
  });

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Words between code blocks: paragraphs and lists, split on blank lines. */
const prose = (text: string, key: string): ReactNode[] =>
  text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const id = `${key}-${index}`;
      const lines = block.split('\n');
      if (lines.every((line) => LIST_ITEM.test(line))) {
        return (
          <ul key={id}>
            {lines.map((line, at) => (
              // eslint-disable-next-line react/no-array-index-key -- a reply's lines have no identity but their place, and a reply only grows at its end
              <li key={at}>
                {inline(line.replace(LIST_ITEM, ''), `${id}-${at}`)}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={id}>
          {lines.map((line, at) => (
            // eslint-disable-next-line react/no-array-index-key -- as above: a line is its place in the paragraph
            <span key={at}>
              {at > 0 && <br />}
              {inline(line.replace(/^#{1,6}\s+/, ''), `${id}-${at}`)}
            </span>
          ))}
        </p>
      );
    });

/**
 * A fenced block (```js … ```), whole: blank lines inside it stay in it.
 * One still being written has no closing fence yet and runs to the end, so
 * a block streams in as a block rather than as paragraphs that jump into
 * one when it closes.
 */
const FENCE = /^```([^\n`]*)\n([\s\S]*?)(?:^```[ \t]*$|(?![\s\S]))/gm;

/**
 * Code as the member copies it (Ivan, 2026-11-07: "add formatted block on
 * chat like for copying"): its language over it, the copy button beside,
 * the lines as written, scrolled sideways rather than wrapped.
 */
function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <figure className="studio-chat__code">
      <figcaption>
        <span>{language}</span>
        <StudioChatCopy text={code} />
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export default function ChatText({ text }: { text: string }) {
  const source = text.replace(/\r/g, '');
  const parts: ReactNode[] = [];
  let at = 0;
  let index = 0;
  [...source.matchAll(FENCE)].forEach((match) => {
    const start = match.index ?? 0;
    parts.push(...prose(source.slice(at, start), `t${index}`));
    const code = match[2].replace(/\n$/, '');
    if (code.trim()) {
      parts.push(
        <CodeBlock key={`c${index}`} language={match[1].trim()} code={code} />,
      );
    }
    at = start + match[0].length;
    index += 1;
  });
  parts.push(...prose(source.slice(at), `t${index}`));
  return parts;
}
