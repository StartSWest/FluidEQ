/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import type { TranslationKey } from '../../common/i18n';
import {
  clipboardHasText,
  copiedSomeText,
  insertAtCaret,
  readClipboardText,
  type TPasteField,
} from './clipboardText';

/** What a Paste control needs to draw itself and act. */
export interface IPasteIntoField {
  /** False only once the clipboard is known to hold no text. */
  hasText: boolean;
  /** Why the control is grey, or why the last press put nothing in. */
  noteKey: TranslationKey | undefined;
  /** Put the clipboard's text in at the field's caret. */
  paste: () => void;
  /**
   * For the control's `onMouseDown`: the field keeps the focus, and with it
   * the caret and the selection the paste goes into. A control that took
   * the focus would paste at the end.
   */
  keepFieldFocus: (event: MouseEvent) => void;
}

/**
 * A Paste control for a box whose text is meant to come from somewhere else
 * — lyrics, a preset, an EQ export (Ivan, 2026-11-22: "let's add a paste
 * button to actually paste"). It puts the clipboard's text in at the caret,
 * over the selection, as Ctrl+V would, so the box's own undo takes it back.
 *
 * Whether the clipboard holds text is asked of main when the control
 * appears, whenever the window comes forward (where anything copied
 * elsewhere arrives from) and when the box is focused, and it is known
 * without asking from a copy or cut inside the window. None of those
 * questions reads the text; only the press does.
 *
 * Shared by `PasteButton`, the app's quiet button, and by the surfaces that
 * draw their buttons in a face of their own (the Karaoke Maker's).
 */
const usePasteIntoField = (
  target: RefObject<TPasteField | null>,
): IPasteIntoField => {
  // Undefined until main answers, and where it cannot: the press then finds
  // out, rather than a control greyed by a question nobody answered.
  const [hasText, setHasText] = useState<boolean | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const check = useCallback(() => {
    clipboardHasText()
      .then((answer) => {
        setHasText(answer);
        return answer;
      })
      .catch(() => setHasText(undefined));
  }, []);

  useEffect(() => {
    check();
    const onCopied = () => {
      if (copiedSomeText()) {
        setHasText(true);
        setFailed(false);
      }
    };
    window.addEventListener('focus', check);
    document.addEventListener('copy', onCopied);
    document.addEventListener('cut', onCopied);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('copy', onCopied);
      document.removeEventListener('cut', onCopied);
    };
  }, [check]);

  useEffect(() => {
    const field = target.current;
    field?.addEventListener('focus', check);
    return () => field?.removeEventListener('focus', check);
  }, [target, check]);

  const paste = useCallback(() => {
    readClipboardText()
      .then((text) => {
        setFailed(false);
        if (text === '') {
          setHasText(false);
          return text;
        }
        setHasText(true);
        const field = target.current;
        if (field) {
          insertAtCaret(field, text);
        }
        return text;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it becomes "the clipboard couldn't be read"
        console.error('The clipboard could not be read for a paste', error);
        setFailed(true);
      });
  }, [target]);

  const keepFieldFocus = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  let noteKey: TranslationKey | undefined;
  if (failed) {
    noteKey = 'edit.paste.failed';
  } else if (hasText === false) {
    noteKey = 'edit.paste.empty';
  }

  return { hasText: hasText !== false, noteKey, paste, keepFieldFocus };
};

export default usePasteIntoField;
