import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IStudioStageStartProps {
  onNewProject: () => void;
  onLinkFolder: () => void;
}

/**
 * The stage while the bench has no project: where the first one starts, new
 * or from a folder the member already has.
 */
export default function StudioStageStart({
  onNewProject,
  onLinkFolder,
}: IStudioStageStartProps) {
  const { t } = useTranslation();
  return (
    <div className="studio-stage__well studio-stage__well--start">
      <span className="studio-stage__start-mark" aria-hidden="true">
        <Glyph name="studio" />
      </span>
      <span className="studio-stage__start-title">
        {t('studio.stage.startTitle')}
      </span>
      <span className="studio-stage__start-body">
        {t('studio.stage.startBody')}
      </span>
      <span className="studio-stage__start-actions">
        <button type="button" className="button small" onClick={onNewProject}>
          <Glyph name="studio" />
          {t('studio.project.new')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={onLinkFolder}
        >
          <Glyph name="folder" />
          {t('studio.project.add')}
        </button>
      </span>
    </div>
  );
}
