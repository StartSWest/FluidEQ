import { getAccountSnapshot, subscribeAccount } from '../account/accountStore';
import { openNotMineYet } from './plusNavigation';

/**
 * Where somebody lands after joining from the signed-out Visualizers page:
 * the gallery with Not mine yet on, the starter welcome over it (Ivan,
 * 2026-11-13). The page is gone the moment the account signs in, so the
 * wait lives here, armed by the page's buttons and spent by the sign-in
 * itself; a sign-in from anywhere else lands wherever it always did.
 */
let stop: (() => void) | undefined;

const land = () => {
  if (getAccountSnapshot().status !== 'signed-in') {
    return;
  }
  stop?.();
  stop = undefined;
  openNotMineYet();
};

export const landInGalleryOnSignIn = () => {
  if (stop) {
    return;
  }
  stop = subscribeAccount(land);
};

/** For tests: forget a landing that was armed and never spent. */
export const resetSignedOutLanding = () => {
  stop?.();
  stop = undefined;
};
