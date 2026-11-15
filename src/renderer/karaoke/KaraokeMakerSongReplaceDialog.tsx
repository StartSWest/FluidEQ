/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { TMakerSongSave } from './useMakerLibrarySong';

interface IKaraokeMakerSongReplaceDialogProps {
  save: TMakerSongSave;
  onReplace: () => void;
  onKeep: () => void;
}

/**
 * "Save to song" found a lyrics file already where the timing would go —
 * most often the very file the song's words came in from. Nothing is written
 * until this is answered; Replace is red like every answer here that throws
 * something away, because what it replaces may be somebody's own timing.
 */
const KaraokeMakerSongReplaceDialog = ({
  save,
  onReplace,
  onKeep,
}: IKaraokeMakerSongReplaceDialogProps) => {
  const { t } = useTranslation();
  if (save.state !== 'confirm') {
    return null;
  }
  return (
    <div className="karaoke-maker__modal-backdrop" role="presentation">
      <CompactFrame
        tone="danger"
        icon={<MenuIcon name="restart" />}
        title={
          save.place === 'beside'
            ? t('karaoke.maker.song.replaceTitle', { name: save.fileName })
            : t('karaoke.maker.song.replaceKeptTitle')
        }
        titleId="karaoke-maker-song-replace-title"
        closeLabel={t('support.close')}
        onClose={onKeep}
        actions={
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={onKeep}
            >
              {t('karaoke.maker.cancel')}
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={onReplace}
            >
              {t('karaoke.maker.song.replace')}
            </button>
          </>
        }
      >
        <p>
          {save.place === 'beside'
            ? t('karaoke.maker.song.replaceBody', { name: save.fileName })
            : t('karaoke.maker.song.replaceKeptBody')}
        </p>
      </CompactFrame>
    </div>
  );
};

export default KaraokeMakerSongReplaceDialog;
