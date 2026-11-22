/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A box's Paste button (Ivan, 2026-11-22: "let's add a paste button to
 * actually paste"): the clipboard's text, read in main, goes in at the
 * caret over whatever is selected — as Ctrl+V puts it — and the field's own
 * `onChange` hears it. Grey, with a line saying why, while the clipboard
 * holds no text; and the question that greys it never reads the text.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import PasteButton from 'renderer/components/PasteButton';
import { insertAtCaret } from 'renderer/utils/clipboardText';
import { I18nProvider } from 'renderer/utils/I18nContext';

let clipboard = '';
let hasText: boolean = true;
const reads = jest.fn();

beforeEach(() => {
  clipboard = 'NEW';
  hasText = true;
  reads.mockClear();
  window.electron = {
    ipcRenderer: {
      clipboardHasText: async () => hasText,
      readClipboardText: async () => {
        reads();
        return clipboard;
      },
    },
  } as unknown as typeof window.electron;
});

/** A box the way the app's are: controlled, its value in React state. */
const Box = ({ initial }: { initial: string }) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <textarea
        ref={ref}
        aria-label="Lyrics"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <p data-testid="draft">{value}</p>
      <PasteButton target={ref} />
    </>
  );
};

const mount = async (initial: string) => {
  render(
    <I18nProvider>
      <Box initial={initial} />
    </I18nProvider>,
  );
  // Main's answer to "is there text?", asked as the button appears.
  await act(async () => undefined);
  return screen.getByLabelText('Lyrics') as HTMLTextAreaElement;
};

const pressPaste = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
  });
};

describe('the Paste button', () => {
  it('puts the clipboard’s text in at the caret, over the selection', async () => {
    const box = await mount('Hello world, again');
    box.setSelectionRange(6, 11);

    await pressPaste();

    expect(box.value).toBe('Hello NEW, again');
    // The field's own onChange heard it: the draft React keeps moved too.
    expect(screen.getByTestId('draft')).toHaveTextContent('Hello NEW, again');
  });

  it('inserts at a bare caret without touching the text around it', async () => {
    const box = await mount('ab');
    box.setSelectionRange(1, 1);

    await pressPaste();

    expect(box.value).toBe('aNEWb');
  });

  it('keeps the focus in the box, where the caret is', async () => {
    const box = await mount('x');
    // Focusing the box asks main again whether there is text.
    await act(async () => {
      box.focus();
    });
    const button = screen.getByRole('button', { name: 'Paste' });
    // The press itself must not move the focus to the button.
    const pressed = fireEvent.mouseDown(button);
    expect(pressed).toBe(false);
    expect(document.activeElement).toBe(box);
  });

  it('is grey and says why while the clipboard holds no text', async () => {
    hasText = false;
    await mount('');

    expect(screen.getByRole('button', { name: 'Paste' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'There is no text on the clipboard to paste.',
    );
    // Only the formats were asked about; the text was never read.
    expect(reads).not.toHaveBeenCalled();
  });

  it('comes back when the window does, with text copied elsewhere', async () => {
    hasText = false;
    await mount('');
    hasText = true;

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.getByRole('button', { name: 'Paste' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says so when a press finds the clipboard empty after all', async () => {
    clipboard = '';
    const box = await mount('kept');

    await pressPaste();

    expect(box.value).toBe('kept');
    expect(screen.getByRole('button', { name: 'Paste' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'There is no text on the clipboard to paste.',
    );
  });
});

describe('putting text in at the caret', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('goes through the editing command first, so undo takes it back', () => {
    const field = document.createElement('textarea');
    field.value = 'abc';
    document.body.append(field);
    field.setSelectionRange(1, 2);
    const command = jest.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: command,
    });
    const rangeText = jest.spyOn(field, 'setRangeText');

    insertAtCaret(field, 'Z');

    expect(command).toHaveBeenCalledWith('insertText', false, 'Z');
    // Positive control for the fallback below: not used when the command
    // did the insert.
    expect(rangeText).not.toHaveBeenCalled();
    field.remove();
  });

  it('falls back to the field’s own range where the command does nothing', () => {
    const field = document.createElement('textarea');
    field.value = 'abc';
    document.body.append(field);
    field.setSelectionRange(1, 2);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    });
    const rangeText = jest.spyOn(field, 'setRangeText');
    const heard = jest.fn();
    field.addEventListener('input', heard);

    insertAtCaret(field, 'Z');

    expect(field.value).toBe('aZc');
    expect(heard).toHaveBeenCalledTimes(1);
    // The caret after what went in, as a native paste leaves it: asked of
    // the field rather than read back, because jsdom 20 puts an `end`
    // selection at `start + value.length` instead of after the text.
    expect(rangeText).toHaveBeenCalledWith('Z', 1, 2, 'end');
    field.remove();
  });
});
