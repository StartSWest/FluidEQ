import { useId, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { TProjectCodeRole } from 'main/memberScenes/projectCode';
import { useTranslation } from '../utils/I18nContext';
import type { ILineChange } from './lineDiff';

/** The last save of a file that came from outside the pane, and what it changed. */
export interface IOutsideChange {
  id: number;
  at: Date;
  detail: ILineChange;
}

/** Written out, so the search for strings nobody uses finds each one. */
const ROLE_NAMES: Record<TProjectCodeRole, TranslationKey> = {
  scene: 'studio.code.role.scene',
  pack: 'studio.code.role.pack',
  world: 'studio.code.role.world',
  material: 'studio.code.role.material',
  animation: 'studio.code.role.animation',
  notes: 'studio.code.role.notes',
};

/** What each kind of file is, as a mark before its name. */
const ROLE_MARKS: Record<TProjectCodeRole, ReactNode> = {
  // Angle brackets: the code that draws the scene.
  scene: <path d="M6 4.5 2.5 8 6 11.5M10 4.5 13.5 8 10 11.5" />,
  // A list: what the scene is called and how it is set up.
  pack: <path d="M3 4.5h10M3 8h10M3 11.5h6" />,
  // A box seen from a corner: the 3D world.
  world: (
    <>
      <path d="M8 2.5 13 5v6l-5 2.5L3 11V5z" />
      <path d="M3 5l5 2.5L13 5M8 7.5v6" />
    </>
  ),
  // A lit ball: a surface.
  material: (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M5.4 7.2A2.8 2.8 0 0 1 7.6 5" />
    </>
  ),
  // A strip of frames.
  animation: (
    <>
      <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
      <path d="M6.2 4v8M9.8 4v8" />
    </>
  ),
  // A page with lines on it.
  notes: (
    <>
      <path d="M4.5 2.5h4.6l2.4 2.4v8.6h-7z" />
      <path d="M6.5 8h3M6.5 10.5h3" />
    </>
  ),
};

interface IStudioCodeCardProps {
  file: string;
  /** What the file is to the scene (`role` is taken: it is ARIA's word). */
  kind: TProjectCodeRole;
  open: boolean;
  onToggle: () => void;
  /** Lines and size, quietly, after the name. */
  meta?: string;
  /** The file's state and its buttons, at the head's far end. */
  actions?: ReactNode;
  /** What has to be read whether the file is open or not. */
  notices?: ReactNode;
  children: ReactNode;
}

/**
 * One file of the scene in the Code tab: a head that folds it, and the file
 * under it.
 *
 * The head stays at the top of the tab while its file is scrolled through,
 * so the name of what is being read - and the scene file's Save - is never
 * a screen away.
 */
export default function StudioCodeCard({
  file,
  kind,
  open,
  onToggle,
  meta,
  actions,
  notices,
  children,
}: IStudioCodeCardProps) {
  const { t } = useTranslation();
  const bodyId = useId();
  return (
    <article className={`studio-code__item${open ? ' is-open' : ''}`}>
      <header className="studio-code__item-head">
        <button
          type="button"
          className="studio-code__toggle"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={onToggle}
        >
          <svg
            className="studio-code__chevron"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="m6 3.5 4.5 4.5L6 12.5" />
          </svg>
          <svg
            className={`studio-code__mark studio-code__mark--${kind}`}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            {ROLE_MARKS[kind]}
          </svg>
          <span className="studio-code__file">{file}</span>
          <span className="studio-code__role">{t(ROLE_NAMES[kind])}</span>
        </button>
        {meta && <span className="studio-code__meta">{meta}</span>}
        {actions}
      </header>
      {notices}
      {open && (
        <div id={bodyId} className="studio-code__item-body">
          {children}
        </div>
      )}
    </article>
  );
}

/** What the last outside save did to a file, and the switch to its diff. */
export function StudioCodeDelta({
  change,
  showDiff,
  onToggle,
}: {
  change: IOutsideChange;
  showDiff: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <span
        className="studio-code__delta"
        title={t('studio.code.delta', {
          added: change.detail.addedCount,
          removed: change.detail.removedCount,
        })}
      >
        <span className="studio-code__delta-add">
          +{change.detail.addedCount}
        </span>
        <span className="studio-code__delta-remove">
          −{change.detail.removedCount}
        </span>
      </span>
      <button
        type="button"
        className="button small subtle"
        aria-pressed={showDiff}
        onClick={onToggle}
      >
        {showDiff ? t('studio.code.showCode') : t('studio.code.showChanges')}
      </button>
    </>
  );
}
