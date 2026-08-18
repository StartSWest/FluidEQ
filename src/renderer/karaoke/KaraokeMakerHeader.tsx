/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerHeaderActions from './KaraokeMakerHeaderActions';
import { TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';

/**
 * The bar across the top: identity, editing tools, and what leaves the editor.
 *
 * Playback remains the player's responsibility. The Maker-only tools sit
 * between the identity and session actions at wide widths, then take a
 * dedicated second header row when those three groups no longer fit.
 *
 * The validation issues arrive rather than being computed here: the same list
 * decides whether Apply is offered and what the inspector warns about, and two
 * readers of one answer must not each derive their own.
 */
export interface IKaraokeMakerHeaderProps extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'commit' | 'undo' | 'redo' | 'canUndo' | 'canRedo'
> {
  /** What the Maker was handed, and what it hands back. */
  onApply: (project: IKaraokeMakerProject) => void;
  onClose: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  tools: ReactNode;

  issues: ReturnType<typeof validateKaraokeMakerProject>;
  setDestructiveAction: Dispatch<
    SetStateAction<TDestructiveMakerAction | undefined>
  >;
  setNotice: (message?: string) => void;
}

const KaraokeMakerHeader = ({
  canRedo,
  canUndo,
  commit,
  isFullScreen,
  issues,
  onApply,
  onClose,
  onToggleFullScreen,
  project,
  redo,
  setDestructiveAction,
  setNotice,
  tools,
  undo,
}: IKaraokeMakerHeaderProps) => {
  const { t } = useTranslation();
  return (
    <header className="karaoke-maker__header">
      <div className="karaoke-maker__identity">
        <button
          className="karaoke-maker__header-icon karaoke-maker__header-back"
          type="button"
          onClick={onClose}
          aria-label={t('karaoke.maker.close')}
          data-tooltip={t('karaoke.maker.close')}
        >
          <KaraokeMakerToolIcon name="back" />
        </button>
        <div>
          <span className="karaoke-maker__eyebrow">
            {t('karaoke.maker.eyebrow')}
          </span>
          <input
            className="karaoke-maker__title-input"
            value={project.title}
            aria-label={t('karaoke.maker.songTitle')}
            onChange={(event) =>
              commit((current) => ({
                ...current,
                title: event.target.value.slice(0, 2_000),
              }))
            }
          />
        </div>
      </div>
      <div className="karaoke-maker__header-tools">{tools}</div>
      <KaraokeMakerHeaderActions
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onRestore={() => setDestructiveAction('restore')}
        onApply={() => {
          const untimedCount = issues.filter(
            (issue) => issue.code === 'untimed-word',
          ).length;
          if (untimedCount > 0) {
            setNotice(t('karaoke.maker.applyUntimed', { count: untimedCount }));
            return;
          }
          onApply(project);
          onClose();
        }}
        isFullScreen={isFullScreen}
        onToggleFullScreen={onToggleFullScreen}
      />
    </header>
  );
};

export default KaraokeMakerHeader;
