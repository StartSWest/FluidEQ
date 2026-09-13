import { useState, type AnimationEvent } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import {
  dismissToast,
  emptyToasts,
  reconcileToasts,
  removeToast,
  sameSources,
  type IPlusToastNotice,
  type IPlusToastState,
  type TPlusToastSources,
} from './toastStack';
import '../styles/PlusToastStack.scss';

interface IPlusToastStackProps<T extends IPlusToastNotice> {
  /** Each action's current notice, under a name that stays put per action. */
  sources: TPlusToastSources<T>;
  text: (notice: T) => string;
}

/** Only the element the handler sits on: every animation inside bubbles. */
const own = (event: AnimationEvent<HTMLElement>) =>
  event.target === event.currentTarget;

/**
 * What an action in the Plus tab said back, over the page instead of in it.
 *
 * Those notices used to be a line at the head of the page, and the buttons
 * that raise them sit well down it — Add to looks at the foot of the Studio's
 * column — so the answer landed above the fold, where nobody pressing the
 * button was looking. The stack is absolutely placed, and its parent is what
 * keeps it in view: somewhere pinned while the page scrolls under it.
 *
 * Something that went well drains a line along its foot and leaves when that
 * line has been drawn out, holding while the pointer or focus is on it. A
 * problem stays until it is closed or its action takes it back.
 */
export default function PlusToastStack<T extends IPlusToastNotice>({
  sources,
  text,
}: IPlusToastStackProps<T>) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState(sources);
  const [state, setState] = useState<IPlusToastState<T>>(() =>
    reconcileToasts(emptyToasts<T>(), {}, sources),
  );

  // Worked out while rendering rather than in an effect, so a toast is in the
  // same frame as whatever its action changed on the page.
  if (!sameSources(seen, sources)) {
    setSeen(sources);
    setState((current) => reconcileToasts(current, seen, sources));
  }

  const dismiss = (id: number) =>
    setState((current) => dismissToast(current, id));

  return (
    <div className="plus-toasts" aria-live="polite">
      {state.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`plus-toast-slot${toast.leaving ? ' is-leaving' : ''}`}
          onAnimationEnd={(event) => {
            if (own(event) && toast.leaving) {
              setState((current) => removeToast(current, toast.id));
            }
          }}
        >
          <div
            className={`plus-toast plus-toast--${toast.notice.ok ? 'done' : 'problem'}`}
            role={toast.notice.ok ? undefined : 'alert'}
          >
            <span className="plus-toast__mark" aria-hidden="true">
              <Glyph name={toast.notice.ok ? 'check' : 'alert'} />
            </span>
            <p className="plus-toast__text">{text(toast.notice)}</p>
            <button
              type="button"
              className="plus-toast__close"
              aria-label={t('app.dismiss')}
              title={t('app.dismiss')}
              onClick={() => dismiss(toast.id)}
            >
              <Glyph name="close" />
            </button>
            {toast.notice.ok && (
              <span
                className="plus-toast__life"
                aria-hidden="true"
                onAnimationEnd={(event) => {
                  if (own(event)) {
                    dismiss(toast.id);
                  }
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
