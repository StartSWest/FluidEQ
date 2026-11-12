/**
 * "Open the Account panel", from anywhere.
 *
 * The panel is a dialog owned by `App.tsx`, and the things that want it open
 * are far from there — a locked Plus row in the look picker, most of all. A
 * module-level request rather than a prop threaded through the chart: the
 * picker has no business knowing there is a dialog, only that choosing a
 * locked look should lead to the place where it stops being locked.
 *
 * A request may name the page to open on. A link to the terms that landed on
 * the account's front page, with the terms one more click away, would read as
 * broken. The front page is where the
 * credits are, so it is also where anything locked leads.
 *
 * One listener in practice. `App.tsx` subscribes while mounted; a request with
 * nobody listening is dropped, which is what should happen in a test or a
 * build with no account backend.
 */

/**
 * `name` is the front page with the name form already open: a publication
 * the server refused for want of a name and @handle leads straight to the
 * form that sets them, rather than to a page with the form one link away.
 */
export type TAccountPanelPage = 'home' | 'signUp' | 'terms' | 'name';

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
