/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { SAMPLE_PEOPLE, sampleBoard } from '../../../main/plus/samplePeople';
import { scoreOf } from '../../../common/leaderboardScore';

describe('the sample people, development only', () => {
  it('ranks the cast into the real board by points and moves the reader down accordingly', () => {
    const nobody = { activeDays: 1, likes: 0 };
    const real = [
      {
        rank: 1,
        handle: 'ivan',
        displayName: 'Ivan',
        role: 'admin' as const,
        points: 31,
        minutes: 66,
        ...nobody,
      },
    ];
    const { rows, me } = sampleBoard('all', real, {
      rank: 1,
      points: 31,
      minutes: 66,
      ...nobody,
      players: 1,
    });
    expect(rows).toHaveLength(SAMPLE_PEOPLE.length + 1);
    expect(rows.map((row) => row.rank)).toEqual(
      rows.map((_, index) => index + 1),
    );
    expect(rows[0].handle).toBe('ada');
    expect(rows[rows.length - 1].handle).toBe('ivan');
    // The cast is scored the way the server scores: listening and likes.
    const ada = SAMPLE_PEOPLE.find((entry) => entry.handle === 'ada');
    expect(rows[0].points).toBe(
      scoreOf({
        minutes: ada?.allTime ?? 0,
        activeDays: ada?.activeDays ?? 0,
        likes: ada?.likes ?? 0,
      }),
    );
    // Likes on the scenes somebody made count toward their place, five each.
    const yuki = rows.find((row) => row.handle === 'yuki');
    const yukiWithoutLikes = scoreOf({
      minutes: yuki?.minutes ?? 0,
      activeDays: yuki?.activeDays ?? 0,
      likes: 0,
    });
    expect(yuki?.likes).toBeGreaterThan(0);
    expect(yuki?.points).toBe(yukiWithoutLikes + (yuki?.likes ?? 0) * 5);
    expect(me).toEqual({
      rank: SAMPLE_PEOPLE.length + 1,
      points: 31,
      minutes: 66,
      ...nobody,
      players: SAMPLE_PEOPLE.length + 1,
    });
  });

  it('never puts the maker’s mark on anybody in the cast', () => {
    const { rows } = sampleBoard('all', [], undefined);
    expect(rows.length).toBe(SAMPLE_PEOPLE.length);
    rows.forEach((row) => expect(row.role).toBe('member'));
  });

  it('uses this month’s minutes and a matching slice of likes for the monthly board', () => {
    const { rows } = sampleBoard('month', [], undefined);
    const ada = SAMPLE_PEOPLE.find((entry) => entry.handle === 'ada');
    expect(rows[0].minutes).toBe(ada?.month);
    const mei = SAMPLE_PEOPLE.find((entry) => entry.handle === 'mei');
    const meiRow = rows.find((row) => row.handle === 'mei');
    expect(meiRow?.likes).toBeGreaterThan(0);
    expect(meiRow?.likes).toBeLessThan(mei?.likes ?? 0);
  });
});
