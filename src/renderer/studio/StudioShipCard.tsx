import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import StudioShipMore, { type IShipMoreItem } from './StudioShipMore';

interface IStudioShipCardProps {
  /**
   * In the gallery now. Until it is, the scene is a draft: it goes into the
   * looks only once published, so publishing is what this card recommends.
   */
  published: boolean;
  /** No scene that plays and passes, so nothing can be kept or sent yet. */
  unfit: boolean;
  onAdd: () => void;
  publishing: boolean;
  onPublish: () => void;
  exporting: boolean;
  onExport: () => void;
  /** Absent on a computer that cannot put a visualizer on its desktop. */
  onSetDesktop: (() => void) | undefined;
  settingDesktop: boolean;
}

/**
 * What to do with the scene once it plays, at the end of the Studio's bar
 * (layout A, Ivan 2026-09-27): publish it to the gallery, keep it in the
 * member's looks, and behind More, send it as a file or play it on the
 * desktop. A draft plays in the looks only once published (Ivan, 2026-10-18:
 * "necesitan publicar para poder ver"), so Publish wears the loud style
 * until it is, and Add after; the bench shows `StudioShipInspect` for one of
 * FluidEQ's scenes opened to look inside.
 *
 * In the bar they are in reach wherever the page was left: at the foot of the
 * side column they were a card pinned over everything that scrolled there.
 */
export default function StudioShipCard({
  published,
  unfit,
  onAdd,
  publishing,
  onPublish,
  exporting,
  onExport,
  onSetDesktop,
  settingDesktop,
}: IStudioShipCardProps) {
  const { t } = useTranslation();
  const more: IShipMoreItem[] = [
    {
      key: 'export',
      glyph: 'send',
      label: t('studio.action.export'),
      busy: exporting,
      disabled: unfit,
      onSelect: () => {
        if (!exporting) {
          onExport();
        }
      },
    },
  ];
  if (onSetDesktop) {
    more.push({
      key: 'desktop',
      glyph: 'monitor',
      label: t('studio.action.desktop'),
      busy: settingDesktop,
      disabled: unfit,
      onSelect: () => {
        if (!settingDesktop) {
          onSetDesktop();
        }
      },
    });
  }
  return (
    <div
      className="studio-ship"
      role="group"
      aria-label={t('studio.ship.title')}
    >
      <StudioShipMore items={more} />
      <button
        type="button"
        className={`button small${published ? ' subtle' : ''}${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
      <button
        type="button"
        className={`button small${published ? '' : ' subtle'} studio-ship__add`}
        onClick={onAdd}
        disabled={unfit}
      >
        <Glyph name="looks" />
        {t('studio.action.addToLooks')}
      </button>
    </div>
  );
}
