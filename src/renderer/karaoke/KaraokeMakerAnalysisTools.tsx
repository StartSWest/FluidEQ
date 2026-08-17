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
import KaraokeMakerToolbarButton from './KaraokeMakerToolbarButton';
import { TKaraokeMakerToolIcon } from './KaraokeMakerToolIcon';

interface IKaraokeMakerAnalysisToolsProps {
  /** True while anything is already analysing; all three re-runs are blocked. */
  isAnalysing: boolean;
  onDetectLyrics: () => void;
  onDetectMelody: () => void;
  onRebuild: () => void;
  /** False once a separate vocal stem has been loaded in place of the mix. */
  isUsingSongAudio: boolean;
  onChooseVocalStem: () => void;
  /** Split the mix here, rather than making the user supply a stem. */
  onRemoveBackground: () => void;
}

/**
 * Re-run the detection, or point it at a cleaner recording.
 *
 * The uniform half of the advanced tools — four buttons, written as data for
 * the same reason the editing tools are. The speech-model memory panel that
 * used to sit below them in the same fragment is its own component now; it was
 * sixty-five lines of status and settings sharing a popover with these, and
 * nothing else.
 */
const KaraokeMakerAnalysisTools = ({
  isAnalysing,
  onDetectLyrics,
  onDetectMelody,
  onRebuild,
  isUsingSongAudio,
  onChooseVocalStem,
  onRemoveBackground,
}: IKaraokeMakerAnalysisToolsProps) => {
  const { t } = useTranslation();

  interface ITool {
    icon: TKaraokeMakerToolIcon;
    label: TranslationKey;
    hint?: TranslationKey;
    disabled?: boolean;
    onClick: () => void;
  }

  /**
   * Two groups, because these are two different jobs that happen to share a
   * popover — and the second cannot start until the first has finished.
   *
   * Flat, the list read as five interchangeable actions, three of which were
   * mysteriously disabled. Split and titled, the order is the instruction:
   * deal with the audio, then deal with the words.
   */
  const groups: { title: TranslationKey; tools: ITool[] }[] = [
    {
      title: 'karaoke.maker.groupVoice',
      tools: [
        {
          icon: 'stem',
          label: isUsingSongAudio
            ? 'karaoke.maker.removeBackground'
            : 'karaoke.maker.removeBackgroundDone',
          disabled: isAnalysing || !isUsingSongAudio,
          onClick: onRemoveBackground,
        },
        {
          // The manual way in, for someone who already has a stem from another
          // tool. Never blocked by a run: choosing a cleaner recording is
          // preparation for the next detection, not a competing one.
          icon: 'vocal',
          label: 'karaoke.maker.vocalStem',
          onClick: onChooseVocalStem,
        },
      ],
    },
    {
      title: 'karaoke.maker.groupLyrics',
      tools: [
        {
          icon: 'transcribe',
          label: 'karaoke.maker.repairLyrics',
          // Whisper transcribes an isolated voice far more reliably than a
          // voice buried in a mix, so this waits for a stem rather than
          // running badly. The hint says why, because a button that is simply
          // dead teaches the user nothing and reads as a bug.
          disabled: isAnalysing || isUsingSongAudio,
          hint: isUsingSongAudio
            ? 'karaoke.maker.separationRequired'
            : undefined,
          onClick: onDetectLyrics,
        },
        {
          icon: 'melody',
          label: 'karaoke.maker.repairMelody',
          // Pitch detection is polyphonic and still produces something usable
          // from a full mix — worse, but not wrong — so it stays available.
          disabled: isAnalysing,
          onClick: onDetectMelody,
        },
        {
          icon: 'analyze',
          label: 'karaoke.maker.rebuildKaraoke',
          disabled: isAnalysing || isUsingSongAudio,
          hint: isUsingSongAudio
            ? 'karaoke.maker.separationRequired'
            : undefined,
          onClick: onRebuild,
        },
      ],
    },
  ];

  return (
    <>
      {groups.map((group) => (
        <section
          key={group.title}
          className="karaoke-maker__tool-group-titled"
          aria-label={t(group.title)}
        >
          <h3 className="karaoke-maker__tool-group-title">{t(group.title)}</h3>
          <div className="karaoke-maker__tool-group-items">
            {group.tools.map((tool) => (
              <KaraokeMakerToolbarButton
                key={tool.icon}
                icon={tool.icon}
                label={t(tool.label)}
                hint={tool.hint ? t(tool.hint) : undefined}
                disabled={tool.disabled}
                onClick={tool.onClick}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
};

export default KaraokeMakerAnalysisTools;
