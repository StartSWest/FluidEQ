/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import useModalKeys from '../../../renderer/utils/useModalKeys';

const onCancel = jest.fn();

/** A dialog with a button between its first and last that may be skipped. */
function Dialog({ skipped }: { skipped: boolean }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useModalKeys(surfaceRef, firstRef, { busy: false, onCancel });
  return (
    <div ref={surfaceRef} role="dialog">
      <button ref={firstRef} type="button">
        first
      </button>
      <button type="button" tabIndex={skipped ? -1 : undefined}>
        thumbnail
      </button>
      <button type="button">last</button>
    </div>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

/**
 * Tab as the dialog sees it. A raw key event rather than `userEvent.tab`,
 * which moves focus by itself and skips `tabindex="-1"` on its own — it would
 * pass with the trap doing nothing. Whether the event was refused says the
 * trap, not the browser, moved focus.
 */
const tab = (shiftKey = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'Tab',
    shiftKey,
  });

it('stops Tab at every enabled button', () => {
  render(<Dialog skipped={false} />);
  expect(button('first')).toHaveFocus();
  expect(tab()).toBe(false);
  expect(button('thumbnail')).toHaveFocus();
  tab();
  expect(button('last')).toHaveFocus();
});

it('skips a button taken out of the Tab order, both ways round', () => {
  render(<Dialog skipped />);
  expect(button('first')).toHaveFocus();
  expect(tab()).toBe(false);
  expect(button('last')).toHaveFocus();
  tab();
  expect(button('first')).toHaveFocus();
  tab(true);
  expect(button('last')).toHaveFocus();
  tab(true);
  expect(button('first')).toHaveFocus();
});

/** A dialog holding every other kind of stop a form can have. */
function Form() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useModalKeys(surfaceRef, firstRef, { busy: false, onCancel });
  return (
    <div ref={surfaceRef} role="dialog">
      <button ref={firstRef} type="button">
        first
      </button>
      <a href="https://fluideq.example/licence">licence</a>
      <select aria-label="size">
        <option>small</option>
      </select>
      <textarea aria-label="notes" />
      <button type="button" disabled>
        off
      </button>
    </div>
  );
}

// Left out, the publish dialog's description could not be reached from the
// keyboard, and About's links were skipped.
it('stops Tab at links, lists and text areas too', () => {
  render(<Form />);
  expect(tab()).toBe(false);
  expect(screen.getByRole('link', { name: 'licence' })).toHaveFocus();
  tab();
  expect(screen.getByRole('combobox', { name: 'size' })).toHaveFocus();
  tab();
  expect(screen.getByRole('textbox', { name: 'notes' })).toHaveFocus();
  tab();
  expect(button('first')).toHaveFocus();
});

function Cancelling({ cancel }: { cancel: () => void }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useModalKeys(surfaceRef, firstRef, { busy: false, onCancel: cancel });
  return (
    <div ref={surfaceRef} role="dialog">
      <button ref={firstRef} type="button">
        first
      </button>
    </div>
  );
}

it('cancels through the newest handler, and gives focus back on the way out', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const first = jest.fn();
  const newest = jest.fn();
  const view = render(<Cancelling cancel={first} />);
  view.rerender(<Cancelling cancel={newest} />);
  expect(button('first')).toHaveFocus();
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'Escape',
  });
  expect(first).not.toHaveBeenCalled();
  expect(newest).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});
