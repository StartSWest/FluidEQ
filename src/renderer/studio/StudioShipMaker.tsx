import type { TranslationKey } from 'common/i18n';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { useCanSetDesktop } from '../wallpaper/WallpaperControls';

interface ILockedAction {
  glyph: TCommunityGlyph;
  label: TranslationKey;
}

/** What stays Plus's for a maker without it: every way out but publishing. */
const LOCKED: readonly ILockedAction[] = [
  { glyph: 'looks', label: 'studio.action.addToLooks' },
  { glyph: 'send', label: 'studio.action.export' },
];

const DESKTOP: ILockedAction = {
  glyph: 'monitor',
  label: 'studio.action.desktop',
};

interface IStudioShipMakerProps {
  /** No scene that plays and passes, so nothing can be sent yet. */
  unfit: boolean;
  publishing: boolean;
  onPublish: () => void;
}

/**
 * The share card without Plus, which on the bench is always a maker's: the
 * Studio opens without Plus only for somebody who has had a scene approved
 * (`projectAccess.ts`).
 *
 * Publish is open and wears the loud style. It is how a maker earns their
 * Plus back — an approved scene earns a month — and a card that showed it
 * locked shut the one way back, while the server would have taken it
 * (`is_scene_maker`). Keeping the scene in their looks, sending it as a file
 * and the desktop stay Plus's, shown locked rather than hidden, so the member
 * sees what Plus would add in the place they would press; each lock offers
 * Plus instead of doing nothing, and each is refused by the main process
 * anyway, the file by the server as well. The desktop only where this
 * computer can take a background, as the card with Plus offers it: a lock on
 * something Plus would not open is a promise the purchase cannot keep.
 */
export default function StudioShipMaker({
  unfit,
  publishing,
  onPublish,
}: IStudioShipMakerProps) {
  const { t } = useTranslation();
  const desktop = useCanSetDesktop();
  const locked = desktop ? [...LOCKED, DESKTOP] : LOCKED;
  return (
    <div className="studio-ship studio-ship--maker">
      <span className="studio-ship__locked-title">
        <Glyph name="gift" />
        {t('studio.ship.makerTitle')}
      </span>
      <span className="studio-ship__locked-body">
        {t('studio.locked.earn')}
      </span>
      <button
        type="button"
        className={`button small${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
      <span className="studio-ship__locked-title">
        <Glyph name="lock" />
        {t('studio.plus.title')}
      </span>
      <ul className="studio-ship__locked-list">
        {locked.map((entry) => (
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
    </div>
  );
}
