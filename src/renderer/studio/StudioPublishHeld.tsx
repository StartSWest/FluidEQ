import type { TranslationKey } from 'common/i18n';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { TPublishPart } from './publishMissing';

/**
 * What a missing part is called, and the section it sits under, in the
 * dialog's own words: "a category, under Categories".
 */
const WHAT: Record<TPublishPart, TranslationKey> = {
  name: 'studio.publish.missing.name',
  video: 'studio.publish.missing.video',
  category: 'studio.publish.missing.category',
  size: 'studio.publish.missing.size',
  note: 'studio.publish.missing.note',
};

const UNDER: Record<Exclude<TPublishPart, 'name'>, TranslationKey> = {
  video: 'studio.publish.videoTitle',
  category: 'studio.publish.category',
  size: 'studio.publish.size',
  note: 'studio.publish.note',
};

interface IStudioPublishHeldProps {
  parts: readonly TPublishPart[];
  /** A first version's line is about the scene, an update's about what changed. */
  update: boolean;
  onCall: (part: TPublishPart) => void;
}

/**
 * The footer's "Still needed" line, right over the button it holds: every
 * part still missing, each named with the section it is under and each a way
 * there. In the body text's own colour, never red: nothing has been done
 * wrong before anything has been pressed.
 */
export default function StudioPublishHeld({
  parts,
  update,
  onCall,
}: IStudioPublishHeldProps) {
  const { t } = useTranslation();
  if (parts.length === 0) {
    return null;
  }
  const label = (part: TPublishPart) => {
    if (part === 'name') {
      return t('studio.publish.missing.name');
    }
    let what = t(WHAT[part]);
    if (part === 'note' && !update) {
      what = t('studio.publish.missing.noteFirst');
    }
    const section = t(
      part === 'note' && !update ? 'studio.publish.noteFirst' : UNDER[part],
    );
    return t('studio.publish.missing.under', { what, section });
  };
  return (
    <p className="studio-publish__held" role="status">
      <MenuIcon name="info" className="studio-publish__held-icon" />
      <span>{t('studio.publish.stillNeeded')}</span>
      {parts.map((part, index) => (
        <span key={part} className="studio-publish__held-part">
          <button
            type="button"
            className="studio-publish__held-link"
            onClick={() => onCall(part)}
          >
            {label(part)}
          </button>
          {/* After the part, so a wrapped line ends on it rather than
              starting with it. */}
          {index < parts.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </p>
  );
}
