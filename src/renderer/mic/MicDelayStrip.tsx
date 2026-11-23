/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab's delay, as the engine measures it on the mic: Windows' block,
 * then each stage that adds anything, in the order the voice meets them,
 * each part labelled inside the bar where it fits (Ivan's pick, mockup A,
 * 2026-11-23). Short parts are widened to carry their label; on a narrow
 * card they shrink to slivers and a legend under the bar names them.
 *
 * Nothing here is worked out from the dials. Until the engine has written a
 * status for the mic the total is a dash: a delay that is wrong for a
 * 960-frame device block, a model that did not load or a reducer switched on
 * is worse than none.
 */

import type { ReactNode } from 'react';
import type {
  IEngineOutputHealth,
  TLatencyStage,
} from '../../common/engineHealth';
import type { TranslationKey } from '../../common/i18n';
import { STAGE_NAMES } from '../components/LatencyReadout';
import { useTranslation } from '../utils/I18nContext';

/** The mic's own names for the stages it has; the rack's for the rest. */
const MIC_STAGE_NAMES: Partial<Record<TLatencyStage, TranslationKey>> = {
  restoration: 'mic.stage.cleaner',
  deEsser: 'mic.stage.deEsser',
  maximizer: 'mic.stage.limiter',
};

/** Under this a part is a sliver on a narrow card, named by the legend. */
const SHORT_MS = 4;

const toMs = (value: number) => {
  const tenths = Math.round(value * 10) / 10;
  if (tenths === 0) {
    return '0';
  }
  // "2", not "2.0": the short parts carry their names in 76px, and the rail
  // beside the bar writes the same delay the same way.
  return tenths >= 10
    ? String(Math.round(value))
    : tenths.toFixed(1).replace(/\.0$/, '');
};

interface IPart {
  key: string;
  label: string;
  ms: number;
  kind: 'windows' | 'cleaner' | 'other';
}

interface IMicDelayStripProps {
  health: IEngineOutputHealth | undefined;
  /** "Hear the final result", beside the delay it is heard after. */
  children?: ReactNode;
}

const MicDelayStrip = ({ health, children }: IMicDelayStripProps) => {
  const { t } = useTranslation();
  const latency = health?.latency;
  const periodMs = health?.load?.periodMs;
  const parts: IPart[] = [];
  if (periodMs !== undefined) {
    parts.push({
      key: 'windows',
      label: t('mic.delay.windows'),
      ms: periodMs,
      kind: 'windows',
    });
  }
  if (latency && latency.rate > 0) {
    latency.parts
      .filter((part) => part.frames > 0)
      .forEach((part) => {
        parts.push({
          key: part.stage,
          label: t(MIC_STAGE_NAMES[part.stage] ?? STAGE_NAMES[part.stage]),
          ms: (part.frames * 1000) / latency.rate,
          kind: part.stage === 'restoration' ? 'cleaner' : 'other',
        });
      });
  }
  const known = latency !== undefined && periodMs !== undefined;
  const total = parts.reduce((sum, part) => sum + part.ms, 0);
  const spoken = parts
    .map((part) => `${part.label} ${toMs(part.ms)} ms`)
    .join(', ');
  const short = parts.filter((part) => part.ms < SHORT_MS);

  return (
    <section className="mic-delay" aria-label={t('mic.delay.label')}>
      <div className="mic-delay__figures">
        <p className="mic-delay__head">
          <span className="mic-delay__label">{t('mic.delay.label')}</span>
          <span className="mic-delay__total">
            {known ? t('dsp.latency.ms', { ms: toMs(total) }) : '—'}
          </span>
          <span className="mic-delay__note">
            {known ? t('mic.delay.measured') : t('mic.delay.unknown')}
          </span>
        </p>
        {known && (
          <>
            <div
              className="mic-delay__bar"
              role="img"
              aria-label={`${t('mic.delay.label')} ${toMs(total)} ms: ${spoken}`}
            >
              {parts.map((part) => (
                <span
                  key={part.key}
                  className={`mic-delay__part is-${part.kind}${
                    part.ms < SHORT_MS ? ' is-short' : ''
                  }`}
                  style={{ flexGrow: part.ms }}
                >
                  <span className="mic-delay__part-text">
                    {part.label} {toMs(part.ms)}
                  </span>
                </span>
              ))}
            </div>
            {short.length > 0 && (
              <ul className="mic-delay__legend">
                {short.map((part) => (
                  <li key={part.key}>
                    <span
                      className={`mic-delay__swatch is-${part.kind}`}
                      aria-hidden="true"
                    />
                    {part.label} {t('dsp.latency.ms', { ms: toMs(part.ms) })}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {children !== undefined && (
        <div className="mic-delay__monitor">{children}</div>
      )}
    </section>
  );
};

export default MicDelayStrip;
