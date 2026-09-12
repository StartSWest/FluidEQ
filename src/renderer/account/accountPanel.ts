/**
 * "Open the Account panel", from anywhere.
 *
 * The panel is a dialog owned by `App.tsx`, and the things that want it open
 * are far from there — a locked Plus row in the look picker, most of all. A
 * module-level request rather than a prop threaded through the chart: the
 * picker has no business knowing there is a dialog, only that choosing a
 * locked look should lead to the place where it stops being locked.
 *
 * A request may name the page to open on. The leaderboard's guide links to
 * the Plus terms, and landing on the account's front page with the terms one
 * more click away would make the link read as broken. `subscribe` is the
 * terms with the agreement under them: every way into paying goes through it,
 * so nobody pays without having been shown what they are agreeing to.
 *
 * One listener in practice. `App.tsx` subscribes while mounted; a request with
 * nobody listening is dropped, which is what should happen in a test or a
 * build with no account backend.
 */

export type TAccountPanelPage = 'home' | 'signUp' | 'terms' | 'subscribe';

type TAccountPanelListener = (page: TAccountPanelPage) => void;

const listeners = new Set<TAccountPanelListener>();

export const subscribeAccountPanelRequests = (
  listener: TAccountPanelListener,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestAccountPanel = (page: TAccountPanelPage = 'home') => {
  listeners.forEach((listener) => listener(page));
};
