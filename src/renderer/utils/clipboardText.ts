/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const bridge = () => window.electron?.ipcRenderer;

/**
 * Whether the clipboard holds text, from main (`main/ipc/clipboardText.ts`),
 * which reads the formats on it and none of the text. Undefined where it
 * cannot be told: no bridge, or main refused.
 */
export const clipboardHasText = async (): Promise<boolean | undefined> => {
  const ask = bridge()?.clipboardHasText;
  if (ask === undefined) {
    return undefined;
  }
  try {
    return await ask();
  } catch {
    return undefined;
  }
};

/** The text on the clipboard, read in main; only ever on a press. */
export const readClipboardText = async (): Promise<string> => {
  const read = bridge()?.readClipboardText;
  if (read === undefined) {
    throw new Error('The clipboard bridge is not available');
  }
  return read();
};

/** A text box a Paste button can write into. */
export type TPasteField = HTMLTextAreaElement | HTMLInputElement;

/**
 * Text put in at the caret, over whatever is selected, the way a native
 * paste puts it: through the editing command, so the field's own undo
 * takes it back in one step and the page hears an ordinary `input`.
 *
 * `setRangeText` is the fallback where the command does nothing (a field
 * the document cannot edit, or a DOM without editing commands). It does not
 * reach the undo history, so it is never the first choice; the `input` it
 * dispatches is what a React field's `onChange` listens to.
 */
export const insertAtCaret = (field: TPasteField, text: string): void => {
  field.focus({ preventScroll: true });
  const inserted =
    typeof document.execCommand === 'function' &&
    document.execCommand('insertText', false, text);
  if (inserted) {
    return;
  }
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * Whether a `copy` or `cut` the document just heard put text on the
 * clipboard: the selection inside the focused field, or on the page.
 *
 * Read from the selection rather than asked of main because the clipboard is
 * written after the event, in another process; a question sent from the
 * event can be answered before the copy lands.
 */
export const copiedSomeText = (): boolean => {
  const active = document.activeElement;
  if (
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLInputElement
  ) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return end > start;
  }
  return (document.getSelection()?.toString() ?? '') !== '';
};
