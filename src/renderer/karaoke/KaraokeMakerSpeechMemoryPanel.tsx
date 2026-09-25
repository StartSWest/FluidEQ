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
  /**
   * A model job — a split, a pitch trace, a transcription — is running here.
   *
   * Main loads its models inside such a job and says nothing until it ends,
   * so the job starting and ending are what can change main's rows.
   */
  isModelWorking: boolean;
  onRelease: () => void;
  onSettingsChange: (settings: IKaraokeWhisperMemorySettings) => void;
}

/**
 * What the local speech model is doing with the machine's memory.
 *
 * The one part of the Maker's advanced tools that is not a button: a status
 * light, a release control that only appears when there is something to
 * release, and a row of choices about when to let the model go. Sixty-five
 * lines that had no reason to be interleaved with four toolbar buttons beyond
 * both appearing in the same popover.
 *
 * The session snapshot arrives whole. Splitting it into `inMemory`, `busy` and
 * `policy` would lengthen the list to say exactly the same thing, and the
 * store already publishes it as one value.
 */
const KaraokeMakerSpeechMemoryPanel = ({
  session,
  statusKey,
  isModelWorking,
  onRelease,
  onSettingsChange,
}: IKaraokeMakerSpeechMemoryPanelProps) => {
  const { t } = useTranslation();
  // Main's sessions are invisible from here, so the panel asks — and offers
  // one release for everything resident: the whisper worker plus whatever
  // main is holding. It asked every four seconds for as long as it was open,
  // an IPC round and a walk of the whole model cache each time, whether or
  // not anything could have changed. Now it asks when it opens and after each
  // thing that can change an answer: a model job starting or ending (main
  // loads inside one and frees only when told to, and a release is answered
  // here at once below), and the speech session moving — loaded, downloaded,
  // released — which is what changes the cache.
  const [native, setNative] = useState<INativeModelStatus>();
  const [whisperBytes, setWhisperBytes] = useState(0);
  useEffect(() => {
    let cancelled = false;
    window.electron?.ipcRenderer
      .getKaraokeModelStatus?.()
      .then((status) => {
        if (!cancelled) {
          setNative(status);
        }
        return null;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isModelWorking]);
  useEffect(() => {
    let cancelled = false;
    karaokeWhisperCachedBytes()
      .then((bytes) => {
        if (!cancelled) {
          setWhisperBytes(bytes);
        }
        return null;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.status, session.downloaded]);
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
  // Answered here rather than asked again. Main is told to let the weights go
  // and says nothing back, so nothing would ever say the rows changed, and
  // the release button would stay on screen offering to free what was just
  // freed.
  //
  // Residency is all that is cleared. The weights stay on disk, so the byte
  // figures are still true and the rows drop from resident to cached rather
  // than to missing — wiping the sizes would claim the release deleted files.
  const releaseEverything = () => {
    window.electron?.ipcRenderer.releaseKaraokeSeparationModel?.();
    window.electron?.ipcRenderer.releaseKaraokePitchModel?.();
    // The weights stay on disk, so the sizes stand; only residency changes.
    setNative((previous) =>
      previous
        ? {
            separation: { ...previous.separation, loaded: false },
            pitch: { ...previous.pitch, loaded: false },
          }
        : previous,
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
    </section>
  );
};

export default KaraokeMakerSpeechMemoryPanel;
