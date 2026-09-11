import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IGalleryListNoticeProps {
  text: string;
  onRetry: () => void;
}

/** A list that could not be loaded, and the one thing to do about it. */
export default function GalleryListNotice({
  text,
  onRetry,
}: IGalleryListNoticeProps) {
  const { t } = useTranslation();
  return (
    <div className="gallery-alert" role="alert">
      <span>{text}</span>
      <button type="button" className="button small subtle" onClick={onRetry}>
        <Glyph name="refresh" />
        {t('plus.gallery.retry')}
      </button>
    </div>
  );
}
