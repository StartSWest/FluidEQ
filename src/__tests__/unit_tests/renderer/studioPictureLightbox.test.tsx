/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioPictureLightbox, {
  type IViewedPicture,
} from '../../../renderer/studio/StudioPictureLightbox';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/** The size a window gives the stage the picture is fitted into. */
const STAGE = { width: 800, height: 600 };
const PLACE_CLASS = 'studio-lightbox__place';

/**
 * Fitted at 2/3 (67%): wider than the stage. `bird` is small enough to be
 * enlarged, fitted at twice its size (200%); `mast` is packed on its side and
 * shown upright, 100 x 300.
 */
const pictures: IViewedPicture[] = [
  {
    key: 'region:sky',
    name: 'sky',
    region: { id: 'sky', x: 0, y: 0, width: 1200, height: 600, rotated: false },
    whole: false,
  },
  {
    key: 'region:bird',
    name: 'bird',
    region: {
      id: 'bird',
      x: 0,
      y: 600,
      width: 100,
      height: 50,
      rotated: false,
    },
    whole: false,
  },
  {
    key: 'region:mast',
    name: 'mast',
    region: {
      id: 'mast',
      x: 100,
      y: 600,
      width: 300,
      height: 100,
      rotated: true,
    },
    whole: false,
  },
];

const onStep = jest.fn();
const onSave = jest.fn();
const onClose = jest.fn();
const scrollIntoView = jest.fn();

type TProps = ComponentProps<typeof StudioPictureLightbox>;

/** The viewer over a 1200 x 700 image, showing `index` of `shown`. */
function Viewer({
  index = 0,
  shown = pictures,
  busy,
  notice,
}: Partial<Pick<TProps, 'index' | 'busy' | 'notice'>> & {
  shown?: IViewedPicture[];
}) {
  return (
    <StudioPictureLightbox
      url="blob:atlas"
      atlasWidth={1200}
      atlasHeight={700}
      pictures={shown}
      index={index}
      busy={busy}
      notice={notice}
      onStep={onStep}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

const rect = (width: number, height: number) =>
  ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

const isPlace = (element: Element) => element.classList.contains(PLACE_CLASS);

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom lays nothing out. Only the stage is given a size, the one layout
  // fact the viewer reads: its box, and where a pointer is within it.
  jest
    .spyOn(Element.prototype, 'clientWidth', 'get')
    .mockImplementation(function width(this: Element) {
      return isPlace(this) ? STAGE.width : 0;
    });
  jest
    .spyOn(Element.prototype, 'clientHeight', 'get')
    .mockImplementation(function height(this: Element) {
      return isPlace(this) ? STAGE.height : 0;
    });
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function bounds(this: Element) {
      return isPlace(this) ? rect(STAGE.width, STAGE.height) : rect(0, 0);
    });
  // Electron has it; jsdom does not.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const place = () => {
  const found = document.querySelector<HTMLElement>(`.${PLACE_CLASS}`);
  if (!found) {
    throw new Error('the viewer has no stage');
  }
  return found;
};

/** The frame the named picture is drawn in, sized and placed by the zoom. */
const frameOf = (name: string) => {
  const frame = screen.getByRole('img', { name }).parentElement;
  if (!frame) {
    throw new Error(`${name} is not in a frame`);
  }
  return frame;
};

const leftOf = (frame: HTMLElement) =>
  Number(/translate\((-?[\d.]+)px/.exec(frame.style.transform)?.[1]);

const percent = () =>
  Number(
    screen.getByText(/^studio\.framing\.percent:/).textContent?.split(':')[1],
  );

const zoomIn = () =>
  screen.getByRole('button', { name: 'studio.picture.zoomIn' });
const zoomOut = () =>
  screen.getByRole('button', { name: 'studio.picture.zoomOut' });
const fit = () => screen.getByRole('button', { name: 'studio.picture.fit' });

describe('what the viewer says about the picture', () => {
  it('names it, gives its upright size and where it is in the set', () => {
    render(<Viewer index={2} />);
    const dialog = screen.getByRole('dialog', { name: 'mast' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByText('studio.picture.size:100,300'),
    ).toBeVisible();
    expect(
      within(dialog).getByText('studio.picture.position:3,3'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'studio.picture.close' }),
    ).toHaveFocus();
  });

  it('shows a picture on its own without arrows, a count or a strip', async () => {
    const user = userEvent.setup();
    render(<Viewer shown={[pictures[0]]} />);
    expect(screen.getByRole('dialog', { name: 'sky' })).toBeVisible();
    expect(
      screen.queryByText(/^studio\.picture\.position:/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studio.picture.next' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'studio.picture.all' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(onStep).not.toHaveBeenCalled();
  });

  it('keeps the strip of thumbnails out of the Tab order', () => {
    render(<Viewer />);
    const strip = screen.getByRole('group', { name: 'studio.picture.all' });
    expect(within(strip).getAllByRole('button')).toHaveLength(3);
    const reached = new Set<Element>();
    for (let press = 0; press < 12; press += 1) {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Tab',
      });
      if (document.activeElement) {
        reached.add(document.activeElement);
      }
    }
    // Positive control: Tab does walk the viewer's own controls.
    expect(reached).toContain(
      screen.getByRole('button', { name: 'studio.picture.next' }),
    );
    expect(reached).toContain(zoomIn());
    expect([...reached].filter((each) => strip.contains(each))).toEqual([]);
  });
});

describe('closing', () => {
  it('closes on Esc, the close button, the backdrop and beside a fitted picture', async () => {
    const user = userEvent.setup();
    render(<Viewer />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole('button', { name: 'studio.picture.close' }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.click(place());
    expect(onClose).toHaveBeenCalledTimes(3);
    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      await user.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('stays open for a click on the picture, or beside it while zoomed', async () => {
    const user = userEvent.setup();
    render(<Viewer />);
    await user.click(screen.getByRole('img', { name: 'sky' }));
    await user.click(zoomIn());
    await user.click(place());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('stepping through the set', () => {
  it('steps with the arrow keys, wrapping at the ends, and jumps with Home and End', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Viewer />);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{End}');
    await user.keyboard('{Home}');
    expect(onStep.mock.calls).toEqual([[1], [2], [2], [0]]);

    onStep.mockClear();
    rerender(<Viewer index={2} />);
    await user.keyboard('{ArrowRight}');
    expect(onStep.mock.calls).toEqual([[0]]);
  });

  it('steps with the arrow buttons and the thumbnails', async () => {
    const user = userEvent.setup();
    render(<Viewer index={2} />);
    await user.click(
      screen.getByRole('button', { name: 'studio.picture.next' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'studio.picture.previous' }),
    );
    const strip = screen.getByRole('group', { name: 'studio.picture.all' });
    await user.click(within(strip).getByRole('button', { name: 'bird' }));
    expect(onStep.mock.calls).toEqual([[0], [1], [1]]);
  });

  it('lights the shown thumbnail and scrolls the strip to it', () => {
    const { rerender } = render(<Viewer />);
    rerender(<Viewer index={2} />);
    const strip = screen.getByRole('group', { name: 'studio.picture.all' });
    const mast = within(strip).getByRole('button', { name: 'mast' });
    expect(mast).toHaveAttribute('aria-current', 'true');
    expect(within(strip).getByRole('button', { name: 'sky' })).toHaveAttribute(
      'aria-current',
      'false',
    );
    const { contexts } = scrollIntoView.mock;
    expect(contexts[contexts.length - 1]).toBe(mast);
  });
});

describe('zoom', () => {
  it('steps in and out from the fitted scale, and back to fit', async () => {
    const user = userEvent.setup();
    render(<Viewer />);
    expect(percent()).toBe(67);
    expect(zoomOut()).toHaveAttribute('aria-disabled', 'true');
    expect(fit()).toHaveAttribute('aria-disabled', 'true');
    expect(zoomIn()).toHaveAttribute('aria-disabled', 'false');

    await user.click(zoomIn());
    expect(percent()).toBe(100);
    expect(zoomOut()).toHaveAttribute('aria-disabled', 'false');
    expect(fit()).toHaveAttribute('aria-disabled', 'false');

    await user.click(zoomOut());
    expect(percent()).toBe(67);
    expect(zoomOut()).toHaveAttribute('aria-disabled', 'true');
    // Nowhere further out to go: the press changes nothing.
    await user.click(zoomOut());
    expect(percent()).toBe(67);

    const seen: number[] = [];
    for (let press = 0; press < 5; press += 1) {
      await user.click(zoomIn());
      seen.push(percent());
    }
    expect(seen).toEqual([100, 200, 400, 800, 1600]);
    expect(zoomIn()).toHaveAttribute('aria-disabled', 'true');
    await user.click(zoomIn());
    expect(percent()).toBe(1600);

    await user.click(fit());
    expect(percent()).toBe(67);
    expect(fit()).toHaveAttribute('aria-disabled', 'true');
  });

  it('steps with + and −, and fits with 0', async () => {
    const user = userEvent.setup();
    render(<Viewer />);
    await user.keyboard('+');
    expect(percent()).toBe(100);
    await user.keyboard('=');
    expect(percent()).toBe(200);
    await user.keyboard('-');
    expect(percent()).toBe(100);
    await user.keyboard('0');
    expect(percent()).toBe(67);
  });

  it('draws the picture only once the stage has been measured', () => {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(0);
    render(<Viewer />);
    expect(screen.queryByRole('img', { name: 'sky' })).not.toBeInTheDocument();
  });

  it('zooms about the pointer with Ctrl and the wheel, and the wheel pans only a zoomed picture', () => {
    render(<Viewer />);
    // 800 x 400 fitted, in the middle of the 600 px tall stage.
    const fitted = frameOf('sky');
    expect(fitted.style.transform).toBe('translate(0px, 100px)');
    // A fitted picture has nowhere to pan, and nothing behind it scrolls.
    expect(fireEvent.wheel(place(), { deltaX: 40 })).toBe(false);
    expect(frameOf('sky').style.transform).toBe('translate(0px, 100px)');

    // The picture pixel under x = 600 is 900 of its 1200 while fitted.
    fireEvent.wheel(place(), {
      ctrlKey: true,
      deltaY: -100,
      clientX: 600,
      clientY: 300,
    });
    expect(percent()).toBe(81);
    const zoomed = frameOf('sky');
    const scale = parseFloat(zoomed.style.width) / 1200;
    expect(Math.abs((600 - leftOf(zoomed)) / scale - 900)).toBeLessThan(1);

    const before = leftOf(zoomed);
    fireEvent.wheel(place(), { deltaX: 40 });
    expect(leftOf(frameOf('sky'))).toBe(before - 40);
  });

  it('double-clicks between fitted and real size at the point clicked', () => {
    render(<Viewer />);
    fireEvent.doubleClick(place(), { clientX: 600, clientY: 300 });
    expect(percent()).toBe(100);
    // Pixel 900 of 1200 is still under x = 600: 600 + 300.
    expect(frameOf('sky').style.transform).toBe('translate(-300px, 0px)');
    fireEvent.doubleClick(place(), { clientX: 600, clientY: 300 });
    expect(percent()).toBe(67);
    expect(frameOf('sky').style.transform).toBe('translate(0px, 100px)');
  });

  it('double-clicks a small enlarged picture to twice its fitted size', () => {
    render(<Viewer index={1} />);
    expect(percent()).toBe(200);
    fireEvent.doubleClick(place(), { clientX: 400, clientY: 300 });
    expect(percent()).toBe(400);
  });

  it('shows every picture stepped to fitted, the one zoomed before included', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Viewer />);
    await user.click(zoomIn());
    await user.click(zoomIn());
    expect(percent()).toBe(200);

    rerender(<Viewer index={1} />);
    expect(percent()).toBe(200);
    expect(fit()).toHaveAttribute('aria-disabled', 'true');

    rerender(<Viewer index={0} />);
    expect(percent()).toBe(67);
    expect(fit()).toHaveAttribute('aria-disabled', 'true');
  });

  it('draws hard pixels only from twice the picture size up', async () => {
    const user = userEvent.setup();
    render(<Viewer />);
    await user.click(zoomIn());
    expect(frameOf('sky')).not.toHaveClass('is-crisp');
    await user.click(zoomIn());
    expect(frameOf('sky')).toHaveClass('is-crisp');
  });
});

describe('saving', () => {
  it('saves the picture it shows', async () => {
    const user = userEvent.setup();
    render(<Viewer index={1} />);
    await user.click(
      screen.getByRole('button', { name: 'studio.picture.download' }),
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(pictures[1]);
  });

  it('waits while a save runs, and says how the last one went', () => {
    const { rerender } = render(<Viewer index={1} busy="region:sky" />);
    const save = () =>
      screen.getByRole('button', { name: 'studio.picture.download' });
    expect(save()).toBeDisabled();

    rerender(<Viewer index={1} busy="region:bird" />);
    expect(save()).toBeEnabled();
    expect(save()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(save());
    expect(onSave).not.toHaveBeenCalled();

    rerender(<Viewer index={1} notice="cancelled" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<Viewer index={1} notice="saved" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.picture.downloaded',
    );
  });
});
