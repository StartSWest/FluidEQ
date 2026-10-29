/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import {
  currentAppNews,
  parseAppNews,
  readAppNews,
  newsActionUrl,
  newsPreviewText,
} from '../../../common/appNews';
import { parseAnnouncements } from '../../../common/sceneAnnouncements';
import { LOCALES, loadLocale, translate } from '../../../common/i18n';

const now = Date.parse('2026-10-28T15:00:00Z');
const row = {
  kind: 'news',
  id: 1,
  title: 'Product news',
  body: 'First paragraph.\n\nSecond paragraph.',
  starts_at: new Date(now - 1000).toISOString(),
  expires_at: new Date(now + 1000).toISOString(),
  audience: 'everyone',
  action_label: 'Read more',
  action_url: 'https://example.invalid/news',
};

it('reads authored paragraphs, a safe action and no unrelated account fields', () => {
  const item = readAppNews({
    ...row,
    trial_ends_at: 'private',
    email: 'fixture@example.invalid',
  });
  expect(item?.body).toBe('First paragraph.\n\nSecond paragraph.');
  expect(item?.action).toEqual({
    label: 'Read more',
    url: 'https://example.invalid/news',
  });
  expect(item).not.toHaveProperty('email');
  expect(item).not.toHaveProperty('trial_ends_at');
  expect(parseAnnouncements([row])).toEqual([]);
});

it('keeps a good announcement beside malformed, unsafe and unknown-audience rows', () => {
  expect(
    parseAppNews([
      { ...row, audience: 'members' },
      { ...row, expires_at: row.starts_at },
      { ...row, body: 'x'.repeat(4001) },
      { ...row, action_url: 'file:///private.txt' },
      row,
    ]).map((item) => item.id),
  ).toEqual([1]);
  expect(newsActionUrl('https://u:p@example.invalid/')).toBeUndefined();
  expect(newsActionUrl(['javascript', 'alert(1)'].join(':'))).toBeUndefined();
  // URL normalization expands non-ASCII characters; the server stores that form.
  expect(
    newsActionUrl(`https://example.invalid/${'é'.repeat(500)}`),
  ).toBeUndefined();
  expect(readAppNews({ ...row, action_label: null })).toBeUndefined();
  expect(
    readAppNews({ ...row, action_label: null, action_url: null })?.action,
  ).toBeUndefined();
});

it('orders equal timestamps deterministically and excludes future and expired copy', () => {
  const items = parseAppNews([
    row,
    { ...row, id: 2 },
    { ...row, id: 3, starts_at: new Date(now + 500).toISOString() },
    { ...row, id: 4, expires_at: new Date(now).toISOString() },
  ]);
  expect(currentAppNews(items, now).map((item) => item.id)).toEqual([2, 1]);
  expect(currentAppNews(items, now + 2000)).toEqual([]);
});

it('introduces the authored story in one bounded line while preserving the full body', () => {
  const item = readAppNews(row);
  expect(item).toBeDefined();
  expect(newsPreviewText(item!.body)).toBe(
    'First paragraph. Second paragraph.',
  );
  expect(item!.body).toBe('First paragraph.\n\nSecond paragraph.');
  const excerpt = newsPreviewText('An actual product update. '.repeat(30));
  expect(excerpt).toMatch(/^An actual product update\./);
  expect(excerpt).toMatch(/…$/);
  expect(excerpt.length).toBeLessThanOrEqual(181);
  expect(excerpt).not.toMatch(/[\r\n]/);
  expect(
    readAppNews({ ...row, id: Number.MAX_SAFE_INTEGER + 1 }),
  ).toBeUndefined();
});

it.each(LOCALES)(
  'has news labels for registered locale $code',
  async ({ code }) => {
    await loadLocale(code);
    const title = translate(code, 'announce.news.title');
    expect(title).not.toBe('announce.news.title');
    expect(translate(code, 'announce.news.read')).not.toBe(
      'announce.news.read',
    );
  },
);

it.each(LOCALES.filter(({ code }) => code !== 'en'))(
  'has a native news title for $code',
  async ({ code }) => {
    await loadLocale(code);
    expect(translate(code, 'announce.news.title')).not.toBe(
      translate('en', 'announce.news.title'),
    );
  },
);
