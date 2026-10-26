/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The developer tools open in a window of their own and never docked inside
 * the app's (`devTools.ts`): docked, they decide how wide the page is, and a
 * development restart drew the amp 1920px wide in a 475px window (Ivan,
 * 2026-10-25). The menu's toggle and Inspect element both go through here
 * (`devToolsMenu.test.ts`).
 */

import type { WebContents } from 'electron';
import { inspectDetached, toggleDetachedDevTools } from 'main/devTools';

const DETACHED = { mode: 'detach', activate: false };

/** A page whose developer tools open and close as asked. */
const pageWithTools = (isOpen: boolean) => {
  let open = isOpen;
  const page = {
    isDevToolsOpened: jest.fn(() => open),
    openDevTools: jest.fn(() => {
      open = true;
    }),
    closeDevTools: jest.fn(() => {
      open = false;
    }),
    inspectElement: jest.fn(),
  };
  return { page, contents: page as unknown as WebContents };
};

describe('the developer tools', () => {
  it('open in a window of their own, behind the app, and close again', () => {
    const { page, contents } = pageWithTools(false);
    toggleDetachedDevTools(contents);
    expect(page.openDevTools).toHaveBeenCalledWith(DETACHED);
    toggleDetachedDevTools(contents);
    expect(page.closeDevTools).toHaveBeenCalledTimes(1);
    expect(page.openDevTools).toHaveBeenCalledTimes(1);
  });

  it('open in a window of their own before an element is inspected', () => {
    const { page, contents } = pageWithTools(false);
    inspectDetached(contents, 12, 34);
    expect(page.openDevTools).toHaveBeenCalledWith(DETACHED);
    // First: inspecting with the tools closed opens them where they were
    // last docked.
    expect(page.openDevTools.mock.invocationCallOrder[0]).toBeLessThan(
      page.inspectElement.mock.invocationCallOrder[0],
    );
    expect(page.inspectElement).toHaveBeenCalledWith(12, 34);
  });

  it('inspect in the tools already open, without opening them again', () => {
    const { page, contents } = pageWithTools(true);
    inspectDetached(contents, 1, 2);
    expect(page.openDevTools).not.toHaveBeenCalled();
    // POSITIVE CONTROL: the inspection itself still happens.
    expect(page.inspectElement).toHaveBeenCalledWith(1, 2);
  });
});
