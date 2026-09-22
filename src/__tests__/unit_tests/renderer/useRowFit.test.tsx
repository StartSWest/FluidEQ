import { render } from '@testing-library/react';
import { useRef } from 'react';
import useRowFit from 'renderer/player/useRowFit';

/**
 * jsdom lays nothing out, so a row's sizes are scripted: the row is as wide
 * as the window gives it (`clientWidth`), and its content on one line is a
 * width per fit step — the words it still carries at that step.
 */
const content: Record<string, number> = { 0: 520, 1: 450, 2: 380 };
let rowWidth = 400;

const contentWidth = (row: HTMLElement) => content[row.dataset.fit ?? '0'];

// Never fires: the sizes below are fixed for each render.
const ResizeObserverStub = jest.fn(() => ({
  observe: () => undefined,
  unobserve: () => undefined,
  disconnect: () => undefined,
}));

const Row = ({ onNeed }: { onNeed: (cssWidth: number) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useRowFit(ref, 2, onNeed);
  return <div ref={ref} data-testid="row" />;
};

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverStub,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return rowWidth;
    },
  });
  // What the browser reports: content that fits reads as the row's own width.
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return Math.max(rowWidth, contentWidth(this));
    },
  });
  // Sized to its content only while it wears the measuring class, which
  // the stylesheet gives `width: max-content`.
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      const width = this.classList.contains('is-measuring')
        ? contentWidth(this)
        : rowWidth;
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0 };
    },
  });
});

describe('a row of the amp giving up its words', () => {
  it('keeps every word while they fit, and reports what it needs without them', () => {
    rowWidth = 600;
    const onNeed = jest.fn();
    const { getByTestId } = render(<Row onNeed={onNeed} />);
    expect(getByTestId('row').dataset.fit).toBe('0');
    // THE CONTENT'S width at the last step, not the row's: a row that fits
    // used to report the width it had been given, so in a wide window the
    // floor rose to the window and it could not be narrowed (Ivan,
    // 2026-09-22: "it is limiting me to go smaller").
    expect(onNeed).toHaveBeenLastCalledWith(380);
    // And put back: the measuring layout is never the one painted.
    expect(getByTestId('row').classList.contains('is-measuring')).toBe(false);
  });

  it('drops the names, then the values, as the room runs out', () => {
    rowWidth = 460;
    const { getByTestId, unmount } = render(<Row onNeed={() => undefined} />);
    expect(getByTestId('row').dataset.fit).toBe('1');
    unmount();

    rowWidth = 400;
    const onNeed = jest.fn();
    const narrow = render(<Row onNeed={onNeed} />);
    expect(narrow.getByTestId('row').dataset.fit).toBe('2');
    expect(onNeed).toHaveBeenLastCalledWith(380);
  });
});
