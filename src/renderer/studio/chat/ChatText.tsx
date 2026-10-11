/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';

/**
 * Claude's words as a chat shows them. Claude writes a little Markdown even
 * when asked for plain sentences — paragraphs, a list, **bold**, `code` — and
 * printed raw that is asterisks and backticks in the member's chat. Those
 * four are drawn; nothing else is interpreted, and everything stays text:
 * no HTML from a reply ever reaches the page.
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

export default function ChatText({ text }: { text: string }) {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        const lines = block.split('\n');
        if (lines.every((line) => LIST_ITEM.test(line))) {
          return (
            <ul key={key}>
              {lines.map((line, at) => (
                // eslint-disable-next-line react/no-array-index-key -- a reply's lines have no identity but their place, and a reply only grows at its end
                <li key={at}>
                  {inline(line.replace(LIST_ITEM, ''), `${key}-${at}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key}>
            {lines.map((line, at) => (
              // eslint-disable-next-line react/no-array-index-key -- as above: a line is its place in the paragraph
              <span key={at}>
                {at > 0 && <br />}
                {inline(line.replace(/^#{1,6}\s+/, ''), `${key}-${at}`)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}
