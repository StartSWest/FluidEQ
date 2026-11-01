/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether Claude is answering in any project (`chatBusy.ts`), which keeps a
 * window in the tray loaded: its looks are drawn by the window's page.
 */
import createChatBusy from '../../../main/studioChat/chatBusy';

describe('the Studio chat answering anywhere', () => {
  it('turns on with the first project and off with the last', () => {
    const onBusy = jest.fn();
    const told = createChatBusy(onBusy);
    told('cat', true);
    told('bird', true);
    told('cat', false);
    expect(onBusy.mock.calls).toEqual([[true]]);
    told('bird', false);
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it('says nothing while a reply streams the same busy word after word', () => {
    const onBusy = jest.fn();
    const told = createChatBusy(onBusy);
    told('cat', false);
    expect(onBusy).not.toHaveBeenCalled();
    told('cat', true);
    told('cat', true);
    told('cat', true);
    expect(onBusy).toHaveBeenCalledTimes(1);
  });
});
