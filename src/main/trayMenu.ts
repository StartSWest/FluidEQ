/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PRODUCT_NAME } from '../common/branding';
import { LocaleCode, translate } from '../common/i18n';
import { sandboxProductName } from './devSandbox';
import type { ITrayMenuEntry } from './trayView';

/** What the tray's menu and tooltip are made from (`tray.ts` holds it). */
export interface ITrayMenuState {
  locale: LocaleCode;
  /** This build has an updater that checked out (`setTrayUpdatesEnabled`). */
  updatesEnabled: boolean;
  /** A downloaded update is waiting to install. */
  updateReady: boolean;
  /** Which of the optional actions were wired in at setup. */
  can: {
    installUpdate: boolean;
    checkForUpdates: boolean;
    recoverWindow: boolean;
  };
}

const productName = () => sandboxProductName(PRODUCT_NAME);

/** The tray's menu, top to bottom. */
export const trayMenuEntries = ({
  locale,
  updatesEnabled,
  updateReady,
  can,
}: ITrayMenuState): ITrayMenuEntry[] => {
  const entries: ITrayMenuEntry[] = [];

  // AT THE TOP WHEN THERE IS AN UPDATE TO INSTALL. Position carries the
  // emphasis: a Windows menu has no weight or colour for a default item, so
  // first-with-a-separator-under-it is what makes it read as the thing to
  // press, and the mark beside it is the badged one the notification area is
  // already showing. The whole point of raising the tray badge is to draw
  // the eye here, and burying the action underneath Open would waste the
  // notification that got the user to this menu.
  if (updatesEnabled && updateReady && can.installUpdate) {
    entries.push({
      id: 'install-update',
      label: translate(locale, 'app.tray.installUpdate'),
      mark: 'update',
      separatorAfter: true,
    });
  }

  // The only two items that stand for the app itself get its mark. Quit and
  // "check for updates" are left bare on purpose: there is no drawn glyph for
  // either in this project, and a made-up one would be the first piece of
  // iconography in the app that nothing else uses.
  entries.push({
    id: 'open',
    label: translate(locale, 'app.tray.open', { product: productName() }),
    mark: 'app',
  });

  // THE WAY BACK FROM A WINDOW NOBODY CAN REACH. Open brings the window
  // forward as it is, which is no help when "as it is" is a player three
  // quarters of the way off the side of the screen, one left on a display
  // that has since been unplugged, or one whose own controls cannot be got
  // at. This is the full app, in the middle of the screen, and it is in the
  // tray because the tray is the only surface left when the window is the
  // problem (Ivan, 2026-09-22).
  if (can.recoverWindow) {
    entries.push({
      id: 'recover-window',
      label: translate(locale, 'app.tray.recoverWindow'),
    });
  }

  if (updatesEnabled && can.checkForUpdates && !updateReady) {
    // Only when there is not one already staged. With "Install update and
    // restart" already at the top, offering a check as well reads as "did
    // you mean this or that" for the same subject; picking it would also
    // discard the download that is ready to go.
    entries.push({
      id: 'check-updates',
      label: translate(locale, 'app.tray.checkForUpdates'),
    });
  }

  // No separator above Quit. Grouping is what a separator is for, and with
  // two or three items there are no groups to divide — it only added a rule
  // across a menu short enough to read in one glance.
  entries.push({
    id: 'quit',
    label: translate(locale, 'app.tray.quit', { product: productName() }),
  });
  return entries;
};

export const trayTooltip = ({
  locale,
  updateReady,
}: Pick<ITrayMenuState, 'locale' | 'updateReady'>): string =>
  translate(
    locale,
    updateReady ? 'app.tray.tooltip.updateReady' : 'app.tray.tooltip',
    { product: productName() },
  );
