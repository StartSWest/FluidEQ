/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IEngineLatency, TLatencyStage } from 'common/engineHealth';
import type { TranslationKey } from 'common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import '../styles/LatencyReadout.scss';

/**
 * Each stage by the name the app already gives it where it has one, so the
 * breakdown reads in the listener's own vocabulary for the rack and the EQ.
 */
const STAGE_NAMES: Record<TLatencyStage, TranslationKey> = {
  // The card's name rather than one of its modes: the delay is its peak
  // guard's, which it keeps in every mode, leveling or not.
  leveler: 'dsp.normalizer.title',
  restoration: 'dsp.denoise.title',
  exciter: 'dsp.exciter.title',
  bassForge: 'dsp.bassForge.title',
  linearEq: 'dsp.eq.title',
  bassPunch: 'dsp.bassPunch.title',
  room: 'dsp.room.title',
  dimension: 'dsp.dimension.title',
  maximizer: 'dsp.maximizer.title',
  headroom: 'dsp.master.autoHeadroom',
  master: 'dsp.master.title',
  eqPhase: 'eq.title',
  curvePhase: 'eq.mode.curves',
  convolution: 'eq.layers.convolution',
  curves: 'dsp.latency.stage.curves',
  guard: 'dsp.latency.stage.guard',
  filters: 'eq.title',
  preamp: 'sidebar.preamp',
};

/**
 * Milliseconds as a listener reads them: whole from ten up, one decimal
 * below, where the difference between 2 and 2.9 is most of what there is to
 * see. Nothing at all is "0", not "0.0" — there is no fraction of nothing.
 */
export const formatLatencyMs = (frames: number, rate: number): string => {
  if (frames === 0) {
    return '0';
  }
  const ms = (frames * 1000) / rate;
  const tenths = Math.round(ms * 10) / 10;
  return tenths >= 10 ? String(Math.round(ms)) : tenths.toFixed(1);
};

interface ILatencyReadoutProps {
  latency: IEngineLatency;
  gameMode: boolean;
}

/**
 * Buffering added by the processing stages, reported by the running engine.
 *
 * The total always, beside the name of the page — the DSP page's line that
 * says where the rack runs, the EQ page's heading — because it is a property
 * of the whole path those pages configure; the stages it comes from one press
 * away, because a number nobody can act on is a number nobody reads twice.
 * Game mode gives the readout its active colour; its independent switch is
 * shared by the EQ and DSP pages.
 */
const LatencyReadout = ({ latency, gameMode }: ILatencyReadoutProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // State rather than a ref: the menu is placed from it, and a ref arriving
  // would not render the menu again to be placed.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  // Portalled out of the page, so its own surface has to count as inside
  // when deciding whether a press elsewhere closes it.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !anchor?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, anchor]);

  const total = t('dsp.latency.ms', {
    ms: formatLatencyMs(latency.frames, latency.rate),
  });
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={`latency-readout${gameMode ? ' is-game' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={t('dsp.latency.hint')}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="latency-readout__name">{t('dsp.latency.label')}</span>
        <span className="latency-readout__value">{total}</span>
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className={`latency-readout-menu${gameMode ? ' is-game' : ''}`}
        role="dialog"
        ariaLabel={t('dsp.latency.title')}
        align="left"
      >
        {/* No game-mode badge here: the chip it hangs from says so, and the
            note under the figures says what it did. */}
        <p className="latency-readout-menu__title">{t('dsp.latency.title')}</p>
        {latency.parts.length > 0 ? (
          <ul className="latency-readout-menu__parts">
            {latency.parts.map((part) => (
              <li key={part.stage} className="latency-readout-menu__part">
                <span className="latency-readout-menu__stage">
                  {t(STAGE_NAMES[part.stage])}
                  {part.active === false && part.frames > 0 ? (
                    <small className="latency-readout-menu__buffer">
                      {t('dsp.latency.buffer')}
                    </small>
                  ) : null}
                </span>
                {/* Its share of the whole, so the one stage worth changing
                    is the one that stands out before a number is read. */}
                <span
                  className="latency-readout-menu__share"
                  aria-hidden="true"
                >
                  {part.frames > 0 && latency.frames > 0 ? (
                    <span
                      style={{
                        width: `${Math.min(1, part.frames / latency.frames) * 100}%`,
                      }}
                    />
                  ) : null}
                </span>
                <span className="latency-readout-menu__ms">
                  {t('dsp.latency.ms', {
                    ms: formatLatencyMs(part.frames, latency.rate),
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : undefined}
        <p className="latency-readout-menu__total">
          <span>{t('dsp.latency.total')}</span>
          <span className="latency-readout-menu__ms">{total}</span>
        </p>
        <p className="latency-readout-menu__note">
          {t(gameMode ? 'dsp.latency.gameNote' : 'dsp.latency.note')}
        </p>
      </AnchoredMenu>
    </>
  );
};

export default LatencyReadout;
