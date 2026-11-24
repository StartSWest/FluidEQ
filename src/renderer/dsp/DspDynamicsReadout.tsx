/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import {
  DYNAMICS_STATES,
  formatGainDb,
  type IDynamicsBandLive,
  type TDynamicsState,
} from './dynamicsLive';
import type { IDynamicsBus } from './useDynamicsLive';

/** The word each state shows; a band of an engine that cannot say shows none. */
const WORD: Record<TDynamicsState, TranslationKey | undefined> = {
  silent: 'dsp.dynamics.state.silent',
  unknown: undefined,
  off: 'dsp.bypassed',
  untouched: 'dsp.dynamics.untouched',
  lifting: 'dsp.dynamics.state.lifting',
  holding: 'dsp.dynamics.state.holding',
};

/** A band's figure as the readouts print it, or a dash where none is known. */
export const figureOf = (live: IDynamicsBandLive | undefined) => {
  if (!live || live.state === 'unknown') {
    return '—';
  }
  return formatGainDb(live.now?.gainDb ?? 0);
};

/**
 * Writes a live figure into the text node React rendered, never a new one:
 * replacing the element's children would leave React holding a node that
 * is no longer in the page, and its next render would write into nothing.
 */
export const writeText = (element: HTMLElement | null, text: string) => {
  const node = element?.firstChild;
  if (node instanceof Text) {
    if (node.nodeValue !== text) {
      node.nodeValue = text;
    }
  } else if (element) {
    element.textContent = text;
  }
};

/**
 * Keeps an element's figure and state with the band's live reading, written
 * straight onto the element four times a second: never a render per frame.
 */
export const useBandReading = (
  bus: IDynamicsBus,
  index: number,
  write: (live: IDynamicsBandLive) => void,
) => {
  const writer = useRef(write);
  writer.current = write;
  useEffect(
    () =>
      bus.subscribe((frame) => {
        const live = frame.bands[index];
        if (frame.labels && live) {
          writer.current(live);
        }
      }),
    [bus, index],
  );
};

interface IProps {
  index: number;
  bus: IDynamicsBus;
}

/**
 * The band's gain now, large, with what it is doing under it. Every word it
 * can say is laid out in the same place and all but one hidden, so the
 * readout is as wide as its longest word in every language from the first
 * frame, and a band going from "Untouched" to "Holding" moves nothing.
 */
const DspDynamicsReadout = ({ index, bus }: IProps) => {
  const { t } = useTranslation();
  const root = useRef<HTMLSpanElement>(null);
  const figure = useRef<HTMLSpanElement>(null);
  const first = bus.last()?.bands[index];

  useBandReading(bus, index, (live) => {
    root.current?.setAttribute('data-state', live.state);
    writeText(figure.current, figureOf(live));
  });

  return (
    <span
      ref={root}
      className="dsp-dynamics-readout"
      data-state={first?.state ?? 'silent'}
    >
      <span className="dsp-dynamics-readout__value">
        <span ref={figure}>{figureOf(first)}</span>
        <small>dB</small>
      </span>
      <span className="dsp-dynamics-readout__states">
        {DYNAMICS_STATES.map((state) => {
          const key = WORD[state];
          return (
            <span
              key={state}
              className="dsp-dynamics-readout__state"
              data-for={state}
            >
              {key ? t(key) : ''}
            </span>
          );
        })}
      </span>
    </span>
  );
};

export default DspDynamicsReadout;
