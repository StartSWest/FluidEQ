/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The divider between an opened animation and its Animator (Ivan,
 * 2026-11-09: "also add splitter for the chat too there"): the scene chat's
 * own divider and drag, keyboard included; the width kept for the next
 * visit and a double-click putting it back; never narrower than the
 * Animator's least nor so wide the animation keeps less than its own. And
 * the scene chat's column, which now drags through the same code, keeping
 * its own name and limits. Each rule beside its control.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import StudioAnimatorColumn from '../../../renderer/studio/animations/StudioAnimatorColumn';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';
import useChatWidth from '../../../renderer/studio/chat/useChatWidth';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const KEY = 'fluideq.studio.animatorWidth';

/** jsdom has no PointerEvent; a mouse event carries the pointer's place. */
class TestPointerEvent extends MouseEvent {
  pointerId = 1;
}

/** Every box measures as `column` wide, its grid as `grid`. */
const measure = (column: number, grid: number) => {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rect(this: HTMLElement) {
      const width = this.classList.contains('studio-animation-opened__side')
        ? column
        : grid;
      return {
        width,
        height: 400,
        top: 0,
        left: 0,
        right: width,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
};

const column = () => {
  render(
    <div className="grid">
      <StudioAnimatorColumn storageKey={KEY}>
        <section aria-label="animator" />
      </StudioAnimatorColumn>
    </div>,
  );
  return screen.getByRole('separator', { name: 'studio.animator.resize' });
};
const side = () =>
  document.querySelector<HTMLElement>('.studio-animation-opened__side');
const widthOf = () => side()?.style.getPropertyValue('--studio-animator-width');

beforeEach(() => {
  localStorage.clear();
  Object.assign(window, { PointerEvent: TestPointerEvent });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the Animator’s divider', () => {
  it('holds the Animator, with the divider at its edge', () => {
    column();
    expect(screen.getByLabelText('animator')).toBeInTheDocument();
    expect(side()?.firstElementChild).toHaveClass('column-resizer');
  });

  it('widens with the left arrow and keeps the width', () => {
    measure(360, 1000);
    fireEvent.keyDown(column(), { key: 'ArrowLeft' });
    expect(widthOf()).toBe('384px');
    expect(localStorage.getItem(KEY)).toBe('384');
  });

  it('narrows with the right arrow', () => {
    measure(360, 1000);
    fireEvent.keyDown(column(), { key: 'ArrowRight' });
    expect(widthOf()).toBe('336px');
  });

  it('control: any other key leaves the width alone', () => {
    measure(360, 1000);
    fireEvent.keyDown(column(), { key: 'ArrowUp' });
    expect(widthOf()).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('never goes under the Animator’s least, 300px', () => {
    measure(310, 1000);
    fireEvent.keyDown(column(), { key: 'ArrowRight' });
    expect(widthOf()).toBe('300px');
  });

  it('never leaves the animation under 440px and the gap', () => {
    // 1000 wide: the most is 1000 - 440 - 16 = 544.
    measure(530, 1000);
    fireEvent.keyDown(column(), { key: 'ArrowLeft' });
    expect(widthOf()).toBe('544px');
  });

  it('measures its widest inside the grid’s padding, as the sheet does', () => {
    // The bigger view's body: 1000 wide with 16px each side, so 968 inside
    // and the most is 968 - 440 - 16 = 512.
    measure(500, 1000);
    render(
      <div style={{ paddingLeft: '16px', paddingRight: '16px' }}>
        <StudioAnimatorColumn storageKey={KEY}>
          <section aria-label="animator" />
        </StudioAnimatorColumn>
      </div>,
    );
    fireEvent.keyDown(
      screen.getByRole('separator', { name: 'studio.animator.resize' }),
      { key: 'ArrowLeft' },
    );
    expect(widthOf()).toBe('512px');
  });

  it('follows a drag from the pointer, left widening', () => {
    measure(360, 1200);
    const divider = column();
    divider.setPointerCapture = jest.fn();
    divider.releasePointerCapture = jest.fn();
    fireEvent.pointerDown(divider, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 400, pointerId: 1 });
    fireEvent.pointerUp(divider, { clientX: 400, pointerId: 1 });
    expect(widthOf()).toBe('460px');
    expect(localStorage.getItem(KEY)).toBe('460');
  });

  it('opens at the width kept from the last visit', () => {
    localStorage.setItem(KEY, '420');
    column();
    expect(widthOf()).toBe('420px');
  });

  it('control: a kept width under its least is not used', () => {
    localStorage.setItem(KEY, '200');
    column();
    expect(widthOf()).toBe('');
  });

  it('goes back to its own width on a double-click, and forgets the kept one', () => {
    localStorage.setItem(KEY, '420');
    fireEvent.doubleClick(column());
    expect(widthOf()).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('an opened animation', () => {
  const whale = (): IViewedAnimation => {
    const animation = readStudioAnimation('whale-dive', {
      sheet: 'art/whale-dive.png',
      count: 8,
      columns: 4,
      fps: 8,
      ground: 'water',
    });
    if (!animation) {
      throw new Error('the animation did not read');
    }
    return {
      animation,
      aspect: 1.7,
      bitmap: {
        width: 768,
        height: 224,
        close: jest.fn(),
      } as unknown as ImageBitmap,
    };
  };
  const open = (renderSide?: () => ReactNode) => {
    Element.prototype.scrollIntoView = jest.fn();
    render(<StudioAnimations animations={[whale()]} renderSide={renderSide} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
  };

  it('has its Animator in the column with the divider', () => {
    open(() => <section aria-label="animator" />);
    const divider = screen.getByRole('separator', {
      name: 'studio.animator.resize',
    });
    expect(divider.parentElement).toContainElement(
      screen.getByLabelText('animator'),
    );
  });

  it('control: with no Animator there is no divider', () => {
    open();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(side()).toBeNull();
  });
});

function ChatColumn() {
  const ref = useRef<HTMLElement>(null);
  const width = useChatWidth(ref);
  return (
    <div className="bench">
      <aside ref={ref} data-testid="chat" style={width.style}>
        <button
          type="button"
          onClick={() => {
            width.resizer.onStart();
            width.resizer.onDrag(-5000);
            width.resizer.onEnd();
          }}
        >
          widest
        </button>
        <button
          type="button"
          onClick={() => {
            width.resizer.onStart();
            width.resizer.onDrag(5000);
            width.resizer.onEnd();
          }}
        >
          narrowest
        </button>
      </aside>
    </div>
  );
}

describe('the scene chat’s column, dragged through the same code', () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function rect(this: HTMLElement) {
        const width = this.dataset.testid === 'chat' ? 400 : 1400;
        return {
          width,
          height: 400,
          top: 0,
          left: 0,
          right: width,
          bottom: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });
  });

  it('keeps its own name and its widest: the stage keeps 480px and the gap', () => {
    render(<ChatColumn />);
    fireEvent.click(screen.getByRole('button', { name: 'widest' }));
    // 1400 - 480 - 16.
    expect(
      screen.getByTestId('chat').style.getPropertyValue('--studio-chat-width'),
    ).toBe('904px');
    expect(localStorage.getItem('fluideq.studio.chatWidth')).toBe('904');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('and its own least, 320px', () => {
    render(<ChatColumn />);
    fireEvent.click(screen.getByRole('button', { name: 'narrowest' }));
    expect(localStorage.getItem('fluideq.studio.chatWidth')).toBe('320');
  });
});
