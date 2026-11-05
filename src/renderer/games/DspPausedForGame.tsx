/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { IDspSettings } from '../../common/dsp/chain';
import type { ErrorDescription } from '../../common/errors';
import DspSectionIcon from '../dsp/DspSectionIcon';
import { dspPresetCatalog } from '../dsp/dspPresetCatalog';
import { DSP_SECTIONS } from '../dsp/sections';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { openGamingLab } from './gamingLabEvents';
import { rackStageIsOn } from './gamingStages';
import { putMusicSoundBack } from './useGameSound';

interface IDspPausedForGameProps {
  gameName: string;
  /** The music sound's rack, waiting for the game to end. */
  musicDsp?: IDspSettings;
}

/**
 * The DSP page while a game's own sound is on (Ivan, 2026-11-02).
 *
 * The rack playing then is the game's copy, tuned in the Gaming Lab and
 * nowhere else, so this page does not offer to edit it: two places to tune
 * one game was the jumping back and forth he would not have. What it shows is
 * the truth about the music sound — paused, named, the stages it will bring
 * back — with the way to the game's own sound as the loud button, and the
 * way back to the music beside it. The crossfade is the Library's transition
 * between songs, not a stage of the rack, so it is not listed.
 */
const DspPausedForGame = ({ gameName, musicDsp }: IDspPausedForGameProps) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqContext();
  const [busy, setBusy] = useState(false);
  const presetId = musicDsp?.presetId;
  const music =
    (presetId
      ? dspPresetCatalog(t).find((one) => one.id === presetId)?.name
      : undefined) ?? t('dsp.eqPreset.custom');
  const waiting = musicDsp
    ? DSP_SECTIONS.filter(
        ({ id }) => id !== 'crossfade' && rackStageIsOn(id, musicDsp),
      )
    : undefined;

  return (
    <div className="dsp-panel gaming-paused">
      <header className="dsp-header">
        <div className="dsp-header-line">
          <h2 className="dsp-title">{t('dsp.title')}</h2>
          <div className="dsp-presets dsp-eq-bar gaming-paused__bar">
            <div className="dsp-eq-preset dsp-eq-preset-first">
              <span className="dsp-eq-preset-label">{t('dsp.presets')}</span>
              <span className="gaming-paused__music">{music}</span>
            </div>
            <span className="gaming-paused__notice" role="status">
              <span className="gaming-dot is-lavender" aria-hidden="true" />
              {t('gaming.paused.notice', { game: gameName })}
            </span>
            <div className="gaming-paused__actions">
              <button
                type="button"
                className="button small"
                onClick={openGamingLab}
              >
                {t('gaming.paused.tune', { game: gameName })}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  putMusicSoundBack()
                    .catch((error: unknown) =>
                      setGlobalError(error as ErrorDescription),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                {t('gaming.action.unload')}
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="gaming-paused__body">
        <svg
          className="gaming-paused__art"
          viewBox="0 0 120 72"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            className="gaming-paused__rack"
            d="M18 18h52v36H18zM18 30h52M18 42h52"
          />
          <path className="gaming-paused__pause" d="M38 22v4M44 22v4" />
          <path
            className="gaming-paused__pad"
            d="M86 30h14a9 9 0 0 1 9 9v1.5a6.5 6.5 0 0 1-11.4 4.3L96 43h-6l-1.6 1.8A6.5 6.5 0 0 1 77 40.5V39a9 9 0 0 1 9-9z"
          />
        </svg>
        <p className="gaming-paused__title">{t('gaming.paused.title')}</p>
        <p className="gaming-paused__more">
          {t('gaming.paused.body', { game: gameName })}
        </p>
        {waiting && (
          <section
            className="gaming-paused__waiting"
            aria-label={t('gaming.paused.stages', { preset: music })}
          >
            <span className="gaming-cap">
              {t('gaming.paused.stages', { preset: music })}
            </span>
            {waiting.length > 0 ? (
              <ul className="gaming-paused__stages">
                {waiting.map(({ id, labelKey }) => (
                  <li key={id} className="gaming-paused__stage">
                    <DspSectionIcon section={id} />
                    {t(labelKey)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gaming-paused__none">{t('gaming.paused.none')}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default DspPausedForGame;
