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

import { useEffect, useState } from 'react';
import { TranslationKey } from '../../common/i18n';
import { useTranslation } from '../utils/I18nContext';
import {
  IKaraokeWhisperMemorySettings,
  IKaraokeWhisperSessionSnapshot,
  karaokeWhisperCachedBytes,
} from './makerAi';

/** The three answers to "what should happen to the model when idle". */
const POLICIES = ['ask', 'auto', 'keep'] as const;

/** How long "idle" is allowed to mean, in minutes. */
const IDLE_CHOICES = [5, 10, 30] as const;

interface INativeModelStatus {
  separation: { loaded: boolean; bytes: number };
  pitch: { loaded: boolean; bytes: number; downloadedBytes: number };
}

interface IModelRow {
  nameKey: TranslationKey;
  inMemory: boolean;
  bytes: number;
}

/**
 * Bytes as the user's file manager writes them, so the row can be checked
 * against the folder it came from rather than taken on trust.
 */
const formatBytes = (bytes: number): string => {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1_000_000)} MB`;
};

/**
 * Resident, on disk, or absent — the three answers the row can give.
 *
 * Cached is not the same as loaded and neither is the same as downloaded: the
 * release button only wins back the first, and a row that conflated them would
 * offer to free a model that was never in RAM.
 */
const modelStatusKey = (model: IModelRow): TranslationKey => {
  if (model.inMemory) {
    return 'karaoke.maker.speechMemoryReady';
  }
  return model.bytes > 0
    ? 'karaoke.maker.speechMemoryCached'
    : 'karaoke.maker.speechMemoryMissing';
};

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
  // Main's sessions are invisible from here, so the panel asks — on mount and
  // every few seconds while open — and offers one release for everything
  // resident: the whisper worker plus whatever main is holding.
  const [native, setNative] = useState<INativeModelStatus>();
  const [whisperBytes, setWhisperBytes] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      window.electron?.ipcRenderer
        .getKaraokeModelStatus?.()
        .then((status) => {
          if (!cancelled) {
            setNative(status);
          }
          return null;
        })
        .catch(() => undefined);
      karaokeWhisperCachedBytes()
        .then((bytes) => {
          if (!cancelled) {
            setWhisperBytes(bytes);
          }
          return null;
        })
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(poll, 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const nativeInMemory = Boolean(
    native?.separation.loaded || native?.pitch.loaded,
  );
  const models: IModelRow[] = [
    {
      nameKey: 'karaoke.maker.modelWhisper',
      inMemory: session.inMemory,
      bytes: whisperBytes,
    },
    {
      nameKey: 'karaoke.maker.modelPitch',
      inMemory: native?.pitch.loaded ?? false,
      bytes: native?.pitch.loaded
        ? native.pitch.bytes
        : (native?.pitch.downloadedBytes ?? 0),
    },
    {
      nameKey: 'karaoke.maker.modelSeparation',
      inMemory: native?.separation.loaded ?? false,
      bytes: native?.separation.bytes ?? 0,
    },
  ];
  // Answered here rather than waited for. Main is told to let the weights go
  // and says nothing back; the only thing that would notice is the next poll,
  // up to four seconds later, and until it lands the release button is still
  // on screen offering to free what was just freed.
  //
  // Residency is all that is cleared. The weights stay on disk, so the byte
  // figures are still true and the rows drop from resident to cached rather
  // than to missing — wiping the sizes would claim the release deleted files.
  const releaseEverything = () => {
    window.electron?.ipcRenderer.releaseKaraokeSeparationModel?.();
    window.electron?.ipcRenderer.releaseKaraokePitchModel?.();
    setNative((current) =>
      current
        ? {
            separation: { ...current.separation, loaded: false },
            pitch: { ...current.pitch, loaded: false },
          }
        : current,
    );
    onRelease();
  };

  return (
    <section className="karaoke-maker__memory-panel">
      <div className="karaoke-maker__memory-heading">
        <span
          className={session.inMemory ? 'is-ready' : undefined}
          aria-hidden="true"
        />
        <strong>{t('karaoke.maker.speechMemory')}</strong>
        <em>{t(statusKey)}</em>
        {(session.inMemory || nativeInMemory) && (
          <button
            type="button"
            disabled={session.busy}
            onClick={releaseEverything}
          >
            {t('karaoke.maker.freeMemory')}
          </button>
        )}
      </div>
      {/* Every model the Maker can load, whether or not it is loaded now —
          a row that disappears when idle cannot answer "what is holding my
          RAM", which is the question this panel exists for. */}
      <ul className="karaoke-maker__memory-models">
        {models.map((model) => (
          <li key={model.nameKey}>
            <span
              className={model.inMemory ? 'is-ready' : undefined}
              aria-hidden="true"
            />
            <strong>{t(model.nameKey)}</strong>
            <em>{t(modelStatusKey(model))}</em>
            <span className="karaoke-maker__memory-bytes">
              {model.bytes > 0 ? formatBytes(model.bytes) : '—'}
            </span>
          </li>
        ))}
      </ul>
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
