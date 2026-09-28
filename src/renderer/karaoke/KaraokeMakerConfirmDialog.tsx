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
import MenuIcon, { MenuIconName } from '../icons/MenuIcon';
import CompactFrame from '../components/CompactFrame';

export type TDestructiveMakerAction =
  'notes' | 'lyrics' | 'restore' | 'replace-lyrics';

/**
 * What the confirmation says, per action.
 *
 * `replace-lyrics` is absent on purpose: it is asked inside the lyrics editor,
 * next to the text it is about to replace, rather than in this modal. That is
 * why the component renders nothing for it rather than treating it as an error
 * — the action is real, the dialog for it is somewhere else.
 */
const DESTRUCTIVE_CONFIRMATIONS: Record<
  Exclude<TDestructiveMakerAction, 'replace-lyrics'>,
  {
    icon: MenuIconName;
    title: TranslationKey;
    body: TranslationKey;
    confirm: TranslationKey;
  }
> = {
  notes: {
    icon: 'trash',
    title: 'karaoke.maker.clearNotesTitle',
    body: 'karaoke.maker.clearNotesBody',
    confirm: 'karaoke.maker.clearNotes',
  },
  lyrics: {
    icon: 'trash',
    title: 'karaoke.maker.clearLyricsTitle',
    body: 'karaoke.maker.clearLyricsBody',
    confirm: 'karaoke.maker.clearLyrics',
  },
  restore: {
    icon: 'restart',
    title: 'karaoke.maker.restoreTitle',
    body: 'karaoke.maker.restoreBody',
    confirm: 'karaoke.maker.restore',
  },
};

interface IKaraokeMakerConfirmDialogProps {
  /** Undefined, or `replace-lyrics`, renders nothing. */
  action: TDestructiveMakerAction | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * "Are you sure" for the three actions that throw work away.
 *
 * Three props, and that is the whole argument for it being a component: the
 * dialog needs to know which action is pending and what to do about either
 * button, and nothing else. Everything it says comes from the table above, so
 * a fourth destructive action is one entry there plus a branch at the caller,
 * rather than another nested ternary in a seven-thousand-line render.
 *
 * It used to be exactly that — a pair of ternaries choosing between two
 * actions, which a third would have turned into nested ones.
 */
const KaraokeMakerConfirmDialog = ({
  action,
  onCancel,
  onConfirm,
}: IKaraokeMakerConfirmDialogProps) => {
  const { t } = useTranslation();
  if (!action || action === 'replace-lyrics') {
    return null;
  }
  const copy = DESTRUCTIVE_CONFIRMATIONS[action];

  return (
    <div className="karaoke-maker__modal-backdrop" role="presentation">
      {/* Red, like every answer that throws work away: the tile says so
          before a word is read, and the answer that does it is the red one. */}
      <CompactFrame
        tone="danger"
        icon={<MenuIcon name={copy.icon} />}
        title={t(copy.title)}
        titleId="karaoke-maker-confirm-title"
        closeLabel={t('support.close')}
        onClose={onCancel}
        actions={
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={onCancel}
            >
              {t('karaoke.maker.cancel')}
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={onConfirm}
            >
              {t(copy.confirm)}
            </button>
          </>
        }
      >
        <p>{t(copy.body)}</p>
      </CompactFrame>
    </div>
  );
};

export default KaraokeMakerConfirmDialog;
