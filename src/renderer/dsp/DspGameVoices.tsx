/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  duckDb,
  FOOTSTEPS_DEFAULTS,
  IFootstepsSettings,
  VOICES_MAX_LIFT_DB,
} from '../../common/dsp/footsteps';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { Dial } from './DspControls';
import DspGameMeter from './DspGameMeter';
import { readDspGameReport } from './footstepsTelemetry';

interface IDspGameVoicesProps {
  footsteps: IFootstepsSettings;
  /** The engine runs Dialogue: from 1.26, and always in the Library. */
  isHeard: boolean;
  onEdit: (next: Partial<IFootstepsSettings>) => void;
  onCommit: () => void;
}

/** A tenth of a decibel is not heard, and printed it flickers. */
const HEARD_DB = 0.3;

const signed = (db: number): string =>
  `${db < 0 ? '−' : '+'}${Math.abs(db).toFixed(1)} dB`;

/**
 * The Game filter's Dialogue: how far a voice in the centre comes forward,
 * whether everything else steps back for it, and a lamp that lights while
 * the engine hears somebody speaking — with what it did, the voice's lift
 * and the rest's step back, beside it.
 */
const DspGameVoices = ({
  footsteps,
  isHeard,
  onEdit,
  onCommit,
}: IDspGameVoicesProps) => {
  const { t } = useTranslation();
  const isOff = !footsteps.enabled || !isHeard;

  return (
    <section className="dsp-band dsp-game-part is-dialogue">
      <span className="dsp-band-title">{t('dsp.game.dialogue')}</span>
      <p className="dsp-band-hint">{t('dsp.game.dialogueHint')}</p>
      <div className="dsp-band-dials">
        <Dial
          labelKey="dsp.game.voices"
          value={footsteps.voices * 100}
          defaultValue={FOOTSTEPS_DEFAULTS.voices * 100}
          min={0}
          max={100}
          unit="%"
          step={1}
          isDisabled={isOff}
          onCommit={onCommit}
          onChange={(value) => onEdit({ voices: value / 100 })}
        />
      </div>
      <div className="dsp-game-reach">
        <span className="dsp-footsteps-reach is-voice">
          {t('dsp.footsteps.upTo', {
            db: (footsteps.voices * VOICES_MAX_LIFT_DB).toFixed(1),
          })}
        </span>
      </div>
      <div className="dsp-game-toggle">
        <span className="dsp-game-toggle-words">
          <span className="dsp-game-toggle-name">{t('dsp.game.duck')}</span>
          <span className="dsp-band-hint">
            {t('dsp.game.duckHint')}{' '}
            <b className="dsp-game-figure">
              {signed(-duckDb(footsteps.voices))}
            </b>
          </span>
        </span>
        <Switch
          id="dsp-game-duck"
          isOn={footsteps.duck}
          isDisabled={isOff}
          handleToggle={() => {
            onEdit({ duck: !footsteps.duck });
            onCommit();
          }}
          ariaLabel={t('dsp.game.duck')}
        />
      </div>
      <DspGameMeter
        label={t('dsp.game.voiceMeter')}
        tone="voice"
        read={() => {
          const game = footsteps.enabled ? readDspGameReport() : undefined;
          if (!game) {
            return undefined;
          }
          const parts = [
            game.voiceDb >= HEARD_DB ? signed(game.voiceDb) : '',
            game.duckDb <= -HEARD_DB ? signed(game.duckDb) : '',
          ].filter((part) => part !== '');
          return { fill: game.voice, figure: parts.join(' · ') };
        }}
      />
    </section>
  );
};

export default DspGameVoices;
