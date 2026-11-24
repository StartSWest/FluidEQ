/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState } from 'react';
import type {
  IDynamicsBand,
  IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsBand from './DspDynamicsBand';
import DspDynamicsTabs from './DspDynamicsTabs';
import DspDynamicsTiming from './DspDynamicsTiming';
import type { IDynamicsBandLive } from './dynamicsLive';
import useBoxWidth from './useBoxWidth';
import type { IDynamicsBus } from './useDynamicsLive';

interface IProps {
  dynamics: IDynamicsSettings;
  onPatch: (next: IDynamicsSettings) => void;
  onCommit: () => void;
  /**
   * Where the live readings come from: the engine's on the card itself
   * (`useDynamicsLive`), a still one for Help's drawing on example settings.
   */
  bus: IDynamicsBus;
}

/**
 * Under this width three curves side by side would each be too small to
 * drag a point on (the Mic tab gives each about 175 px), so the card shows
 * the bands as tabs over one large curve. The CARD's width decides, not the
 * window's: the same card stands beside the Mic tab's rail and alone on the
 * DSP page.
 */
export const DYNAMICS_NARROW_BELOW = 760;

const BANDS = [0, 1, 2] as const;

/** Whether sound has reached any band, which is when the dots can be dragged against. */
const isHeard = (bands: readonly IDynamicsBandLive[] | undefined) =>
  bands?.some((band) => band.state !== 'silent') ?? false;

/**
 * The Dynamics stage's controls, the same on the DSP page, the Mic tab and
 * Help: each band's curve with its live dot and its values, then the timing
 * all three share. Direction A of the compressor mockups, which Ivan chose
 * on 2026-11-24.
 */
export default function DspDynamicsControls({
  dynamics,
  onPatch,
  onCommit,
  bus,
}: IProps) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const hints = useRef<HTMLParagraphElement>(null);
  const width = useBoxWidth(root);
  const isNarrow = width > 0 && width < DYNAMICS_NARROW_BELOW;
  const [chosen, setChosen] = useState(0);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const isOff = !dynamics.enabled;

  useEffect(
    () =>
      bus.subscribe((frame) => {
        if (frame.labels) {
          hints.current?.setAttribute(
            'data-heard',
            isHeard(frame.bands) ? 'yes' : 'no',
          );
        }
      }),
    [bus],
  );

  /** A sound edit stops a profile being that profile. */
  const patch = (next: Partial<IDynamicsSettings>) =>
    onPatch({ ...dynamics, ...next, presetId: '' });
  const patchBand = (index: number, next: IDynamicsBand) => {
    const bands: IDynamicsSettings['bands'] = [
      dynamics.bands[0],
      dynamics.bands[1],
      dynamics.bands[2],
    ];
    bands[index] = next;
    patch({ bands });
  };
  const idOf = (index: number) => ({
    tab: `dsp-dynamics-${id}-tab-${index}`,
    panel: `dsp-dynamics-${id}-panel-${index}`,
  });
  const band = (index: number, isAlone: boolean) => (
    <DspDynamicsBand
      key={index}
      index={index}
      band={dynamics.bands[index]}
      makeupDb={dynamics.makeupDb}
      mix={dynamics.mix}
      isAlone={isAlone}
      isDisabled={isOff}
      bus={bus}
      onBand={(next) => patchBand(index, next)}
      onCommit={onCommit}
      tabbed={
        isAlone ? { id: idOf(index).panel, tabId: idOf(index).tab } : undefined
      }
    />
  );

  return (
    <div
      ref={root}
      className={`dsp-dynamics-curves${isNarrow ? ' is-narrow' : ''}${
        isOff ? ' is-off' : ''
      }`}
    >
      <div className="dsp-dynamics-head">
        <ul className="dsp-dynamics-key" aria-hidden="true">
          <li className="dsp-dynamics-key__item is-now">
            {t('dsp.dynamics.key.now')}
          </li>
          <li className="dsp-dynamics-key__item is-lifted">
            {t('dsp.dynamics.key.lifted')}
          </li>
          <li className="dsp-dynamics-key__item is-held">
            {t('dsp.dynamics.key.held')}
          </li>
          <li className="dsp-dynamics-key__item is-untouched">
            {t('dsp.dynamics.untouched')}
          </li>
        </ul>
        {/* Both sentences hold the same place, one hidden, so the row is as
            tall as the longer one whether music is playing or not. */}
        <p
          ref={hints}
          className="dsp-dynamics-hints"
          data-heard={isHeard(bus.last()?.bands) ? 'yes' : 'no'}
        >
          <span className="dsp-dynamics-hint is-heard">
            {t('dsp.dynamics.dragHint')}
          </span>
          <span className="dsp-dynamics-hint is-idle">
            {t('dsp.dynamics.idleHint')}
          </span>
        </p>
      </div>

      {isNarrow ? (
        <div className="dsp-dynamics-alone">
          <DspDynamicsTabs
            chosen={chosen}
            bus={bus}
            idOf={idOf}
            onChoose={setChosen}
          />
          {band(chosen, true)}
        </div>
      ) : (
        <div className="dsp-dynamics-bands">
          {BANDS.map((index) => band(index, false))}
        </div>
      )}

      <DspDynamicsTiming
        dynamics={dynamics}
        isDisabled={isOff}
        onPatch={patch}
        onCommit={onCommit}
      />
    </div>
  );
}
