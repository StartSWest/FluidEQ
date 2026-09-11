/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  isSampleMessageId,
  isSampleUserId,
  SAMPLE_PEOPLE,
  sampleBoard,
  sampleMessages,
} from '../../../main/community/sampleCommunity';
import { scoreOf } from '../../../common/leaderboardScore';

describe('the sample community, development only', () => {
  it('writes the reader into the one line that names them, and marks every row as a sample', () => {
    const lines = sampleMessages('general', 'ivan', 1_000_000_000_000);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.some((line) => line.body.includes('@ivan'))).toBe(true);
    lines.forEach((line) => {
      expect(isSampleMessageId(line.id)).toBe(true);
      expect(isSampleUserId(line.userId)).toBe(true);
      expect(line.createdAt).toBeLessThan(1_000_000_000_000);
    });
    // Ids are stable across calls and distinct within a channel.
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
    expect(sampleMessages('general', 'ivan')[0].id).toBe(lines[0].id);
  });

  it('answers nothing for a channel it has no lines for', () => {
    expect(sampleMessages('announcements', 'ivan')).toEqual([]);
  });

  it('ranks the cast into the real board by points and moves the reader down accordingly', () => {
    const nobody = {
      activeDays: 1,
      messages: 0,
      mentions: 0,
      likes: 0,
    };
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
    // The cast is scored the way the server scores.
    const ada = SAMPLE_PEOPLE.find((entry) => entry.handle === 'ada');
    expect(rows[0].points).toBe(
      scoreOf({
        minutes: ada?.allTime ?? 0,
        activeDays: ada?.activeDays ?? 0,
        messages: ada?.messages ?? 0,
        mentions: ada?.mentions ?? 0,
        likes: ada?.likes ?? 0,
      }),
    );
    // Likes on the scenes somebody made count toward their place, five each.
    const yuki = rows.find((row) => row.handle === 'yuki');
    const yukiWithoutLikes = scoreOf({
      minutes: yuki?.minutes ?? 0,
      activeDays: yuki?.activeDays ?? 0,
      messages: yuki?.messages ?? 0,
      mentions: yuki?.mentions ?? 0,
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

  it('uses this month’s minutes and a matching slice of activity for the monthly board', () => {
    const { rows } = sampleBoard('month', [], undefined);
    const ada = SAMPLE_PEOPLE.find((entry) => entry.handle === 'ada');
    expect(rows[0].minutes).toBe(ada?.month);
    expect(rows[0].messages).toBeLessThan(ada?.messages ?? 0);
  });
});
