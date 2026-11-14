import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

/**
 * What publishing means, in the publish dialog's rail: read once and the same
 * every time, so the body is left to what is being decided now.
 */
export default function StudioPublishTicks({
  reviewed,
  update,
}: {
  /** The account's publications wait for the admin's review. */
  reviewed: boolean;
  update: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="studio-ticks">
      {reviewed && (
        <li>
          <MenuIcon name="check" />
          <span>
            {update
              ? t('studio.publish.pointReviewUpdate')
              : t('studio.publish.pointReview')}
          </span>
        </li>
      )}
      {/* That a review can say no, and what is left then, before the
          press (Ivan, 2026-11-12: "they have to be great quality in
          order to be accepted. But if it's not accepted, you still can
          play it yourselves locally"). Only where a review decides. */}
      {reviewed && (
        <li>
          <MenuIcon name="check" />
          <span>{t('studio.publish.pointQuality')}</span>
        </li>
      )}
      <li>
        <MenuIcon name="check" />
        <span>{t('studio.publish.point1')}</span>
      </li>
      <li>
        <MenuIcon name="check" />
        <span>
          {update
            ? t('studio.publish.point3Update')
            : t('studio.publish.point3')}
        </span>
      </li>
    </ul>
  );
}
