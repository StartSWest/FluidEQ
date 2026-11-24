/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, type KeyboardEvent } from 'react';
import { DYNAMICS_BANDS } from '../../common/dsp/dynamicsStage';
import { useTranslation } from '../utils/I18nContext';
import { DYNAMICS_BAND_META } from './DspDynamicsBand';
import { figureOf, useBandReading, writeText } from './DspDynamicsReadout';
import type { IDynamicsBus } from './useDynamicsLive';

interface IProps {
  chosen: number;
  bus: IDynamicsBus;
  idOf: (index: number) => { tab: string; panel: string };
  onChoose: (index: number) => void;
}

const BANDS = Array.from({ length: DYNAMICS_BANDS }, (_, index) => index);

/** The tab a key moves to, round from the last to the first, as tabs do. */
const tabAfter = (key: string, chosen: number): number | undefined => {
  switch (key) {
    case 'ArrowRight':
      return (chosen + 1) % DYNAMICS_BANDS;
    case 'ArrowLeft':
      return (chosen + DYNAMICS_BANDS - 1) % DYNAMICS_BANDS;
    case 'Home':
      return 0;
    case 'End':
      return DYNAMICS_BANDS - 1;
    default:
      return undefined;
  }
};

/** One tab's live figure, kept by the loop like the readouts. */
const TabFigure = ({ index, bus }: { index: number; bus: IDynamicsBus }) => {
  const figure = useRef<HTMLSpanElement>(null);
  useBandReading(bus, index, (live) =>
    writeText(figure.current, figureOf(live)),
  );
  return (
    <span className="dsp-dynamics-tab__figure">
      <span ref={figure}>{figureOf(bus.last()?.bands[index])}</span> dB
    </span>
  );
};

/**
 * The narrow card's three bands as tabs, each with its gain now, so the one
 * large curve under them never hides what the other two are doing.
 */
const DspDynamicsTabs = ({ chosen, bus, idOf, onChoose }: IProps) => {
  const { t } = useTranslation();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabAfter(event.key, chosen);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onChoose(next);
    tabs.current[next]?.focus();
  };
  return (
    <div
      className="segmented dsp-dynamics-tabs"
      role="tablist"
      aria-label={t('dsp.dynamics.bands')}
    >
      {BANDS.map((index) => {
        const ids = idOf(index);
        const isChosen = index === chosen;
        return (
          <button
            key={index}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={isChosen}
            // Only the chosen band's panel is in the page to point at.
            aria-controls={isChosen ? ids.panel : undefined}
            tabIndex={isChosen ? 0 : -1}
            className={`segmented__option dsp-dynamics-tab is-band-${index}${
              isChosen ? ' is-selected' : ''
            }`}
            onClick={() => onChoose(index)}
            onKeyDown={onKey}
          >
            <span className="dsp-dynamics-tab__name">
              {t(DYNAMICS_BAND_META[index].title)}
            </span>
            <TabFigure index={index} bus={bus} />
          </button>
        );
      })}
    </div>
  );
};

export default DspDynamicsTabs;
