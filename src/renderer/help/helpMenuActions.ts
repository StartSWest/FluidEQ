/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { PRODUCT_NAME } from 'common/branding';
import type { Translate } from 'common/i18n';
import type { MenuIconName } from '../icons/MenuIcon';

/** What each of Help's entries opens; the app shell owns every one of them. */
export interface IHelpHandlers {
  onTour: () => void;
  onTroubleshoot: () => void;
  onReport: () => void;
  /** Shows the Forum — the project's GitHub Discussions — in the workspace. */
  onForum: () => void;
  onAbout: () => void;
}

export interface IHelpAction {
  /** Fixing audio is the actions menu's own row too, so it knows to skip it. */
  id: 'guide' | 'whatsNew' | 'fixAudio' | 'report' | 'forum' | 'about';
  label: string;
  run: () => void;
  icon: MenuIconName;
}

/**
 * Help's entries, for the Help menu and for the actions menu beside it, which
 * takes them in when the titlebar has no room left for Help's own button
 * (`useTitlebarRoom`). One list, so the two can never offer different help.
 *
 * The Forum sits with the other ways to get help, after reporting a problem:
 * the place to ask people rather than the app. Every row wears a picture of
 * its own — five of the six used to share the circled i — and fixing audio
 * wears the spanner it wears in the actions menu, because it is the same
 * action.
 */
const helpMenuActions = (
  t: Translate,
  { onTour, onTroubleshoot, onReport, onForum, onAbout }: IHelpHandlers,
  onGuide: () => void,
): IHelpAction[] => [
  { id: 'guide', label: t('help.title'), run: onGuide, icon: 'guide' },
  { id: 'whatsNew', label: t('app.menu.whatsNew'), run: onTour, icon: 'gift' },
  {
    id: 'fixAudio',
    label: t('app.menu.fixAudio'),
    run: onTroubleshoot,
    icon: 'wrench',
  },
  {
    id: 'report',
    label: t('app.menu.reportProblem'),
    run: onReport,
    icon: 'flag',
  },
  { id: 'forum', label: t('tabs.forum'), run: onForum, icon: 'forum' },
  {
    id: 'about',
    label: t('app.menu.about', { product: PRODUCT_NAME }),
    run: onAbout,
    icon: 'info',
  },
];

export default helpMenuActions;
