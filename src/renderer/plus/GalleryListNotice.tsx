import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryEmpty from './GalleryEmpty';

interface IGalleryListNoticeProps {
  text: string;
  onRetry: () => void;
}

/**
 * A list that could not be loaded, and the one thing to do about it: the
 * gallery's empty state, since nothing is all there is to show.
 */
export default function GalleryListNotice({
  text,
  onRetry,
}: IGalleryListNoticeProps) {
  const { t } = useTranslation();
  return (
    <GalleryEmpty glyph="alert" role="alert">
      <h2>{text}</h2>
      <button
        type="button"
        className="button small subtle gallery-empty__action"
        onClick={onRetry}
      >
        <Glyph name="refresh" />
        {t('plus.gallery.retry')}
      </button>
    </GalleryEmpty>
  );
}
