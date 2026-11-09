import type { TranslationKey } from 'common/i18n';
import type { IStudioLookCopy } from 'main/ipc/studioProjectTypes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import '../styles/StudioVersion.scss';

interface IStudioVersionProps {
  /** The pack's own number: what an unpublished scene shows. */
  version: number;
  /** The version listeners have, once one has been published. */
  published: number | undefined;
  /**
   * The folder has changed since that version went out from it
   * (`publishedRecords.ts`); undefined when that is not known here.
   */
  changed?: boolean | undefined;
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
  glyph: 'looks';
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
 * The scene's version, beside the scene it belongs to (Ivan, 2026-11-09:
 * "The scene's version, for example v23"): the one people have in the
 * gallery, which moves only when it is published ("Only when publishing"),
 * with a dot when the bench has changed since; the pack's own number while
 * it has never been published. And the copy in the member's looks, compared
 * by content, with a check when it is the bench's and a dot when the bench
 * is past it.
 *
 * The gallery had a chip of its own beside the bench's number while every
 * request of the AI raised that number; now the two are the same number, and
 * the chip would only say it twice.
 */
export default function StudioVersion({
  version,
  published,
  changed,
  look,
}: IStudioVersionProps) {
  const { t } = useTranslation();
  const isChanged = published !== undefined && changed === true;
  let hint: TranslationKey = 'studio.version.unpublished';
  if (isChanged) {
    hint = 'studio.version.changed';
  } else if (published !== undefined) {
    hint = 'studio.version.live';
  }
  const shown = published ?? version;
  const meaning = t(hint, { version: shown, next: shown + 1 });
  return (
    <span
      className="studio-version"
      role="group"
      aria-label={t('studio.version.group')}
    >
      <span
        className={`studio-bench__version${
          isChanged ? ' studio-bench__version--changed' : ''
        }`}
        title={meaning}
        aria-label={meaning}
      >
        {t('studio.version.label', { version: shown })}
        {isChanged && (
          <span className="studio-version__behind" aria-hidden="true" />
        )}
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
    </span>
  );
}
