import type { TranslationKey } from 'common/i18n';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { useCanSetDesktop } from '../wallpaper/WallpaperControls';
import StudioShipMore from './StudioShipMore';

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
 * The bar's actions without Plus, which on the bench is always a maker's: the
 * Studio opens without Plus only for somebody who has had a scene approved
 * (`projectAccess.ts`).
 *
 * Publish is open and wears the loud style. It is how a maker earns their
 * Plus back — an approved scene earns a month — and a bar that showed it
 * locked shut the one way back, while the server would have taken it
 * (`is_scene_maker`). Keeping the scene in their looks, sending it as a file
 * and the desktop stay Plus's, listed locked under More rather than hidden,
 * so the member sees what Plus would add where they would press it; each
 * offers Plus instead of doing nothing, and each is refused by the main
 * process anyway, the file by the server as well. The desktop only where
 * this computer can take a background, as the bar with Plus offers it: a lock
 * on something Plus would not open is a promise the purchase cannot keep.
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
    <div
      className="studio-ship studio-ship--maker"
      role="group"
      aria-label={t('studio.ship.title')}
    >
      <StudioShipMore
        lead={t('studio.locked.earn')}
        items={locked.map((entry) => ({
          key: entry.label,
          glyph: entry.glyph,
          label: t(entry.label),
          locked: true,
          onSelect: () => requestAccountPanel('subscribe'),
        }))}
      />
      <button
        type="button"
        className={`button small${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        title={t('studio.ship.makerTitle')}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
    </div>
  );
}
