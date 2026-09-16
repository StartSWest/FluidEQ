import type { TranslationKey } from 'common/i18n';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { useCanSetDesktop } from '../wallpaper/WallpaperControls';

interface ILockedAction {
  glyph: TCommunityGlyph;
  label: TranslationKey;
}

/** The ways a scene leaves the Studio, each one Plus's. */
const LOCKED: readonly ILockedAction[] = [
  { glyph: 'looks', label: 'studio.action.addToLooks' },
  { glyph: 'upload', label: 'studio.action.publish' },
  { glyph: 'send', label: 'studio.action.export' },
];

const DESKTOP: ILockedAction = {
  glyph: 'monitor',
  label: 'studio.action.desktop',
};

/**
 * What the share card says without Plus: the same actions the card offers
 * with it, each shown locked, and the one button that opens them.
 *
 * Shown rather than hidden on purpose — a member who has just made a scene
 * move should see exactly what Plus would let them do with it, in the place
 * they would press. The desktop only where this computer can take a
 * background, as the card with Plus offers it: a lock on something Plus
 * would not open is a promise the purchase cannot keep. None of these is
 * refused by this card: every one of them is refused by the main process,
 * and publishing and sending are refused by the server as well.
 */
export default function StudioShipLocked() {
  const { t } = useTranslation();
  const desktop = useCanSetDesktop();
  const actions = desktop ? [...LOCKED, DESKTOP] : LOCKED;
  return (
    <div className="studio-ship studio-ship--locked">
      <span className="studio-ship__locked-title">
        <Glyph name="lock" />
        {t('studio.plus.title')}
      </span>
      <ul className="studio-ship__locked-list">
        {actions.map((entry) => (
          <li key={entry.label}>
            <button
              type="button"
              className="button small subtle studio-ship__locked-action"
              title={t('studio.plus.locked')}
              onClick={() => requestAccountPanel('subscribe')}
            >
              <Glyph name={entry.glyph} />
              <span className="studio-ship__locked-name">{t(entry.label)}</span>
              <Glyph name="lock" className="studio-ship__locked-mark" />
            </button>
          </li>
        ))}
      </ul>
      <span className="studio-ship__locked-body">{t('studio.plus.body')}</span>
      <button
        type="button"
        className="button small"
        onClick={() => requestAccountPanel('subscribe')}
      >
        <Glyph name="plus" />
        {t('plus.gate.cta')}
      </button>
    </div>
  );
}
