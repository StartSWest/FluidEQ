/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import type { IAccountConfig } from '../../../common/accountConfig';
import {
  fetchAgreedTermsVersion,
  highestAgreedVersion,
} from '../../../main/account/termsAcceptances';
import { fakeResponse } from '../../utils/memberSceneFixtures';

const config: IAccountConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5',
  plusYearlyPrice: '',
};

describe("reading the server's record of an agreement", () => {
  it('takes the highest version among the rows', () => {
    expect(highestAgreedVersion([{ version: 3 }])).toBe(3);
    expect(highestAgreedVersion([{ version: 2 }, { version: 4 }])).toBe(4);
  });

  it('reads no rows as no agreement on record', () => {
    expect(highestAgreedVersion([])).toBe(0);
  });

  it('skips a row it cannot read without losing the others', () => {
    expect(
      highestAgreedVersion([
        { version: '9' },
        { version: 2.5 },
        { version: -1 },
        null,
        { version: 3 },
      ]),
    ).toBe(3);
  });

  // "No agreement" puts a notice on screen, so a body that is not rows at
  // all must not be read as one.
  it('refuses a body that is not a list of rows', () => {
    expect(highestAgreedVersion({ message: 'column does not exist' })).toBe(
      undefined,
    );
    expect(highestAgreedVersion(null)).toBeUndefined();
  });
});

describe('asking the server', () => {
  it("asks for the account's newest agreement with its own token", async () => {
    const fetchImpl = jest.fn(async () => fakeResponse(200, [{ version: 4 }]));
    await expect(
      fetchAgreedTermsVersion({
        config,
        accessToken: 'member-token',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBe(4);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const asked = new URL(url);
    expect(asked.origin + asked.pathname).toBe(
      'https://project.supabase.co/rest/v1/terms_acceptances',
    );
    expect(asked.searchParams.get('select')).toBe('version');
    expect(asked.searchParams.get('order')).toBe('version.desc');
    expect(init.headers).toMatchObject({
      apikey: 'sb_publishable_test',
      Authorization: 'Bearer member-token',
    });
  });

  it('answers nothing when the server refuses or cannot be reached', async () => {
    const refused = jest.fn(async () => fakeResponse(401, { message: 'no' }));
    await expect(
      fetchAgreedTermsVersion({
        config,
        accessToken: 'member-token',
        fetchImpl: refused as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();

    const offline = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      fetchAgreedTermsVersion({
        config,
        accessToken: 'member-token',
        fetchImpl: offline as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });
});
