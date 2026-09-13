/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every DSP processor page arriving in order, held against the real markup.
 *
 * The page's entrance is written once, as rules over a card's rows and the
 * surfaces side by side in them, so whether it is right depends on what each
 * of ten pages actually renders. It was the card rising as one slab before;
 * a wrapper that animated while its children did would move them twice as
 * far on a curve neither describes; a row nothing animated would stand
 * complete in the first frame while the rest of the page faded in around it.
 * jsdom runs no animation, but it can say which elements the rules select.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import en from '../../../common/i18n/en';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';
import DspPanel from '../../../renderer/dsp/DspPanel';
import {
  DSP_PLAYBACK_SECTIONS,
  DSP_SECTIONS,
} from '../../../renderer/dsp/sections';
import { setDspNativeState } from '../../../renderer/dsp/store';
import { getAudioEngineStatus } from '../../../renderer/utils/audioEngineApi';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';
import { resetAudioEngineStatus } from '../../../renderer/utils/useAudioEngineStatus';
import {
  animationName,
  baseRules,
  compileStylesheet,
  expandIs,
  highestNthChild,
} from '../../utils/stylesheetRules';

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('../../../renderer/utils/audioEngineApi'),
  getAudioEngineStatus: jest.fn(),
}));

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

const css = compileStylesheet('Dsp.scss');

/** The selectors of the base rules that set `animation` to `name`. */
const selectorsAnimating = (name: string, including: string) =>
  baseRules(css)
    .filter(
      ({ selectors, declarations }) =>
        selectors.includes(including) &&
        animationName(declarations.get('animation')) === name,
    )
    .flatMap(({ selectors }) => selectors.flatMap(expandIs));

const ARRIVING = [
  ...selectorsAnimating('rise-in', '.dsp-card-body > *'),
  ...selectorsAnimating('rise-in', '.dsp-stage .dsp-card-header'),
];
const HOLDING_STILL = baseRules(css)
  .filter(
    ({ selectors, declarations }) =>
      selectors.some((selector) =>
        selector.startsWith('.dsp-card-body > :is('),
      ) && declarations.get('animation') === 'none',
  )
  .flatMap(({ selectors }) => selectors.flatMap(expandIs));

/** The wrappers whose children are numbered across, left to right. */
const COLUMN_WRAPPERS = baseRules(css)
  .filter(({ declarations }) => declarations.get('--dsp-column') === '0')
  .flatMap(({ selectors }) => selectors)
  .map((selector) => selector.replace(/ > \*:nth-child\(1\)$/, ''));

const ROWS = highestNthChild(css, '.dsp-card-body > *');
const EQ_ROWS = highestNthChild(css, '.dsp-eq > *');
const COLUMNS = highestNthChild(
  css,
  `${COLUMN_WRAPPERS[0] ?? '.dsp-denoise-modules'} > *`,
);

const label = (element: Element) =>
  `${element.tagName.toLowerCase()}.${Array.from(element.classList).join('.')}`;

const arrives = (element: Element, still: readonly string[]) =>
  ARRIVING.some((selector) => element.matches(selector)) &&
  !still.some((selector) => element.matches(selector));

/** Elements that arrive inside an element that is itself arriving. */
const arrivingTwice = (card: Element, still: readonly string[]) =>
  Array.from(card.querySelectorAll('*'))
    .filter((element) => arrives(element, still))
    .flatMap((element) => {
      const moving: string[] = [];
      for (
        let parent = element.parentElement;
        parent && parent !== card;
        parent = parent.parentElement
      ) {
        if (arrives(parent, still)) {
          moving.push(`${label(element)} inside ${label(parent)}`);
        }
      }
      return moving;
    });

/** Rows of the card with nothing in them that arrives. */
const standingStill = (card: Element, still: readonly string[]) =>
  Array.from(card.querySelectorAll(':scope > .dsp-card-body > *'))
    .filter(
      (row) =>
        !arrives(row, still) &&
        !Array.from(row.querySelectorAll('*')).some((inner) =>
          arrives(inner, still),
        ),
    )
    .map(label);

/** Children numbered past the last beat the stylesheet writes for them. */
const pastTheLastBeat = (card: Element) => [
  ...Array.from(card.querySelectorAll('.dsp-card-body'))
    .filter((body) => body.children.length > ROWS)
    .map((body) => `${label(body)} has ${body.children.length} rows`),
  ...Array.from(card.querySelectorAll('.dsp-eq'))
    .filter((eq) => eq.children.length > EQ_ROWS)
    .map((eq) => `${label(eq)} has ${eq.children.length} rows`),
  ...COLUMN_WRAPPERS.flatMap((wrapper) =>
    Array.from(card.querySelectorAll(wrapper))
      .filter((row) => row.children.length > COLUMNS)
      .map((row) => `${label(row)} has ${row.children.length} columns`),
  ),
];

const renderPanel = () =>
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, isEnabled: true }}
    >
      <DspPanel
        settings={DSP_DEFAULTS}
        onChange={() => undefined}
        onCommit={() => undefined}
        engineState="running"
      />
    </FluidEqProviderWrapper>,
  );

beforeEach(() => {
  resetAudioEngineStatus();
  jest.mocked(getAudioEngineStatus).mockResolvedValue(APO_STATUS);
  act(() => {
    claimPlayback('library');
    setDspNativeState('engaged');
  });
});

afterEach(() =>
  act(() => {
    stopAllPlayback();
    setDspNativeState('idle');
  }),
);

describe('a DSP processor page arriving', () => {
  it('reads its rules from the stylesheet it ships', () => {
    // Everything below passes vacuously if these come back empty.
    expect(ARRIVING).toContain('.dsp-card-body > *');
    expect(ARRIVING).toContain('.dsp-stage .dsp-card-header');
    expect(HOLDING_STILL.length).toBeGreaterThan(0);
    expect(COLUMN_WRAPPERS).toContain('.dsp-denoise-modules');
    expect(ROWS).toBeGreaterThan(0);
    expect(EQ_ROWS).toBeGreaterThan(0);
    expect(COLUMNS).toBeGreaterThan(0);
  });

  it.each([...DSP_SECTIONS, ...DSP_PLAYBACK_SECTIONS])(
    '$id: the card holds still, every row arrives, and nothing arrives twice',
    ({ id: section, labelKey }) => {
      const { container } = renderPanel();
      const tab = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.dsp-rail-tab'),
      ).find((button) => button.title === en[labelKey]);
      if (!tab) {
        throw new Error(`no rail tab for ${section}`);
      }
      fireEvent.click(tab);
      const card = container.querySelector('.dsp-stage > .dsp-card');
      if (!card) {
        throw new Error(`no card for ${section}`);
      }
      // The page that was asked for, and not the one already open: a click
      // that did not land would check the Normalizer ten times.
      expect(card.id).toBe(
        `dsp-${section.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      );

      expect(arrives(card, HOLDING_STILL)).toBe(false);
      const header = card.querySelector(':scope > .dsp-card-header');
      expect(header && arrives(header, HOLDING_STILL)).toBe(true);
      expect(arrivingTwice(card, HOLDING_STILL)).toEqual([]);
      expect(standingStill(card, HOLDING_STILL)).toEqual([]);
      expect(pastTheLastBeat(card)).toEqual([]);
    },
  );

  it('POSITIVE CONTROL: without the wrappers holding still, the grouped rows arrive twice', () => {
    const { container } = renderPanel();
    const card = container.querySelector('.dsp-stage > .dsp-card');
    if (!card) {
      throw new Error('no card');
    }
    expect(arrivingTwice(card, []).length).toBeGreaterThan(0);
  });

  it('lists every filter in the rail the stagger is written for', () => {
    const { container } = renderPanel();
    expect(
      container.querySelectorAll('.dsp-rail-processors > .dsp-rail-tab'),
    ).toHaveLength(
      highestNthChild(css, '.dsp-rail-processors > .dsp-rail-tab'),
    );
  });
});
