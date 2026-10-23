import type { TranslationKey } from 'common/i18n';
import type { IStudioLookCopy } from 'main/ipc/studioProjectTypes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioVersion.scss';

interface IStudioVersionProps {
  /** The pack's own number: the version on the bench. */
  version: number;
  /** The version listeners have, once one has been published. */
  published: number | undefined;
  /** The member's own copy in their looks, once they kept one. */
  look?: IStudioLookCopy | undefined;
}

/** One copy of the scene somewhere else, and whether the bench is past it. */
function Copy({
  glyph,
  label,
  current,
  meaning,
}: {
  glyph: 'looks' | 'upload';
  label: string;
  current: boolean;
  meaning: string;
}) {
  return (
    <span
      className={`studio-version__copy ${current ? 'is-current' : 'is-behind'}`}
      title={meaning}
      aria-label={meaning}
    >
      <Glyph name={glyph} />
      {label}
      {current ? (
        <Glyph name="check" />
      ) : (
        <span className="studio-version__behind" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Which version is on the bench, and where else the scene is (Ivan,
 * 2026-10-14: "show current version / version on lib so they know if what
 * they open in studio is ahead of the library or not"): the copy in the
 * member's looks and the one in the gallery, each with a check when it is
 * the bench's and a dot when the bench is past it.
 *
 * The looks are compared by content, because a version keeps its number
 * through every save until it is published; the gallery by number, because
 * publishing is what moves it.
 */
export default function StudioVersion({
  version,
  published,
  look,
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
      className="studio-version"
      role="group"
      aria-label={t('studio.version.group')}
    >
      <span
        className={`studio-bench__version${
          isAhead ? ' studio-bench__version--ahead' : ''
        }`}
        title={meaning}
        aria-label={meaning}
      >
        {t('studio.version.label', { version })}
      </span>
      {look && (
        <Copy
          glyph="looks"
          label={t('studio.version.looks', { version: look.version })}
          current={look.current}
          meaning={t(
            look.current
              ? 'studio.version.looksCurrent'
              : 'studio.version.looksBehind',
            { version: look.version },
          )}
        />
      )}
      {published !== undefined && (
        <Copy
          glyph="upload"
          label={t('studio.version.gallery', { version: published })}
          current={!isAhead}
          meaning={meaning}
        />
      )}
    </span>
  );
}
