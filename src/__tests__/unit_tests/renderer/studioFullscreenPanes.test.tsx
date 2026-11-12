/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's full screen with its work in it (Ivan, 2026-11-11: "a toggle
 * bottom pane for tune, code etc", "the chat with a collapsible"): the two
 * buttons on the full-screen plate, Ctrl+J and Ctrl+L heard only while the
 * screen is full, what is kept for the next full screen, and the pane's
 * edge and the chat's tab.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import StudioFullscreenPanes from '../../../renderer/studio/StudioFullscreenPanes';
import StudioStageControls from '../../../renderer/studio/StudioStageControls';
import useFullscreenPanes, {
  PANE_DEFAULT,
  PANE_LEAST,
  PANE_MOST,
  readKeptPanes,
} from '../../../renderer/studio/useFullscreenPanes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  window.localStorage.clear();
});

const press = (key: string, more: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key, ctrlKey: true, ...more }),
    );
  });

describe('the panes in full screen', () => {
  it('both start out, the pane at two fifths of the screen', () => {
    const { result } = renderHook(() => useFullscreenPanes(true));
    expect(result.current).toMatchObject({
      pane: true,
      chat: true,
      height: PANE_DEFAULT,
    });
  });

  it('come and go on Ctrl+J and Ctrl+L, only while the screen is full', () => {
    const { result, rerender } = renderHook(
      ({ full }) => useFullscreenPanes(full),
      { initialProps: { full: false } },
    );
    press('j');
    press('l');
    expect(result.current).toMatchObject({ pane: true, chat: true });
    rerender({ full: true });
    press('j');
    expect(result.current.pane).toBe(false);
    press('l');
    expect(result.current.chat).toBe(false);
    // Another key, or one held with Shift, is not theirs.
    press('k');
    press('j', { shiftKey: true });
    expect(result.current).toMatchObject({ pane: false, chat: false });
  });

  it('are kept for the next full screen, the height held to its range', () => {
    const first = renderHook(() => useFullscreenPanes(true));
    act(() => first.result.current.toggleChat());
    act(() => first.result.current.setHeight(0.95));
    first.unmount();
    const next = renderHook(() => useFullscreenPanes(true));
    expect(next.result.current).toMatchObject({
      chat: false,
      height: PANE_MOST,
    });
    act(() => next.result.current.setHeight(0.01));
    expect(next.result.current.height).toBe(PANE_LEAST);
  });

  it('read nothing they did not keep', () => {
    expect(readKeptPanes(null)).toEqual({
      pane: true,
      chat: true,
      height: PANE_DEFAULT,
    });
    expect(readKeptPanes('{ "pane": fal')).toEqual(readKeptPanes(null));
    expect(readKeptPanes('{"pane":"no","height":"tall"}')).toEqual(
      readKeptPanes(null),
    );
    expect(readKeptPanes('{"pane":false,"height":0.5}')).toMatchObject({
      pane: false,
      height: 0.5,
    });
  });
});

describe('the full-screen plate', () => {
  const controls = (
    panes?: Parameters<typeof StudioStageControls>[0]['panes'],
  ) =>
    render(
      <StudioStageControls
        isFullscreen
        onFullscreen={jest.fn()}
        preview="stage"
        onPreview={jest.fn()}
        hasPlayerParts={false}
        onPlayerParts={jest.fn()}
        panes={panes}
      />,
    );

  it('offers the work pane and the chat, pressed while they are out', () => {
    const onPane = jest.fn();
    const onChat = jest.fn();
    controls({ pane: true, chat: false, onPane, onChat });
    const pane = screen.getByRole('button', { name: 'studio.size.workPane' });
    const chat = screen.getByRole('button', { name: 'studio.size.chat' });
    expect(pane).toHaveAttribute('aria-pressed', 'true');
    expect(chat).toHaveAttribute('aria-pressed', 'false');
    expect(pane).toHaveAttribute('title', expect.stringContaining('Ctrl+J'));
    fireEvent.click(pane);
    fireEvent.click(chat);
    expect(onPane).toHaveBeenCalledTimes(1);
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it('offers neither in the window, where both have their own place', () => {
    controls();
    expect(
      screen.queryByRole('button', { name: 'studio.size.workPane' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'studio.size.chat' }),
    ).toBeNull();
  });
});

describe("the pane's edge and the chat's tab", () => {
  const panes = ({
    pane = true,
    chat = true,
    hasChatColumn = true,
  }: {
    pane?: boolean;
    chat?: boolean;
    hasChatColumn?: boolean;
  }) => {
    const grid = document.createElement('div');
    const onHeight = jest.fn();
    const onChat = jest.fn();
    render(
      <StudioFullscreenPanes
        gridRef={{ current: grid }}
        pane={pane}
        chat={chat}
        hasChatColumn={hasChatColumn}
        height={0.4}
        onHeight={onHeight}
        onChat={onChat}
      />,
    );
    return { onHeight, onChat };
  };

  it('moves the pane a step with the arrow keys', () => {
    const { onHeight } = panes({});
    const edge = screen.getByRole('separator', {
      name: 'studio.size.workPaneHeight',
    });
    expect(edge).toHaveAttribute('aria-valuenow', '40');
    fireEvent.keyDown(edge, { key: 'ArrowUp' });
    fireEvent.keyDown(edge, { key: 'ArrowDown' });
    expect(
      onHeight.mock.calls.map(([share]) => Number(share.toFixed(2))),
    ).toEqual([0.45, 0.35]);
  });

  it('has no edge while the pane is away', () => {
    panes({ pane: false });
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('folds the chat and brings it back from its tab', () => {
    const { onChat } = panes({ chat: false });
    const tab = screen.getByRole('button', { name: 'studio.size.chat' });
    expect(tab).toHaveAttribute('aria-expanded', 'false');
    expect(tab).toHaveTextContent('studio.size.chat');
    fireEvent.click(tab);
    expect(onChat).toHaveBeenCalled();
  });

  it('has no chat tab where the chat is one of the work pane’s tabs', () => {
    panes({ hasChatColumn: false });
    expect(
      screen.queryByRole('button', { name: 'studio.size.chat' }),
    ).toBeNull();
  });
});
