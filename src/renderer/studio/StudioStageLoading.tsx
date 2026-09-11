import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/** Shared by the folder read and first-frame wait, with no artificial delay. */
export default function StudioStageLoading({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="studio-stage__loading" role="status" aria-live="polite">
      <span className="studio-stage__loading-mark" aria-hidden="true">
        <Glyph name="studio" />
      </span>
      <span className="studio-stage__loading-title">
        {t('studio.stage.loading')}
      </span>
      <span className="studio-stage__loading-name">{name}</span>
    </div>
  );
}
