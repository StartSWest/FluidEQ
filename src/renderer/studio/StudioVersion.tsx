import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';

interface IStudioVersionProps {
  /** The pack's own number: the version on the bench. */
  version: number;
  /** The version listeners have, once one has been published. */
  published: number | undefined;
}

/**
 * Which version is on the bench, and whether it is the one listeners have.
 * The number decides what a publication is called and what an installed
 * copy compares itself against, and until now it was only readable on the
 * gallery's own page — so the author tuning a scene could not tell an
 * unpublished version from the released one without leaving the Studio.
 *
 * Short enough to sit in the bar in every language; what it stands for is on
 * the element itself, for a pointer and for a reader alike.
 */
export default function StudioVersion({
  version,
  published,
}: IStudioVersionProps) {
  const { t } = useTranslation();
  const isAhead = published !== undefined && published < version;
  let hint: TranslationKey = 'studio.version.unpublished';
  if (isAhead) {
    hint = 'studio.version.ahead';
  } else if (published !== undefined) {
    hint = 'studio.version.live';
  }
  const meaning = t(hint, { version, published: published ?? version });
  return (
    <span
      className={`studio-bench__version${
        isAhead ? ' studio-bench__version--ahead' : ''
      }`}
      title={meaning}
      aria-label={meaning}
    >
      {t('studio.version.label', { version })}
    </span>
  );
}
