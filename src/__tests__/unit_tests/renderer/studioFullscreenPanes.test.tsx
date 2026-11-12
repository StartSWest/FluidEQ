/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's full screen with its work in it (Ivan, 2026-11-11: "a toggle
 * bottom pane for tune, code etc", "the chat with a collapsible"): the two
 * buttons on the full-screen plate, Ctrl+J and Ctrl+L heard only while the
 * screen is full, what is kept for the next full screen, the pane's edge,
 * and each pane's own button that puts it away (Ivan, 2026-11-12).
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import StudioChatColumn from '../../../renderer/studio/chat/StudioChatColumn';
import StudioFullscreenPanes from '../../../renderer/studio/StudioFullscreenPanes';
import StudioStageControls from '../../../renderer/studio/StudioStageControls';
import StudioWorkTabs from '../../../renderer/studio/StudioWorkTabs';
import useFullscreenPanes, {
  PANE_DEFAULT,
  PANE_LEAST,
  PANE_MOST,
  readKeptPanes,
} from '../../../renderer/studio/useFullscreenPanes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The chat itself stands in as its fold button alone: what the column does
// with that button is what is tested here.
jest.mock('../../../renderer/studio/chat/StudioChat', () => ({
  __esModule: true,
  default: ({ onFold }: { onFold?: () => void }) => (
    <button type="button" onClick={onFold}>
      fold
    </button>
  ),
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

describe("the pane's edge", () => {
  const panes = ({
    pane = true,
    hasChatColumn = true,
  }: {
    pane?: boolean;
    hasChatColumn?: boolean;
  }) => {
    const grid = document.createElement('div');
    const onHeight = jest.fn();
    render(
      <StudioFullscreenPanes
        gridRef={{ current: grid }}
        pane={pane}
        hasChatColumn={hasChatColumn}
        height={0.4}
        onHeight={onHeight}
      />,
    );
    return { onHeight };
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

  // Ivan, 2026-11-12: "quita la cosa fea que pusiste en el centro para
  // colapsar el chat en full screen".
  it('lays no tab of its own on the chat’s edge', () => {
    panes({});
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe("the pane's own hide button", () => {
  const tabs = (end?: ReactNode) =>
    render(
      <StudioWorkTabs
        label="work"
        tabs={[
          { id: 'tune', label: 'Tune' },
          { id: 'pictures', label: 'Pictures', pinned: true },
        ]}
        selected="tune"
        onSelect={jest.fn()}
        end={end}
      >
        <p>panel</p>
      </StudioWorkTabs>,
    );

  it('stands at the row’s end, after every tab, outside the tablist', () => {
    const onHide = jest.fn();
    tabs(
      <button type="button" onClick={onHide}>
        hide
      </button>,
    );
    const hide = screen.getByRole('button', { name: 'hide' });
    const row = hide.closest('.studio-work__tab-row');
    expect(row?.lastElementChild).toContainElement(hide);
    expect(screen.getByRole('tablist')).not.toContainElement(hide);
    fireEvent.click(hide);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('leaves the row as it was where there is none', () => {
    const { container } = tabs();
    expect(container.querySelector('.studio-work__end')).toBeNull();
  });
});

describe("the chat's own fold button", () => {
  const column = (onHide?: () => void) =>
    render(<StudioChatColumn fullScreen={onHide ? { onHide } : undefined} />);

  // In full screen it hides the chat as the plate's button does; a rail
  // there would be a second way of being away.
  it('hides the chat in full screen, never folding it to its rail', () => {
    const onHide = jest.fn();
    const { container } = column(onHide);
    fireEvent.click(screen.getByRole('button', { name: 'fold' }));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.is-folded')).toBeNull();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('folds it to its rail in the window', () => {
    const { container } = column();
    fireEvent.click(screen.getByRole('button', { name: 'fold' }));
    expect(container.querySelector('.studio-bench__chat.is-folded')).not.toBe(
      null,
    );
  });
});

describe("the chat's width in full screen", () => {
  const nudge = () =>
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });

  // A chat widened over the scene would otherwise come back to the window
  // as wide.
  it('is its own, the window’s width left as it was', () => {
    window.localStorage.setItem('fluideq.studio.chatWidth', '400');
    render(<StudioChatColumn fullScreen={{ onHide: jest.fn() }} />);
    nudge();
    expect(
      window.localStorage.getItem('fluideq.studio.fullscreenChatWidth'),
    ).not.toBeNull();
    expect(window.localStorage.getItem('fluideq.studio.chatWidth')).toBe('400');
  });

  it('sets the window’s own in the window', () => {
    render(<StudioChatColumn />);
    nudge();
    expect(
      window.localStorage.getItem('fluideq.studio.chatWidth'),
    ).not.toBeNull();
    expect(
      window.localStorage.getItem('fluideq.studio.fullscreenChatWidth'),
    ).toBeNull();
  });

  it('stands open over the scene though it was folded in the window', () => {
    window.localStorage.setItem('fluideq.studio.chatFolded', 'true');
    const { container } = render(
      <StudioChatColumn fullScreen={{ onHide: jest.fn() }} />,
    );
    expect(container.querySelector('.is-folded')).toBeNull();
    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
  });

  it('carries both widths on the column, each for the sheet to read', () => {
    window.localStorage.setItem('fluideq.studio.chatWidth', '400');
    window.localStorage.setItem('fluideq.studio.fullscreenChatWidth', '700');
    const { container } = render(<StudioChatColumn />);
    const aside = container.querySelector<HTMLElement>('.studio-bench__chat');
    expect(aside?.style.getPropertyValue('--studio-chat-width')).toBe('400px');
    expect(aside?.style.getPropertyValue('--studio-full-chat-width')).toBe(
      '700px',
    );
  });
});
