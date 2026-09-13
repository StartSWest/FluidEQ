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
