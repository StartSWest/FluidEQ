/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { TranslationKey } from '../../common/i18n';
import { useTranslation } from '../utils/I18nContext';
import {
  IKaraokeWhisperMemorySettings,
  IKaraokeWhisperSessionSnapshot,
} from './makerAi';

/** The three answers to "what should happen to the model when idle". */
const POLICIES = ['ask', 'auto', 'keep'] as const;

/** How long "idle" is allowed to mean, in minutes. */
const IDLE_CHOICES = [5, 10, 30] as const;

interface IKaraokeMakerSpeechMemoryPanelProps {
  session: IKaraokeWhisperSessionSnapshot;
  /** Resolved by the caller: ready in RAM, cached on disk, or not downloaded. */
  statusKey: TranslationKey;
  onRelease: () => void;
  onSettingsChange: (settings: IKaraokeWhisperMemorySettings) => void;
}

/**
 * What the local speech model is doing with the machine's memory.
 *
 * The one part of the Maker's advanced tools that is not a button: a status
 * light, a release control that only appears when there is something to
 * release, and two rows of choices about when to let the model go. Sixty-five
 * lines that had no reason to be interleaved with four toolbar buttons beyond
 * both appearing in the same popover.
 *
 * Four props, because the session snapshot arrives whole. Splitting it into
 * `inMemory`, `busy`, `policy` and `idleMinutes` would double the list to say
 * exactly the same thing, and the store already publishes it as one value.
 */
const KaraokeMakerSpeechMemoryPanel = ({
  session,
  statusKey,
  onRelease,
  onSettingsChange,
}: IKaraokeMakerSpeechMemoryPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="karaoke-maker__memory-panel">
      <div className="karaoke-maker__memory-heading">
        <span
          className={session.inMemory ? 'is-ready' : undefined}
          aria-hidden="true"
        />
        <strong>{t('karaoke.maker.speechMemory')}</strong>
        <em>{t(statusKey)}</em>
        {session.inMemory && (
          <button type="button" disabled={session.busy} onClick={onRelease}>
            {t('karaoke.maker.freeMemory')}
          </button>
        )}
      </div>
      <span className="karaoke-maker__memory-label">
        {t('karaoke.maker.memoryAfterUse')}
      </span>
      <div className="karaoke-maker__memory-options" role="group">
        {POLICIES.map((policy) => (
          <button
            key={policy}
            type="button"
            className={session.settings.policy === policy ? 'is-active' : ''}
            onClick={() => onSettingsChange({ ...session.settings, policy })}
          >
            {t(`karaoke.maker.memoryPolicy.${policy}`)}
          </button>
        ))}
      </div>
      {/* Nothing to delay when the answer is "never let it go". */}
      {session.settings.policy !== 'keep' && (
        <div className="karaoke-maker__memory-delay" role="group">
          <span>{t('karaoke.maker.memoryAfter')}</span>
          {IDLE_CHOICES.map((idleMinutes) => (
            <button
              key={idleMinutes}
              type="button"
              className={
                session.settings.idleMinutes === idleMinutes ? 'is-active' : ''
              }
              onClick={() =>
                onSettingsChange({ ...session.settings, idleMinutes })
              }
            >
              {t('karaoke.maker.memoryMinutes', { count: idleMinutes })}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default KaraokeMakerSpeechMemoryPanel;
