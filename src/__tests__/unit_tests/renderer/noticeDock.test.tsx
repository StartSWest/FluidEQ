/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every notice that arrives on its own stands in one stack at the window's
 * bottom right, on the sound panel's foot where fluideq.com is (Ivan,
 * 2026-11-24: "move all notifications to the bottom right where the
 * fluideq.com is so it doesn't clutter the view on the top right").
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  DockedNotice,
  NoticeDock,
  NoticeDockProvider,
} from '../../../renderer/components/NoticeDock';
import {
  compileStylesheet,
  keyframes,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

/** A notice raised from a part of the window that is not the dock's. */
const Raised = ({ id, children }: { id: string; children: ReactNode }) => (
  <section aria-label={`part ${id}`}>
    <DockedNotice>
      <div role="status" id={`${id}-notice`}>
        {children}
      </div>
    </DockedNotice>
  </section>
);

const stackOf = (container: HTMLElement) => {
  const stack = container.querySelector('.notice-dock > .notice-dock__stack');
  if (!(stack instanceof HTMLElement)) {
    throw new Error('no dock');
  }
  return stack;
};

describe('the notices’ stack', () => {
  it('draws every notice in the one stack, the newest nearest the corner', () => {
    const { container, rerender } = render(
      <NoticeDockProvider>
        <Raised id="a">The engine is off</Raised>
        <NoticeDock isAboveSoundFoot />
      </NoticeDockProvider>,
    );
    rerender(
      <NoticeDockProvider>
        <Raised id="a">The engine is off</Raised>
        <Raised id="b">A new FluidEQ</Raised>
        <NoticeDock isAboveSoundFoot />
      </NoticeDockProvider>,
    );
    const stack = stackOf(container);
    // Not where it was raised: in the dock, each in a slot of its own.
    expect(
      screen.getByRole('region', { name: 'part a' }),
    ).toBeEmptyDOMElement();
    expect(
      [...stack.children].map((slot) => [slot.className, slot.textContent]),
    ).toEqual([
      ['notice-dock__slot', 'The engine is off'],
      ['notice-dock__slot', 'A new FluidEQ'],
    ]);
  });

  it('stands on the sound panel’s foot only while the foot is on screen', () => {
    const { container, rerender } = render(
      <NoticeDockProvider>
        <NoticeDock isAboveSoundFoot />
      </NoticeDockProvider>,
    );
    expect(container.querySelector('.notice-dock')).toHaveClass(
      'is-above-sound-foot',
    );
    rerender(
      <NoticeDockProvider>
        <NoticeDock isAboveSoundFoot={false} />
      </NoticeDockProvider>,
    );
    expect(container.querySelector('.notice-dock')).not.toHaveClass(
      'is-above-sound-foot',
    );
  });

  it('draws a notice where it is raised when there is no dock at all', () => {
    // A notice rendered alone, as every notice's own test renders it.
    render(<Raised id="alone">Saved</Raised>);
    expect(
      screen.getByRole('region', { name: 'part alone' }),
    ).toHaveTextContent('Saved');
  });

  describe('a notice going', () => {
    let finish: () => void = () => undefined;
    const original = Element.prototype.getAnimations;

    afterEach(() => {
      Element.prototype.getAnimations = original;
    });

    const Toggle = () => {
      const [shown, setShown] = useState(true);
      return (
        <NoticeDockProvider>
          <Raised id="old">Older</Raised>
          {shown && <Raised id="gone">Going</Raised>}
          <Raised id="new">Newer</Raised>
          <button type="button" onClick={() => setShown(false)}>
            hide
          </button>
          <NoticeDock isAboveSoundFoot={false} />
        </NoticeDockProvider>
      );
    };

    it('folds out of its place, inert, and is gone when the fold ends', async () => {
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      // jsdom plays no animations; the slot's way out, as Chromium reports it.
      Element.prototype.getAnimations = function folding(this: Element) {
        return this.hasAttribute('data-closing')
          ? [{ animationName: 'row-leave', finished } as unknown as Animation]
          : [];
      };
      const { container } = render(<Toggle />);
      fireEvent.click(screen.getByRole('button', { name: 'hide' }));
      const stack = stackOf(container);
      const [, ghost] = [...stack.children];
      // Where the notice stood, between its neighbours, so they glide.
      expect([...stack.children].map((slot) => slot.textContent)).toEqual([
        'Older',
        'Going',
        'Newer',
      ]);
      expect(ghost).toHaveAttribute('data-closing');
      expect(ghost).toHaveAttribute('aria-hidden', 'true');
      expect((ghost as HTMLElement).inert).toBe(true);
      // Its ids would answer for the gone notice's labels.
      expect(ghost.querySelector('[id]')).toBeNull();
      finish();
      await waitFor(() =>
        expect([...stack.children].map((slot) => slot.textContent)).toEqual([
          'Older',
          'Newer',
        ]),
      );
    });

    it('goes at once where nothing plays', () => {
      const { container } = render(<Toggle />);
      fireEvent.click(screen.getByRole('button', { name: 'hide' }));
      expect(
        [...stackOf(container).children].map((slot) => slot.textContent),
      ).toEqual(['Older', 'Newer']);
    });
  });
});

describe('where the notices stand', () => {
  const rule = (rules: IRule[], selector: string) =>
    rules.find(
      ({ selectors, within }) =>
        within.length === 0 && selectors.includes(selector),
    )?.declarations;

  it('is the bottom right corner, over the transport bar and the panel’s foot', () => {
    const rules = styleRules(compileStylesheet('NoticeDock.scss'));
    const dock = rule(rules, '.notice-dock');
    expect(dock?.get('position')).toBe('fixed');
    expect(dock?.get('right')).toBe('16px');
    expect(dock?.get('bottom')).toBe('var(--notice-dock-floor)');
    expect(dock?.has('top')).toBe(false);
    expect(dock?.has('left')).toBe(false);
    // Scrolls from its foot: an overflowing stack keeps the newest in view.
    expect(dock?.get('flex-direction')).toBe('column-reverse');
    // An overflowing stack fades out at its top edge instead of slicing its
    // oldest card, on the box's own scroll timeline: inactive, and so no
    // mask at all, while everything fits.
    expect(dock?.has('mask-image')).toBe(false);
    expect(dock?.get('animation-timeline')).toBe('scroll(self block)');
    expect(dock?.get('animation')).toMatch(/^notice-dock-overflow /);
    // Scrolled up to the oldest notice, nothing is hidden above: no fade.
    const fade = keyframes(
      compileStylesheet('NoticeDock.scss'),
      'notice-dock-overflow',
    );
    const at = (stop: string) =>
      [...fade].find(([stops]) =>
        stops.split(',').some((each) => each.trim() === stop),
      )?.[1];
    expect(at('0%')?.get('mask-image')).toMatch(
      /^linear-gradient\(to bottom, transparent, #000 24px\)$/,
    );
    expect(at('100%')?.get('mask-image')).toBe('none');
    // The bar counts only while one is up; the foot only while it shows.
    expect(dock?.get('--notice-dock-bar')).toBe('0px');
    expect(
      rule(rules, '#root.has-now-playing .notice-dock')?.get(
        '--notice-dock-bar',
      ),
    ).toMatch(/var\(--now-playing-bar-height/);
    expect(
      rule(rules, '.notice-dock.is-above-sound-foot')?.get(
        '--notice-dock-foot',
      ),
    ).toBe('54px');
  });

  // The positive control for the stack: none of them places itself any more,
  // where each used to be fixed somewhere of its own and covered the others.
  it.each([
    ['AppNews.scss', '.compact-frame.app-news-notice'],
    ['MemberNotice.scss', '.compact-frame.member-notice'],
    ['PlusTermsNotice.scss', '.compact-frame.plus-terms-notice'],
    ['ProfileRecoveredNotice.scss', '.compact-frame.profile-recovered-notice'],
    ['SceneReviewNotice.scss', '.compact-frame.scene-review-notice'],
    ['SongEqNotice.scss', '.compact-frame.song-eq-notice'],
    ['DeviceProfiles.scss', '.compact-frame.device-apo-notice'],
    ['Modal.scss', '.compact-frame.prereq-notice'],
    ['Karaoke.scss', '.compact-frame.karaoke-maker__toast'],
    ['PlusToastStack.scss', '.plus-toasts'],
  ])('%s leaves %s to the stack', (sheet, selector) => {
    const placed = styleRules(compileStylesheet(sheet))
      .filter(({ selectors }) => selectors.includes(selector))
      .flatMap(({ declarations }) => [...declarations.keys()])
      .filter((property) =>
        ['position', 'top', 'right', 'bottom', 'left', 'z-index'].includes(
          property,
        ),
      );
    expect(placed).toEqual([]);
  });

  it('leaves the shell’s restart, capture, failure and import notices to it', () => {
    const shell = compileStylesheet('App.scss');
    expect(shell).not.toContain('.compact-frame.workspace-notice');
    expect(shell).not.toContain('.compact-frame.audio-restart-notice');
    // Control: the sheet is the one that placed them, and still hides the
    // restart notice's place over a full-screen picture.
    expect(shell).toContain(
      '.notice-dock .notice-dock__slot:has(> .audio-restart-notice)',
    );
  });
});
