/**
 * Undo and Redo for a Code tab file being edited (the mockup Ivan approved on
 * 2026-11-11: "a draft until Save, with Undo and Redo").
 *
 * The textarea's own undo is not used: its value is set from the draft on
 * every change, which the browser's history does not survive, and a file
 * put back by Discard or loaded from an outside save has to be one step
 * like any other. A word typed is one step, not a letter each: a change
 * that adds or takes away one character, not a space or a line break, joins
 * the step before it when that step was the same kind of typing.
 */

export interface ICodeHistory {
  /** Every text the file has been, oldest first; `at` is the one shown. */
  texts: readonly string[];
  at: number;
  /** Whether the step at `at` is typing a later keystroke may join. */
  joinable: boolean;
}

/** The most steps kept: a long session's first edits fall away. */
export const MAX_STEPS = 200;

export const startHistory = (text: string): ICodeHistory => ({
  texts: [text],
  at: 0,
  joinable: false,
});

/** The one character a change typed or removed, when it was only that. */
const oneCharacter = (before: string, after: string): string | undefined => {
  const longer = after.length > before.length ? after : before;
  const shorter = longer === after ? before : after;
  if (longer.length - shorter.length !== 1) {
    return undefined;
  }
  let start = 0;
  while (start < shorter.length && shorter[start] === longer[start]) {
    start += 1;
  }
  return longer.slice(start + 1) === shorter.slice(start)
    ? longer[start]
    : undefined;
};

/** The history with `text` as its newest step; a redo after it is gone. */
export const recordText = (
  history: ICodeHistory,
  text: string,
): ICodeHistory => {
  const shown = history.texts[history.at];
  if (text === shown) {
    return history;
  }
  const typed = oneCharacter(shown, text);
  const isTyping = typed !== undefined && !/\s/.test(typed);
  const kept = history.texts.slice(0, history.at + 1);
  if (isTyping && history.joinable && history.at > 0) {
    kept[kept.length - 1] = text;
    return { texts: kept, at: kept.length - 1, joinable: true };
  }
  const texts = [...kept, text].slice(-MAX_STEPS);
  return { texts, at: texts.length - 1, joinable: isTyping };
};

export const canUndo = (history: ICodeHistory) => history.at > 0;
export const canRedo = (history: ICodeHistory) =>
  history.at < history.texts.length - 1;

export const undo = (history: ICodeHistory): ICodeHistory =>
  canUndo(history)
    ? { ...history, at: history.at - 1, joinable: false }
    : history;

export const redo = (history: ICodeHistory): ICodeHistory =>
  canRedo(history)
    ? { ...history, at: history.at + 1, joinable: false }
    : history;

export const shownText = (history: ICodeHistory) => history.texts[history.at];
