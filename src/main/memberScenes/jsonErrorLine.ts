/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The line a text stops being JSON on, for the Code tab to mark in red
 * (`projectCodeDraft.ts`). `JSON.parse` no longer says where: the V8 the
 * app runs on words it as `Unexpected token ',', "<the text>" is not valid
 * JSON`, with no position or line in it (measured 2026-11-12). So the text is walked here by the
 * grammar itself, and the first character it cannot take is the place.
 *
 * Only where: whether the text is JSON at all is still `JSON.parse`'s to say.
 */

class Stop extends Error {
  constructor(readonly at: number) {
    super('not JSON');
  }
}

const WHITE = new Set([' ', '\t', '\n', '\r']);
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const ESCAPE = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/y;

/** Where the first character JSON cannot take is, or undefined when it is all JSON. */
export const jsonErrorOffset = (text: string): number | undefined => {
  let at = 0;
  const skip = () => {
    while (at < text.length && WHITE.has(text[at])) {
      at += 1;
    }
  };
  const expect = (char: string) => {
    if (text[at] !== char) {
      throw new Stop(at);
    }
    at += 1;
  };
  const string = () => {
    expect('"');
    while (at < text.length && text[at] !== '"') {
      if (text[at] === '\\') {
        ESCAPE.lastIndex = at;
        if (!ESCAPE.test(text)) {
          throw new Stop(at);
        }
        at = ESCAPE.lastIndex;
      } else if (text.charCodeAt(at) < 0x20) {
        throw new Stop(at);
      } else {
        at += 1;
      }
    }
    expect('"');
  };
  // Nesting is walked with an explicit stack, so no file is deep enough to
  // run the call stack out.
  const value = (): void => {
    const open: string[] = [];
    for (;;) {
      skip();
      const char = text[at];
      if (char === '{' || char === '[') {
        at += 1;
        skip();
        if (text[at] === (char === '{' ? '}' : ']')) {
          at += 1;
        } else {
          open.push(char);
          if (char === '{') {
            string();
            skip();
            expect(':');
          }
          // eslint-disable-next-line no-continue -- the opened value's first member is next
          continue;
        }
      } else if (char === '"') {
        string();
      } else if (text.startsWith('true', at)) {
        at += 4;
      } else if (text.startsWith('false', at)) {
        at += 5;
      } else if (text.startsWith('null', at)) {
        at += 4;
      } else {
        NUMBER.lastIndex = at;
        if (!NUMBER.test(text)) {
          throw new Stop(at);
        }
        at = NUMBER.lastIndex;
      }
      // A value has ended: the container it sits in goes on or closes.
      for (;;) {
        const inside = open[open.length - 1];
        if (inside === undefined) {
          return;
        }
        skip();
        if (text[at] === ',') {
          at += 1;
          if (inside === '{') {
            skip();
            string();
            skip();
            expect(':');
          }
          break;
        }
        expect(inside === '{' ? '}' : ']');
        open.pop();
      }
    }
  };
  try {
    value();
    skip();
    return at < text.length ? at : undefined;
  } catch (error) {
    if (error instanceof Stop) {
      return error.at;
    }
    throw error;
  }
};

/** The one-based line `jsonErrorOffset` falls on, or undefined. */
export const jsonErrorLine = (text: string): number | undefined => {
  const at = jsonErrorOffset(text);
  return at === undefined ? undefined : text.slice(0, at).split('\n').length;
};
