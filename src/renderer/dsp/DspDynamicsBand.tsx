/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef, type CSSProperties } from 'react';
import type { IDynamicsBand } from '../../common/dsp/dynamicsStage';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsCurve from './DspDynamicsCurve';
import DspDynamicsReadout from './DspDynamicsReadout';
import DspDynamicsValues from './DspDynamicsValues';
import { dynamicsPlot } from './dynamicsPlot';
import useBoxWidth from './useBoxWidth';
import type { IDynamicsBus } from './useDynamicsLive';

export interface IDynamicsBandMeta {
  title: TranslationKey;
  range: TranslationKey;
  hint: TranslationKey;
}

export const DYNAMICS_BAND_META: readonly IDynamicsBandMeta[] = [
  {
    title: 'dsp.dynamics.band.low',
    range: 'dsp.dynamics.band.lowRange',
    hint: 'dsp.dynamics.band.lowHint',
  },
  {
    title: 'dsp.dynamics.band.mid',
    range: 'dsp.dynamics.band.midRange',
    hint: 'dsp.dynamics.band.midHint',
  },
  {
    title: 'dsp.dynamics.band.high',
    range: 'dsp.dynamics.band.highRange',
    hint: 'dsp.dynamics.band.highHint',
  },
];

/**
 * The square's largest side: three across stop growing here, where the
 * curve already reads at a glance, and a narrow card's one large curve
 * stops a little later so the values and the timing stay in view under it.
 */
const LARGEST_SIDE = 340;
const LARGEST_ALONE = 400;
/** What a curve is drawn at before its box has a width (not laid out). */
const UNMEASURED = 240;

interface IProps {
  index: number;
  band: IDynamicsBand;
  makeupDb: number;
  mix: number;
  isAlone: boolean;
  isDisabled: boolean;
  bus: IDynamicsBus;
  onBand: (next: IDynamicsBand) => void;
  onCommit: () => void;
  /** Given while the band is one of the narrow card's tabs. */
  tabbed?: { id: string; tabId: string };
}

/**
 * One band of the stage: its name, range and live gain, its curve, and its
 * values. The curve is drawn at the width the band's box is given, measured
 * before the first paint, so the panel stands at its full height from the
 * first frame and the page under it never moves.
 */
const DspDynamicsBand = ({
  index,
  band,
  makeupDb,
  mix,
  isAlone,
  isDisabled,
  bus,
  onBand,
  onCommit,
  tabbed,
}: IProps) => {
  const { t } = useTranslation();
  const meta = DYNAMICS_BAND_META[index];
  const box = useRef<HTMLDivElement>(null);
  const width = useBoxWidth(box);
  const plot = useMemo(
    () =>
      dynamicsPlot(
        width > 0 ? width : UNMEASURED,
        isAlone ? LARGEST_ALONE : LARGEST_SIDE,
      ),
    [isAlone, width],
  );
  const name = t(meta.title);
  return (
    <section
      className={`dsp-band dsp-dynamics-band is-band-${index}`}
      style={{ '--dynamics-plot-width': `${plot.width}px` } as CSSProperties}
      aria-label={tabbed ? undefined : name}
      id={tabbed?.id}
      role={tabbed ? 'tabpanel' : undefined}
      aria-labelledby={tabbed?.tabId}
    >
      <div className="dsp-dynamics-band__head">
        <span className="dsp-dynamics-band__name" title={t(meta.hint)}>
          <span className="dsp-band-title">{name}</span>
          <span className="dsp-dynamics-band__range">{t(meta.range)}</span>
        </span>
        <DspDynamicsReadout index={index} bus={bus} />
      </div>
      <div ref={box} className="dsp-dynamics-band__plot">
        <DspDynamicsCurve
          index={index}
          band={band}
          makeupDb={makeupDb}
          mix={mix}
          plot={plot}
          bandName={name}
          isDisabled={isDisabled}
          bus={bus}
          onBand={onBand}
          onCommit={onCommit}
        />
      </div>
      <DspDynamicsValues
        band={band}
        bandName={name}
        isDisabled={isDisabled}
        onBand={onBand}
        onCommit={onCommit}
      />
    </section>
  );
};

export default DspDynamicsBand;
