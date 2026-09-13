/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the DSP and Plus tabs arrive, read from their compiled stylesheets.
 *
 * Every glitch this file holds shipped past a suite that queried by role: a
 * gallery that dimmed and came back each time Plus opened, a rail that flashed
 * a scrollbar while its last card rose in, a rail stagger one entry short of
 * the list it staggered. jsdom lays nothing out and runs no animation, so the
 * rules that prevent them are what can be checked.
 */

import { GALLERY_PAGE_SIZE } from 'common/plusGallery';
import { DSP_SECTIONS } from '../../../renderer/dsp/sections';
import {
  animationName,
  baseRules,
  baseValue,
  compileStylesheet,
  highestNthChild,
  keyframes,
} from '../../utils/stylesheetRules';

const dsp = compileStylesheet('Dsp.scss');
const gallery = compileStylesheet('Gallery.scss');
const rail = compileStylesheet('CommunityRail.scss');

/** Whether any base rule for a `.gallery-grid` state changes its opacity. */
const dimsWhileRefreshing = (css: string) =>
  baseRules(css).some(
    ({ selectors, declarations }) =>
      selectors.some((selector) => /^\.gallery-grid(\.|$)/.test(selector)) &&
      (declarations.has('opacity') ||
        /opacity/.test(declarations.get('transition') ?? '')),
  );

/** Properties that move a box rather than fade it. */
const MOVES = ['translate', 'transform', 'top', 'margin-top', 'scale'];

const travels = (css: string, name: string) =>
  Array.from(keyframes(css, name).values()).some((frame) =>
    MOVES.some((property) => frame.has(property)),
  );

/** Whether an animation forces an end state instead of ending on the element's own. */
const endsOnItsOwnValue = (css: string, name: string) => {
  const frames = keyframes(css, name);
  return !frames.has('to') && !frames.has('100%');
};

describe('the Plus tab arriving', () => {
  it('keeps the gallery at full strength while a list refreshes', () => {
    expect(
      baseRules(gallery).some(({ selectors }) =>
        selectors.includes('.gallery-grid'),
      ),
    ).toBe(true);
    expect(dimsWhileRefreshing(gallery)).toBe(false);
  });

  it('POSITIVE CONTROL: flags the dimming that pulsed every time the tab opened', () => {
    const dimming =
      '.gallery-grid { display: grid; transition: opacity 160ms ease; }\n' +
      '.gallery-grid.is-refreshing { opacity: 0.72; }';
    expect(dimsWhileRefreshing(dimming)).toBe(true);
  });

  it('starts the card sweep again on every page of results', () => {
    const periods = baseRules(gallery)
      .flatMap(({ selectors }) => selectors)
      .map((selector) =>
        /^\.gallery-card:nth-child\((\d+)n\+(\d+)\)$/.exec(selector),
      )
      .filter((match): match is RegExpExecArray => match !== null);
    expect(periods.length).toBeGreaterThan(0);
    expect(new Set(periods.map(([, period]) => Number(period)))).toEqual(
      new Set([GALLERY_PAGE_SIZE]),
    );
    expect(
      Math.max(...periods.map(([, , beat]) => Number(beat))),
    ).toBeLessThanOrEqual(GALLERY_PAGE_SIZE);
  });

  it('fades the member card in at the foot of the rail rather than raising it', () => {
    // The card sits on the rail's floor and the rail scrolls: a rise put it
    // below the floor for the length of the entrance.
    const name = animationName(
      baseValue(rail, '.community__foot', 'animation'),
    );
    expect(name).not.toBe('none');
    expect(travels(rail, name)).toBe(false);
  });

  it('POSITIVE CONTROL: a rise does travel', () => {
    expect(travels(rail, 'rise-in')).toBe(true);
  });

  it('brings a rail the window has dimmed in dimmed', () => {
    const name = animationName(
      baseValue(rail, '.community__rail', 'animation'),
    );
    expect(name).not.toBe('none');
    expect(endsOnItsOwnValue(rail, name)).toBe(true);
    expect(endsOnItsOwnValue(rail, 'fade-in')).toBe(false);
  });
});

describe('the DSP page arriving', () => {
  it('staggers exactly as many filters as the rail lists', () => {
    // One short, and the last two filters flew in on the same beat — which
    // is what happened when Bass Forge and Bass Punch joined the list.
    expect(highestNthChild(dsp, '.dsp-rail-processors > .dsp-rail-tab')).toBe(
      DSP_SECTIONS.length,
    );
  });

  it('holds the processor card still and brings a stage dimmed as unavailable in dimmed', () => {
    expect(
      animationName(baseValue(dsp, '.dsp-stage .dsp-card', 'animation')),
    ).toBe('none');
    const stage = animationName(baseValue(dsp, '.dsp-stage', 'animation'));
    expect(stage).not.toBe('none');
    expect(endsOnItsOwnValue(dsp, stage)).toBe(true);
  });
});
