import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IStudioShipCardProps {
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
 * What to do with the scene once it plays: keep it in the member's looks,
 * publish it to the gallery, send it as a file, play it on the desktop.
 * With Plus; the bench shows `StudioShipLocked` without it, and
 * `StudioShipInspect` for one of FluidEQ's scenes opened to look inside.
 */
export default function StudioShipCard({
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
  return (
    <div className="studio-ship">
      <button
        type="button"
        className="button small studio-ship__add"
        onClick={onAdd}
        disabled={unfit}
      >
        <Glyph name="looks" />
        {t('studio.action.addToLooks')}
      </button>
      <button
        type="button"
        className={`button small subtle${publishing ? ' is-running' : ''}`}
        aria-busy={publishing}
        onClick={onPublish}
        disabled={unfit}
      >
        <Glyph name="upload" />
        {t('studio.action.publish')}
      </button>
      <button
        type="button"
        className={`button small subtle${exporting ? ' is-running' : ''}`}
        aria-busy={exporting}
        onClick={() => {
          if (!exporting) {
            onExport();
          }
        }}
        disabled={unfit}
      >
        <Glyph name="send" />
        {t('studio.action.export')}
      </button>
      {onSetDesktop && (
        <button
          type="button"
          className={`button small subtle${settingDesktop ? ' is-running' : ''}`}
          aria-busy={settingDesktop}
          onClick={() => {
            if (!settingDesktop) {
              onSetDesktop();
            }
          }}
          disabled={unfit}
        >
          <Glyph name="monitor" />
          {t('studio.action.desktop')}
        </button>
      )}
    </div>
  );
}
