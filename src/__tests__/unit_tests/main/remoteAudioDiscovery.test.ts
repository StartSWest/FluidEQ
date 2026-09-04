/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  decodeDiscoveryAnnouncement,
  encodeDiscoveryAnnouncement,
  encodeDiscoveryQuery,
  isDiscoveryQuery,
} from '../../../main/remoteAudioDiscovery';

describe('authenticated LAN listener discovery', () => {
  const secret = 'authenticated-discovery-secret'.repeat(2);

  it('accepts only a query made with the saved pairing secret', () => {
    const query = encodeDiscoveryQuery(secret);

    expect(isDiscoveryQuery(query, secret)).toBe(true);
    expect(isDiscoveryQuery(query, `${secret}x`)).toBe(false);
    expect(isDiscoveryQuery(Buffer.from('{}'), secret)).toBe(false);
  });

  it('authenticates the listener name and replacement port together', () => {
    const announcement = encodeDiscoveryAnnouncement(
      secret,
      49_500,
      'HEADSET-PC',
    );

    expect(decodeDiscoveryAnnouncement(announcement, secret)).toMatchObject({
      deviceName: 'HEADSET-PC',
      port: 49_500,
    });

    const changed = JSON.parse(announcement.toString('utf8')) as Record<
      string,
      unknown
    >;
    changed.port = 49_501;
    expect(
      decodeDiscoveryAnnouncement(
        Buffer.from(JSON.stringify(changed), 'utf8'),
        secret,
      ),
    ).toBeUndefined();
  });

  it('rejects announcements authenticated by another LAN session', () => {
    const announcement = encodeDiscoveryAnnouncement(
      secret,
      49_500,
      'HEADSET-PC',
    );
    expect(
      decodeDiscoveryAnnouncement(announcement, 'a-different-secret'.repeat(3)),
    ).toBeUndefined();
  });
});
