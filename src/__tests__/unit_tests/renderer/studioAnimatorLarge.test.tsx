/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Animator in the bigger animation view (Ivan, 2026-11-09: "the full
 * screen there needs to attach the chat too so I can work better focused on
 * animator"): the same chat, moved and never mounted twice, so what is being
 * written goes with it and comes back; its own divider and width there; and
 * arrows typed into it, or in a dialog over the view, step no frames. Each
 * rule beside its control.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const mounted = jest.fn();

/** A stand-in for the Animator: words of its own, counted mounts. */
function Animator() {
  const [words, setWords] = useState('');
  useEffect(() => {
    mounted();
  }, []);
  return (
    <section className="studio-chat studio-animator" aria-label="animator">
      <textarea
        aria-label="message"
        value={words}
        onChange={(event) => setWords(event.target.value)}
      />
    </section>
  );
}

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

/** The frame the bigger view's stage says it shows, from its chip. */
const shownFrame = (): number => {
  const chips = within(document.body).getAllByText(
    /studio\.animation\.frameOf/,
  );
  const chip = chips[chips.length - 1];
  return JSON.parse(chip?.textContent?.replace(/^\S+ /, '') ?? '{}').frame;
};

const openWhale = () => {
  render(
    <StudioAnimations animations={[whale()]} renderSide={() => <Animator />} />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: /studio\.animation\.open/ }),
  );
};
const enlarge = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.animation.expand' }),
  );
const dialog = () => screen.queryByRole('dialog');

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  mounted.mockClear();
  localStorage.clear();
});

describe('the Animator in the bigger view', () => {
  it('goes into the bigger view, beside the animation', () => {
    openWhale();
    enlarge();
    const view = dialog();
    expect(view).not.toBeNull();
    expect(
      within(view as HTMLElement).getByLabelText('animator'),
    ).toBeInTheDocument();
  });

  it('is the same chat: one, never mounted again, its words with it', () => {
    openWhale();
    fireEvent.change(screen.getByLabelText('message'), {
      target: { value: 'flick the tail' },
    });
    enlarge();
    expect(screen.getAllByLabelText('animator')).toHaveLength(1);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(
      within(dialog() as HTMLElement).getByLabelText('message'),
    ).toHaveValue('flick the tail');
  });

  it('comes back to the panel with its words when the view closes', () => {
    openWhale();
    enlarge();
    fireEvent.change(screen.getByLabelText('message'), {
      target: { value: 'slower dive' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.close' }),
    );
    expect(dialog()).toBeNull();
    expect(screen.getAllByLabelText('animator')).toHaveLength(1);
    expect(screen.getByLabelText('message')).toHaveValue('slower dive');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('control: with no Animator the bigger view has none and no divider', () => {
    render(<StudioAnimations animations={[whale()]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    enlarge();
    expect(within(dialog() as HTMLElement).queryByRole('separator')).toBeNull();
  });

  it('has its own divider there, keeping a width apart from the panel’s', () => {
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function rect(this: HTMLElement) {
        const width = this.classList.contains('studio-animation-opened__side')
          ? 400
          : 1400;
        return {
          width,
          height: 600,
          top: 0,
          left: 0,
          right: width,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });
    openWhale();
    enlarge();
    fireEvent.keyDown(
      within(dialog() as HTMLElement).getByRole('separator', {
        name: 'studio.animator.resize',
      }),
      { key: 'ArrowLeft' },
    );
    expect(localStorage.getItem('fluideq.studio.animatorLargeWidth')).toBe(
      '424',
    );
    expect(localStorage.getItem('fluideq.studio.animatorWidth')).toBeNull();
    jest.restoreAllMocks();
  });
});

describe('the bigger view’s arrows', () => {
  const pause = () => {
    const paused = screen.queryByRole('button', {
      name: 'studio.animation.pause',
    });
    if (paused) {
      fireEvent.click(paused);
    }
  };

  it('step the frames from the view', () => {
    openWhale();
    enlarge();
    pause();
    const before = shownFrame();
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'studio.animation.close' }),
      { key: 'ArrowRight' },
    );
    expect(shownFrame()).toBe((before % 8) + 1);
  });

  it('move the caret, not the frames, while the Animator is written to', () => {
    openWhale();
    enlarge();
    pause();
    const before = shownFrame();
    const box = within(dialog() as HTMLElement).getByLabelText('message');
    const notTaken = fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(shownFrame()).toBe(before);
    // Left to the box: nothing kept the browser from moving the caret.
    expect(notTaken).toBe(true);
  });

  it('step nothing from a dialog opened over the view', () => {
    openWhale();
    enlarge();
    pause();
    const before = shownFrame();
    const over = document.createElement('div');
    over.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    over.appendChild(button);
    document.body.appendChild(over);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(shownFrame()).toBe(before);
    over.remove();
  });
});
