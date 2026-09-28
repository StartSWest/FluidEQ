import { useId, useState, type AnimationEvent } from 'react';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
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
  /** A button a notice offers, which also puts the toast away when pressed. */
  action?: (notice: T) => { label: string; run: () => void } | undefined;
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
 * Each toast is a `CompactFrame`, the card every notice that arrives on its
 * own is drawn on, with what the action said as its one line.
 *
 * Something that went well drains a line along its foot and leaves when that
 * line has been drawn out, holding while the pointer or focus is on it. A
 * problem stays until it is closed or its action takes it back.
 */
export default function PlusToastStack<T extends IPlusToastNotice>({
  sources,
  text,
  action,
}: IPlusToastStackProps<T>) {
  const { t } = useTranslation();
  // Two stacks can be up at once — the graph's and the gallery's — and each
  // numbers its toasts from one, so the ids that name them need a stack of
  // their own to be unique in the window.
  const stackId = useId();
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
      {state.toasts.map((toast) => {
        const offered = action?.(toast.notice);
        const { ok } = toast.notice;
        return (
          <div
            key={toast.id}
            className={`plus-toast-slot${toast.leaving ? ' is-leaving' : ''}`}
            onAnimationEnd={(event) => {
              if (own(event) && toast.leaving) {
                setState((current) => removeToast(current, toast.id));
              }
            }}
          >
            <CompactFrame
              className={`plus-toast plus-toast--${ok ? 'done' : 'problem'}`}
              tone={ok ? 'accent' : 'warn'}
              icon={
                <MenuIcon
                  name={ok ? 'check' : 'alert'}
                  className="plus-toast__mark"
                />
              }
              title={text(toast.notice)}
              titleId={`${stackId}-toast-${toast.id}`}
              // The stack is the live region that reads a success out; a
              // problem interrupts, and is an alert of its own. Neither is a
              // dialog.
              role={ok ? undefined : 'alert'}
              aria-modal={undefined}
              aria-labelledby={ok ? undefined : `${stackId}-toast-${toast.id}`}
              onClose={() => dismiss(toast.id)}
              closeLabel={t('app.dismiss')}
              actions={
                offered && (
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={() => {
                      dismiss(toast.id);
                      offered.run();
                    }}
                  >
                    {offered.label}
                  </button>
                )
              }
            >
              {ok && (
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
            </CompactFrame>
          </div>
        );
      })}
    </div>
  );
}
