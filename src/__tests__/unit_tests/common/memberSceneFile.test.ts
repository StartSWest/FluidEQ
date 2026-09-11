/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import {
  memberSceneFileName,
  parseMemberScenePayload,
} from '../../../common/memberSceneFile';
import {
  memberPack,
  memberPayload,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

describe("a member scene file's payload", () => {
  // The control: what the server writes reads back whole.
  it('reads what the signing function writes', () => {
    expect(parseMemberScenePayload(memberPayload())).toEqual({
      author: { id: SOMEONE, name: 'Mei Tanaka' },
      exportedAt: '2026-09-10T12:00:00.000Z',
      pack: memberPack(),
    });
  });

  it('keeps a member with no profile nameless rather than inventing one', () => {
    expect(
      parseMemberScenePayload(memberPayload({ name: null }))?.author,
    ).toEqual({ id: SOMEONE, name: null });
  });

  it('cleans the name the way every other name on screen is cleaned', () => {
    const payload = parseMemberScenePayload(
      memberPayload({
        name: `  Mei${String.fromCharCode(0x202e)}  ${'x'.repeat(90)}`,
      }),
    );
    const name = payload?.author.name ?? '';
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name).not.toContain(String.fromCharCode(0x202e));
    expect(name.startsWith('Mei')).toBe(true);
  });

  it('refuses anything that is not a member scene', () => {
    expect(parseMemberScenePayload('not json')).toBeNull();
    expect(
      parseMemberScenePayload(memberPayload({ extra: { kind: 'plus-look' } })),
    ).toBeNull();
    expect(
      parseMemberScenePayload(memberPayload({ extra: { schema: 2 } })),
    ).toBeNull();
    expect(
      parseMemberScenePayload(memberPayload({ author: 'not-an-account' })),
    ).toBeNull();
    expect(
      parseMemberScenePayload(memberPayload({ extra: { exportedAt: 'soon' } })),
    ).toBeNull();
  });

  it('holds the pack to every member rule again, signature or not', () => {
    expect(
      parseMemberScenePayload(
        memberPayload({
          pack: memberPack({ source: `#define X 1\n${memberPack().source}` }),
        }),
      ),
    ).toBeNull();
  });

  it('names the file after the scene', () => {
    expect(memberSceneFileName(memberPack())).toBe(
      'neon-city.fluideq-scene.json',
    );
  });
});
