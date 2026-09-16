/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * What FluidEQ calls itself to the account service.
 *
 * The sign-in service copies this onto the session it makes, and the admin's
 * account list reads a version back out of it (premium migration 0036). Both
 * ends therefore have to agree on the shape, and the value ends up in an HTTP
 * header, so nothing but a version and a platform may reach it.
 */

import { clientAgent, setClientAgent } from '../../../main/account/clientAgent';

describe('the account service user agent', () => {
  it('names FluidEQ, its version and the platform', () => {
    setClientAgent('1.7.2', 'win32');
    expect(clientAgent()).toBe('FluidEQ/1.7.2 (win32)');
  });

  it('is what the server reads a version out of', () => {
    // The server's own pattern, from `app_version_of` in migration 0036.
    setClientAgent('1.7.2', 'darwin');
    expect(/FluidEQ\/([0-9]+(?:\.[0-9]+){1,2})/.exec(clientAgent())?.[1]).toBe(
      '1.7.2',
    );
  });

  it('drops a platform it does not recognise and keeps the version', () => {
    setClientAgent('2.0', 'linux x86_64\r\nX-Evil: yes');
    expect(clientAgent()).toBe('FluidEQ/2.0');
  });

  it('falls back to the bare name rather than send anything else', () => {
    setClientAgent('not a version', 'win32');
    expect(clientAgent()).toBe('FluidEQ');
  });

  it('carries no newline, however it was called', () => {
    ['1.7.2', '1.7.2\nX: y', '', '1.2.3.4.5'].forEach((version) => {
      setClientAgent(version, 'win32');
      expect(clientAgent()).not.toMatch(/[\r\n]/);
    });
  });
});
