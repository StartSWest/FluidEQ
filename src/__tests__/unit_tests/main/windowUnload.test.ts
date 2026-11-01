/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A window hidden in the tray is let go only when nothing holds it: not the
 * page, which has to have spoken first, and not main (`windowUnload.ts`).
 * Every "kept" case stands beside the one change that then lets it go, so a
 * controller that never unloads fails as surely as one that always does.
 */
import { createWindowUnload } from '../../../main/windowUnload';

const controller = () => {
  const unload = jest.fn();
  const log = jest.fn();
  return { unload, log, windowUnload: createWindowUnload({ unload, log }) };
};

describe('letting a window in the tray go', () => {
  it('lets it go once hidden with a page that holds nothing', () => {
    const { unload, windowUnload } = controller();
    windowUnload.pageSaid([]);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.hiddenInTray(true);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('waits for the page to speak: a page still loading is not idle', () => {
    const { unload, windowUnload } = controller();
    windowUnload.hiddenInTray(true);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.pageSaid([]);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('keeps it while the page holds it, and lets go when it stops', () => {
    const { unload, windowUnload } = controller();
    windowUnload.pageSaid(['player']);
    windowUnload.hiddenInTray(true);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.pageSaid(['player', 'maker']);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.pageSaid([]);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('keeps it while main holds it, for as long as any one does', () => {
    const { unload, windowUnload } = controller();
    windowUnload.hold('lighting', true);
    windowUnload.hold('songs', true);
    windowUnload.pageSaid([]);
    windowUnload.hiddenInTray(true);
    windowUnload.hold('lighting', false);
    expect(unload).not.toHaveBeenCalled();
    // Said again as it stands: still held.
    windowUnload.hold('songs', true);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.hold('songs', false);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('never lets a window on screen go', () => {
    const { unload, windowUnload } = controller();
    windowUnload.hiddenInTray(true);
    windowUnload.hiddenInTray(false);
    windowUnload.pageSaid([]);
    expect(unload).not.toHaveBeenCalled();
    // POSITIVE CONTROL: the same page, hidden again.
    windowUnload.hiddenInTray(true);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('counts a page that left as one loading until the next speaks', () => {
    // A crash or a reload in the tray: the old page's "nothing" says nothing
    // about the page coming up in its place.
    const { unload, windowUnload } = controller();
    windowUnload.pageSaid([]);
    windowUnload.pageLeft();
    windowUnload.hiddenInTray(true);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.hold('lighting', false);
    expect(unload).not.toHaveBeenCalled();
    windowUnload.pageSaid([]);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('starts the next window afresh: shown, and its page not yet heard', () => {
    const { unload, windowUnload } = controller();
    windowUnload.pageSaid([]);
    windowUnload.hiddenInTray(true);
    expect(unload).toHaveBeenCalledTimes(1);

    // The window built again from the tray: its page says nothing holds it,
    // and it is on screen, so it stays.
    windowUnload.pageSaid([]);
    expect(unload).toHaveBeenCalledTimes(1);
    windowUnload.hiddenInTray(true);
    expect(unload).toHaveBeenCalledTimes(2);
  });

  it('says what keeps a window loaded in the tray, once per hide', () => {
    const { log, windowUnload } = controller();
    windowUnload.pageSaid(['maker']);
    windowUnload.hold('share-audio', true);
    windowUnload.hiddenInTray(true);
    expect(log).toHaveBeenCalledWith(
      'The window stays loaded in the tray for: maker, share-audio.',
    );
    log.mockClear();
    windowUnload.hold('studio-chat', true);
    expect(log).not.toHaveBeenCalled();
  });
});
