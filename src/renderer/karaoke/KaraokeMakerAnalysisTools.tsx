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
}: IKaraokeMakerAnalysisToolsProps) => {
  const { t } = useTranslation();

  const tools: {
    icon: TKaraokeMakerToolIcon;
    label: TranslationKey;
    disabled?: boolean;
    onClick: () => void;
  }[] = [
    {
      icon: 'transcribe',
      label: 'karaoke.maker.repairLyrics',
      disabled: isAnalysing,
      onClick: onDetectLyrics,
    },
    {
      icon: 'melody',
      label: 'karaoke.maker.repairMelody',
      disabled: isAnalysing,
      onClick: onDetectMelody,
    },
    {
      icon: 'analyze',
      label: 'karaoke.maker.rebuildKaraoke',
      disabled: isAnalysing,
      onClick: onRebuild,
    },
    {
      icon: 'stem',
      label: isUsingSongAudio
        ? 'karaoke.maker.vocalStem'
        : 'karaoke.maker.vocalStemLoaded',
      onClick: onChooseVocalStem,
    },
  ];

  return (
    <>
      {tools.map((tool) => (
        <KaraokeMakerToolbarButton
          key={tool.icon}
          icon={tool.icon}
          label={t(tool.label)}
          disabled={tool.disabled}
          onClick={tool.onClick}
        />
      ))}
    </>
  );
};

export default KaraokeMakerAnalysisTools;
