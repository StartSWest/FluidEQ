/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What `sync-dev-engine` reads off the setup helper when a reinstall fails.
 * Whether it reinstalls at all is `planEngineUpdate`'s answer, pinned in
 * `engineUpdate.test.ts` with the app's own use of it.
 */

import { helperError } from '../../../../.erb/scripts/engineSync';

describe('helperError', () => {
  it("reads the reason out of the helper's result document", () => {
    expect(
      helperError('{"command":"install","ok":false,"error":"access denied"}'),
    ).toBe('access denied');
  });

  it('has nothing to say for a success, an empty error or unreadable output', () => {
    expect(helperError('{"ok":true,"error":""}')).toBeUndefined();
    expect(helperError('')).toBeUndefined();
    expect(helperError('not json')).toBeUndefined();
  });
});
