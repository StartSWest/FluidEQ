/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

interface IKaraokeMakerStemsProps {
  /** The backing track, once a song has been split. */
  instrumental?: File;
  /** The isolated voice — the same file the detectors now read. */
  vocals?: File;
  /**
   * The guide-vocal level, 0 to 1, or undefined when the player has no stem
   * loaded to blend. Owned by the player and passed through, because the Maker
   * previews on the same audio element — a second level here would be a slider
   * that moved nothing.
   */
  vocalLevel?: number;
  onVocalLevel?: (level: number) => void;
  onSave: (file: File) => void;
  /** True while a split is running, which is the only time this panel talks. */
  isSeparating?: boolean;
  /** 0..1, or undefined while a stage has begun but reported nothing yet. */
  progress?: number;
  message?: string;
}

/**
 * The two tracks a split produces, shown together once there are two.
 *
 * Separation is otherwise invisible work: the detectors quietly start reading
 * a different file and nothing on screen says so. Listing both stems makes the
 * result concrete — you can see what was produced, hear it, and keep it.
 *
 * The level control monitors the voice against the backing track while
 * editing, which is a different question from the player's guide-vocal fader
 * even though they look alike. Here it is a tool for checking the split and
 * for hearing whether a lyric lands where the waveform says it does; there it
 * is how much help the singer wants. Sharing one control between the two would
 * mean tuning the editor changed how the song performs.
 */
const KaraokeMakerStems = ({
  instrumental,
  vocals,
  vocalLevel,
  onVocalLevel,
  onSave,
  isSeparating = false,
  progress,
  message,
}: IKaraokeMakerStemsProps) => {
  const { t } = useTranslation();
  // While a split runs this panel is the only thing on screen that says so.
  // The shared analysis panel is shaped around Whisper's stages and shows
  // nothing for separation, so a click on "Separate voice from music" appeared
  // to do nothing at all while a 700 MB download ran behind it.
  if (isSeparating) {
    return (
      <section
        className="karaoke-maker__stems"
        aria-label={t('karaoke.maker.stemsTitle')}
      >
        <h3 className="karaoke-maker__tool-group-title">
          {t('karaoke.maker.stemsTitle')}
        </h3>
        <div className="karaoke-maker__stem-progress" role="status">
          <progress max={1} value={progress} />
          <p>{message ?? t('karaoke.maker.separating')}</p>
        </div>
      </section>
    );
  }
  if (!instrumental && !vocals) {
    return null;
  }
  const percent = Math.round((vocalLevel ?? 0) * 100);
  const canMix = vocalLevel !== undefined && onVocalLevel !== undefined;
  const tracks: { icon: 'stem' | 'vocal'; label: string; file?: File }[] = [
    {
      icon: 'stem',
      label: t('karaoke.maker.stemBacking'),
      file: instrumental,
    },
    { icon: 'vocal', label: t('karaoke.maker.stemVoice'), file: vocals },
  ];

  return (
    <section
      className="karaoke-maker__stems"
      aria-label={t('karaoke.maker.stemsTitle')}
    >
      <h3 className="karaoke-maker__tool-group-title">
        {t('karaoke.maker.stemsTitle')}
      </h3>
      <ul className="karaoke-maker__stem-list">
        {tracks
          .filter((track) => track.file)
          .map((track) => (
            <li key={track.icon} className="karaoke-maker__stem">
              <KaraokeMakerToolIcon name={track.icon} />
              <span className="karaoke-maker__stem-name">{track.label}</span>
              <button
                type="button"
                // Quiet: saving a stem is an escape hatch, not the thing this
                // panel is for.
                className="button small subtle"
                onClick={() => onSave(track.file as File)}
              >
                {t('karaoke.maker.stemSave')}
              </button>
            </li>
          ))}
      </ul>
      {canMix && (
        <label
          className="karaoke-maker__stem-level"
          htmlFor="karaoke-maker-vocal-level"
        >
          <span>{t('karaoke.transport.vocalLevel')}</span>
          <input
            id="karaoke-maker-vocal-level"
            aria-label={t('karaoke.transport.vocalLevel')}
            aria-valuetext={
              percent === 0 ? t('karaoke.transport.vocalOff') : `${percent}%`
            }
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vocalLevel}
            onChange={(event) => onVocalLevel(Number(event.target.value))}
          />
          <span className="karaoke-maker__stem-level-value">
            {percent === 0 ? t('karaoke.transport.vocalOff') : `${percent}%`}
          </span>
        </label>
      )}
    </section>
  );
};

export default KaraokeMakerStems;
