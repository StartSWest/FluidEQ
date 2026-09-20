/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import useKaraokeMakerProject from './useKaraokeMakerProject';

/**
 * The song's own details: artist, title, and who may use the result.
 *
 * The smallest thing extracted from this component and the most obviously
 * separate — it edits the project's metadata and touches nothing else in the
 * editor. Four dependencies, where the pointer handlers needed forty-three.
 *
 * Every field commits on change rather than on blur, because the Maker has no
 * save button: closing the editor keeps what is there, so what is there has to
 * be what the user typed.
 */
export interface IKaraokeMakerInspectorProps extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'commit'
> {
  /** Prefix for the ids that tie each input to its label. */
  controlId: string;
}

const KaraokeMakerInspector = ({
  commit,
  controlId,
  project,
}: IKaraokeMakerInspectorProps) => {
  const { t } = useTranslation();
  return (
    <footer className="karaoke-maker__inspector">
      <div className="karaoke-maker__fields">
        <label htmlFor={`${controlId}-artist`}>
          {t('karaoke.maker.artist')}
          <input
            id={`${controlId}-artist`}
            value={project.artist ?? ''}
            onChange={(event) =>
              commit((current) => ({
                ...current,
                artist: event.target.value.slice(0, 2_000) || undefined,
              }))
            }
          />
        </label>
        {/* A BPM box stood here until 2026-09-20 and had never done anything.
            The number it wrote went into the project, was saved with it, was
            copied into the song and read straight back into the project — a
            closed loop between two spellings of the same thing — and no
            timing, no drawing and no export ever looked at it. The UltraStar
            export writes a fixed tempo on purpose, because every note in this
            editor is held in milliseconds and a tempo would be a second
            answer to a question already settled.

            The tempo an imported file declares is still kept with the project,
            because it is a fact about the file somebody handed us; what is
            gone is the box that invited a musician to correct it. */}
      </div>
      <label className="karaoke-maker__rights" htmlFor={`${controlId}-rights`}>
        <input
          id={`${controlId}-rights`}
          type="checkbox"
          checked={project.meta.rightsConfirmed}
          onChange={(event) =>
            commit((current) => ({
              ...current,
              meta: {
                ...current.meta,
                rightsConfirmed: event.target.checked,
              },
            }))
          }
        />
        {t('karaoke.maker.rights')}
      </label>
    </footer>
  );
};

export default KaraokeMakerInspector;
