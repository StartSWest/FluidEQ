/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  environmentDb,
  FOOTSTEPS_DEFAULTS,
  IFootstepsSettings,
} from '../../common/dsp/footsteps';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import DspGameMeter from './DspGameMeter';
import { readDspGameReport } from './footstepsTelemetry';

interface IDspGameEnvironmentProps {
  footsteps: IFootstepsSettings;
  /** The engine runs Environment: from 1.26, and always in the Library. */
  isHeard: boolean;
  onEdit: (next: Partial<IFootstepsSettings>) => void;
  onCommit: () => void;
}

const HEARD_DB = 0.3;

const signed = (db: number): string =>
  `${db < 0 ? '−' : '+'}${Math.abs(db).toFixed(1)} dB`;

/**
 * The Game filter's Environment: one dial from the bed turned down to the
 * bed turned up, centred on the game as it was made, and a lamp filled by
 * how much of what is playing the engine reads as environment — with the
 * gain it is giving it now.
 */
const DspGameEnvironment = ({
  footsteps,
  isHeard,
  onEdit,
  onCommit,
}: IDspGameEnvironmentProps) => {
  const { t } = useTranslation();
  const isOff = !footsteps.enabled || !isHeard;
  const db = environmentDb(footsteps.environment);
  let reach = t('dsp.game.environmentLeft');
  if (db <= -0.05) {
    reach = t('dsp.game.environmentDown', { db: Math.abs(db).toFixed(1) });
  } else if (db >= 0.05) {
    reach = t('dsp.game.environmentUp', { db: db.toFixed(1) });
  }

  return (
    <section className="dsp-band dsp-game-part is-environment">
      <span className="dsp-band-title">{t('dsp.game.environment')}</span>
      <p className="dsp-band-hint">{t('dsp.game.environmentHint')}</p>
      <div className="dsp-band-dials">
        <Dial
          labelKey="dsp.game.environmentDial"
          value={footsteps.environment * 100}
          defaultValue={FOOTSTEPS_DEFAULTS.environment * 100}
          min={-100}
          max={100}
          unit="%"
          step={1}
          isDisabled={isOff}
          onCommit={onCommit}
          onChange={(value) => onEdit({ environment: value / 100 })}
        />
      </div>
      <div className="dsp-game-reach">
        <span
          className={`dsp-footsteps-reach is-environment${
            db >= 0.05 ? ' is-up' : ''
          }`}
        >
          {reach}
        </span>
      </div>
      <DspGameMeter
        label={t('dsp.game.ambienceMeter')}
        tone="ambience"
        read={() => {
          const game = footsteps.enabled ? readDspGameReport() : undefined;
          if (!game) {
            return undefined;
          }
          return {
            fill: game.ambience,
            figure:
              Math.abs(game.environmentDb) >= HEARD_DB
                ? signed(game.environmentDb)
                : '',
          };
        }}
      />
    </section>
  );
};

export default DspGameEnvironment;
