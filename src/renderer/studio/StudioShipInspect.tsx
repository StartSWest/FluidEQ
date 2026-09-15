import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/**
 * Where keeping, publishing and sending would be, for one of FluidEQ's own
 * scenes opened to look inside: what the project is for, so the missing
 * buttons are explained rather than refused when pressed.
 */
export default function StudioShipInspect() {
  const { t } = useTranslation();
  return (
    <div className="studio-card studio-ship studio-ship--inspect">
      <span className="studio-ship__inspect-title">
        <Glyph name="looks" />
        {t('studio.inspect.title')}
      </span>
      <span className="studio-ship__inspect-body">
        {t('studio.inspect.body')}
      </span>
    </div>
  );
}
