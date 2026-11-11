import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IStudioShipMemberCopyProps {
  /** Who made the scene, as the gallery named them; empty when unknown. */
  maker: string;
  version: number;
}

/**
 * Where keeping, publishing and sending would be, for a copy of another
 * member's scene opened to look inside: whose scene it is and what the copy
 * is for, so the missing buttons are explained rather than refused when
 * pressed. The member's scene in the gallery is never touched by anything
 * done here.
 */
export default function StudioShipMemberCopy({
  maker,
  version,
}: IStudioShipMemberCopyProps) {
  const { t } = useTranslation();
  const vars = { maker, version: String(version) };
  return (
    <div className="studio-ship studio-ship--inspect">
      <span className="studio-ship__inspect-title">
        <Glyph name="person" />
        {maker
          ? t('studio.memberCopy.title', vars)
          : t('studio.memberCopy.titleNoName')}
      </span>
      <span className="studio-ship__inspect-body">
        {t('studio.memberCopy.body', vars)}
      </span>
    </div>
  );
}
