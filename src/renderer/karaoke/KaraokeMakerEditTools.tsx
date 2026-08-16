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

import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolbarButton from './KaraokeMakerToolbarButton';
import { TKaraokeMakerToolIcon } from './KaraokeMakerToolIcon';
import { TranslationKey } from '../../common/i18n';

interface IKaraokeMakerEditToolsProps {
  isRecordingLines: boolean;
  onToggleRecordLines: () => void;
  noteEditMode: 'select' | 'paint' | undefined;
  onToggleNoteEditMode: (mode: 'select' | 'paint') => void;
  canCopyNotes: boolean;
  onCopyNotes: () => void;
  canPasteNotes: boolean;
  onPasteNotes: () => void;
  canSplitNote: boolean;
  onSplitNote: () => void;
  canDelete: boolean;
  onDelete: () => void;
}

/**
 * The editing tools, as a list rather than as markup.
 *
 * This is the part of the toolbar a config array actually suits, and the
 * distinction is worth stating because it was got wrong once: the toolbar as a
 * whole is not a list of buttons — it is a few buttons and several clusters
 * that open popovers of bespoke controls, so flattening the lot would have
 * described the small half. This group *is* uniform. Seven buttons, each an
 * icon, a label, a state and a handler, and nothing else.
 *
 * Written as data so adding one is a row rather than five lines of JSX, and so
 * the shape of every entry is checked by the compiler instead of by eye.
 */
const KaraokeMakerEditTools = (props: IKaraokeMakerEditToolsProps) => {
  const { t } = useTranslation();
  const {
    isRecordingLines,
    onToggleRecordLines,
    noteEditMode,
    onToggleNoteEditMode,
    canCopyNotes,
    onCopyNotes,
    canPasteNotes,
    onPasteNotes,
    canSplitNote,
    onSplitNote,
    canDelete,
    onDelete,
  } = props;

  const tools: {
    icon: TKaraokeMakerToolIcon;
    label: TranslationKey;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }[] = [
    {
      icon: 'align',
      label: 'karaoke.maker.recordLines',
      active: isRecordingLines,
      onClick: onToggleRecordLines,
    },
    {
      icon: 'select',
      label: 'karaoke.maker.selectNotes',
      active: noteEditMode === 'select',
      onClick: () => onToggleNoteEditMode('select'),
    },
    {
      icon: 'noteAdd',
      label: 'karaoke.maker.paintNotes',
      active: noteEditMode === 'paint',
      onClick: () => onToggleNoteEditMode('paint'),
    },
    {
      icon: 'copy',
      label: 'karaoke.maker.copyNotes',
      disabled: !canCopyNotes,
      onClick: onCopyNotes,
    },
    {
      icon: 'paste',
      label: 'karaoke.maker.pasteNotes',
      disabled: !canPasteNotes,
      onClick: onPasteNotes,
    },
    {
      icon: 'split',
      label: 'karaoke.maker.split',
      disabled: !canSplitNote,
      onClick: onSplitNote,
    },
    {
      icon: 'remove',
      label: 'karaoke.maker.delete',
      disabled: !canDelete,
      onClick: onDelete,
    },
  ];

  return (
    <>
      {tools.map((tool) => (
        <KaraokeMakerToolbarButton
          key={tool.icon}
          icon={tool.icon}
          label={t(tool.label)}
          active={tool.active}
          disabled={tool.disabled}
          onClick={tool.onClick}
        />
      ))}
    </>
  );
};

export default KaraokeMakerEditTools;
