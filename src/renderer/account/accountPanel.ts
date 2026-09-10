/**
 * "Open the Account panel", from anywhere.
 *
 * The panel is a dialog owned by `App.tsx`, and the things that want it open
 * are far from there — a locked Plus row in the look picker, most of all. A
 * module-level request rather than a prop threaded through the chart: the
 * picker has no business knowing there is a dialog, only that choosing a
 * locked look should lead to the place where it stops being locked.
 *
 * One listener in practice. `App.tsx` subscribes while mounted; a request with
 * nobody listening is dropped, which is what should happen in a test or a
 * build with no account backend.
 */

const listeners = new Set<() => void>();

export const subscribeAccountPanelRequests = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestAccountPanel = () => {
  listeners.forEach((listener) => listener());
};
