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
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

interface IKaraokeMakerHeaderActionsProps {
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onRestore: () => void;
  /**
   * Hand the edits to the player.
   *
   * The whole handler, not the pieces of one. Whether the project is fit to
   * apply — whether any word is still untimed — is a question about the
   * project, so it is answered where the project lives. This row's job is to
   * be a button.
   */
  onApply: () => void;
  /**
   * A local model is running, so this row must not leave the editor.
   *
   * Apply hands the project to the player and then closes the Maker, which
   * unmounts the component the running job belongs to. See `KaraokeMaker`.
   */
  isModelWorking: boolean;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

/**
 * Undo, Redo, Restore, Use in player, and full screen.
 *
 * Seven props against the confirmation dialog's three, and the difference is
 * the honest measure of the two: a dialog asks one question, whereas this row
 * is five unrelated commands that happen to share a corner of the header. It
 * gets a file because it is a row of buttons and nothing else — no state, no
 * effects, no knowledge of what a karaoke project is.
 */
const KaraokeMakerHeaderActions = ({
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onRestore,
  onApply,
  isModelWorking,
  isFullScreen,
  onToggleFullScreen,
}: IKaraokeMakerHeaderActionsProps) => {
  const { t } = useTranslation();
  const fullScreenLabel = t(
    isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
  );

  return (
    <div className="karaoke-maker__header-actions">
      <button
        className="karaoke-maker__header-icon"
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={t('karaoke.maker.undo')}
        data-tooltip={t('karaoke.maker.undo')}
      >
        <KaraokeMakerToolIcon name="undo" />
      </button>
      <button
        className="karaoke-maker__header-icon"
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={t('karaoke.maker.redo')}
        data-tooltip={t('karaoke.maker.redo')}
      >
        <KaraokeMakerToolIcon name="redo" />
      </button>
      <button
        className="karaoke-maker__header-icon"
        type="button"
        onClick={onRestore}
        aria-label={t('karaoke.maker.restore')}
        data-tooltip={t('karaoke.maker.restore')}
      >
        <KaraokeMakerToolIcon name="restore" />
      </button>
      <button
        className="is-primary karaoke-maker__header-action"
        type="button"
        disabled={isModelWorking}
        aria-disabled={isModelWorking}
        aria-label={t(
          isModelWorking ? 'karaoke.maker.exitBusy' : 'karaoke.maker.applyHint',
        )}
        data-tooltip={t(
          isModelWorking ? 'karaoke.maker.exitBusy' : 'karaoke.maker.applyHint',
        )}
        onClick={onApply}
      >
        <KaraokeMakerToolIcon name="apply" />
        <span>{t('karaoke.maker.apply')}</span>
      </button>
      <button
        className={`karaoke-maker__header-icon${
          isFullScreen ? ' karaoke-maker__fullscreen-exit' : ''
        }`}
        type="button"
        aria-label={fullScreenLabel}
        aria-pressed={isFullScreen}
        data-tooltip={`${fullScreenLabel} (Ctrl+F)`}
        onClick={onToggleFullScreen}
      >
        <KaraokeMakerToolIcon
          name={isFullScreen ? 'fullscreenExit' : 'fullscreen'}
        />
      </button>
    </div>
  );
};

export default KaraokeMakerHeaderActions;
