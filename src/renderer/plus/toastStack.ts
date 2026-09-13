/**
 * What the Plus tab's toasts show, worked out from the notices the actions
 * behind them already keep.
 *
 * Every action here — publish, add to looks, export, save a picture — holds
 * the one thing it last said as a notice object of its own, and sets a new
 * object each time it speaks. A toast is raised by a *new object*, not by new
 * text: saying "Neon City is in your looks" twice has to show it twice, and
 * two equal strings could not tell the second press from a re-render.
 *
 * Pure, so the rules below can be held by tests without a DOM.
 */

/** The one thing every notice has to say for a toast: whether it went well. */
export interface IPlusToastNotice {
  ok: boolean;
}

/** Each action's current notice, by a name that stays the same per action. */
export type TPlusToastSources<T extends IPlusToastNotice> = Readonly<
  Record<string, T | undefined>
>;

export interface IPlusToast<T extends IPlusToastNotice> {
  id: number;
  source: string;
  notice: T;
  /** On its way out; removed once its exit has been drawn. */
  leaving: boolean;
}

export interface IPlusToastState<T extends IPlusToastNotice> {
  /** Ids handed out so far, so a replacement never reuses a React key. */
  count: number;
  /** Newest first: the stack hangs down from its anchor. */
  toasts: readonly IPlusToast<T>[];
}

export const emptyToasts = <
  T extends IPlusToastNotice,
>(): IPlusToastState<T> => ({
  count: 0,
  toasts: [],
});

const sourceNames = <T extends IPlusToastNotice>(
  before: TPlusToastSources<T>,
  after: TPlusToastSources<T>,
) => [...new Set([...Object.keys(before), ...Object.keys(after)])];

export const sameSources = <T extends IPlusToastNotice>(
  before: TPlusToastSources<T>,
  after: TPlusToastSources<T>,
) => sourceNames(before, after).every((name) => before[name] === after[name]);

/**
 * The stack once the actions' notices have gone from `before` to `after`.
 *
 * A new notice goes on top and sends out whatever its action said before. An
 * action taking its notice back without a new one — the next attempt
 * starting, a new version of the scene arriving — sends out only a problem:
 * "could not be published" is stale once publishing starts again, while
 * "is in the gallery" stays true and leaves on its own time.
 */
export function reconcileToasts<T extends IPlusToastNotice>(
  state: IPlusToastState<T>,
  before: TPlusToastSources<T>,
  after: TPlusToastSources<T>,
): IPlusToastState<T> {
  let { count, toasts } = state;
  sourceNames(before, after).forEach((source) => {
    const notice = after[source];
    if (before[source] === notice) {
      return;
    }
    toasts = toasts.map((toast) =>
      toast.source === source &&
      !toast.leaving &&
      (notice !== undefined || !toast.notice.ok)
        ? { ...toast, leaving: true }
        : toast,
    );
    if (notice) {
      toasts = [{ id: count, source, notice, leaving: false }, ...toasts];
      count += 1;
    }
  });
  return { count, toasts };
}

export const dismissToast = <T extends IPlusToastNotice>(
  state: IPlusToastState<T>,
  id: number,
): IPlusToastState<T> => ({
  ...state,
  toasts: state.toasts.map((toast) =>
    toast.id === id && !toast.leaving ? { ...toast, leaving: true } : toast,
  ),
});

export const removeToast = <T extends IPlusToastNotice>(
  state: IPlusToastState<T>,
  id: number,
): IPlusToastState<T> => ({
  ...state,
  toasts: state.toasts.filter((toast) => toast.id !== id),
});
