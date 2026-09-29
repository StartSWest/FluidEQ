/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useState } from 'react';
import { isAccountConfigured } from 'common/accountConfig';
import { PRODUCT_VERSION } from 'common/branding';
import { shouldShowFeatureTour } from 'common/featureTour';
import { SUPPORT_CONTRIBUTED_KEY } from 'common/support';
import {
  subscribeAccountPanelRequests,
  type TAccountPanelPage,
} from '../account/accountPanel';
import { usePlusWelcome } from '../account/plusWelcomeStore';
import { subscribePlusTabRequests } from '../plus/plusTabRequest';
import type { TWorkspaceTab } from '../workspaceTabs';

/**
 * The version on which "don't show this again" was ticked in the feature
 * tour. Absent when it was never ticked, or was unticked on the last close.
 */
export const FEATURE_TOUR_DISMISSED_KEY = 'fluideq.featureTourDismissed';

/**
 * Which of the shell's dialogs are open: the ones the menus open, the tour
 * and the release notes a launch can open by itself, and the account panel
 * the rest of the app asks for.
 */
const useShellDialogs = (
  selectTopWorkspaceTab: (tab: TWorkspaceTab) => void,
) => {
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  // Which page of the Account panel is open, or none. A page rather than a
  // flag because the leaderboard's guide opens it straight on the terms.
  const [accountDialogPage, setAccountDialogPage] = useState<
    TAccountPanelPage | undefined
  >();
  // A locked Plus look in the picker leads here: choosing one is a request to
  // see what Plus is and how to get it, not a selection. Only honoured when a
  // backend is configured — without one the panel has nothing to offer, and a
  // locked row never appears in the first place.
  useEffect(
    () =>
      subscribeAccountPanelRequests((page) => {
        if (isAccountConfigured()) {
          setAccountDialogPage(page);
        }
      }),
    [],
  );
  // The graph's notice that its look has a new version opens that scene's
  // page in the Plus tab (`GraphUpdateNotice.tsx`), and the welcome to Plus
  // opens the tab itself. Whoever asks wants to SEE it, so the Account panel
  // — open in front of the tab whenever this comes from paying — closes with
  // the request; "See the visualizers" used to land on the panel that had
  // sent the person to pay.
  useEffect(
    () =>
      subscribePlusTabRequests(() => {
        setAccountDialogPage(undefined);
        selectTopWorkspaceTab('community');
      }),
    [selectTopWorkspaceTab],
  );
  // The welcome takes the Account panel's place the moment a membership
  // lands: it is the panel's own "you are Plus now", said larger, and the
  // panel underneath it was what the person had left to go and pay from.
  // Closing the welcome returns to the app, with nothing in front of it; the
  // panel, opened again, is the member's profile with the scene in it.
  const plusWelcome = usePlusWelcome();
  useEffect(() => {
    if (plusWelcome) {
      setAccountDialogPage(undefined);
    }
  }, [plusWelcome]);
  const [showProcessesDialog, setShowProcessesDialog] = useState(false);
  // What the last import did (`ImportNotice`).
  const [importNotice, setImportNotice] = useState('');
  // Opened from the actions menu. Nothing is gathered until it is on screen,
  // so an app nobody is reporting a problem with never reads its own logs.
  const [showBugReport, setShowBugReport] = useState(false);
  // Licence, attribution, trademark and what else is bundled. Opened, never
  // automatic — but reachable, which is the whole point of it existing.
  const [showAbout, setShowAbout] = useState(false);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  // Bumping this remounts the prerequisite notice, which is how a dismissed
  // one comes back. Without it the notice was a one-shot: close it once and
  // the only route to "Install Equalizer APO" was gone until the error
  // changed, which for a missing engine it never does.
  const [prereqNonce, setPrereqNonce] = useState(0);
  // The feature tour: the big slides, what this version brought first and
  // then the standing features. It is the launch notice; the changelog used
  // to open itself after an update and no longer does, because two panels on
  // top of each other on first run read as a malfunction. The changelog is
  // one click away inside the tour, and in the menu.
  const [showFeatureTour, setShowFeatureTour] = useState(() =>
    shouldShowFeatureTour(
      PRODUCT_VERSION,
      localStorage.getItem(FEATURE_TOUR_DISMISSED_KEY),
    ),
  );
  // Null when closed, otherwise how much of the changelog to show: `all`
  // from the menu and the tour's link, both requests to read the history.
  const [whatsNewScope, setWhatsNewScope] = useState<'latest' | 'all' | null>(
    null,
  );
  const [hasContributed, setHasContributed] = useState(
    () => localStorage.getItem(SUPPORT_CONTRIBUTED_KEY) === 'true',
  );

  return {
    showSupportDialog,
    setShowSupportDialog,
    accountDialogPage,
    setAccountDialogPage,
    showProcessesDialog,
    setShowProcessesDialog,
    importNotice,
    setImportNotice,
    showBugReport,
    setShowBugReport,
    showAbout,
    setShowAbout,
    showTroubleshooter,
    setShowTroubleshooter,
    prereqNonce,
    bumpPrereqNonce: () => setPrereqNonce((n) => n + 1),
    showFeatureTour,
    setShowFeatureTour,
    whatsNewScope,
    setWhatsNewScope,
    hasContributed,
    setHasContributed,
  };
};

export type TShellDialogs = ReturnType<typeof useShellDialogs>;

export default useShellDialogs;
