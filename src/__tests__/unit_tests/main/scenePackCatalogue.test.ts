/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeCatalogueEntry } from '../../../common/scenePacks';
import { createScenePackCatalogue } from '../../../main/scenePackCatalogue';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5 / month',
};

const AURORA = {
  id: 'aurora',
  version: 1,
  names: { en: 'Aurora', es: 'Aurora boreal' },
  fallback_style: 'area',
  swatch: ['#0B1F2C', '#00e5cf'],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('a row of the public catalogue', () => {
  it('keeps the picker fields and normalises them', () => {
    expect(normalizeCatalogueEntry(AURORA)).toEqual({
      id: 'aurora',
      version: 1,
      names: { en: 'Aurora', es: 'Aurora boreal' },
      fallbackStyle: 'area',
      swatch: ['#0b1f2c', '#00e5cf'],
    });
  });

  it('drops a row it cannot paint', () => {
    expect(normalizeCatalogueEntry({ ...AURORA, names: {} })).toBeNull();
    expect(
      normalizeCatalogueEntry({ ...AURORA, fallback_style: 'hologram' }),
    ).toBeNull();
    expect(normalizeCatalogueEntry({ ...AURORA, id: 'Not An Id' })).toBeNull();
    expect(normalizeCatalogueEntry('aurora')).toBeNull();
  });
});

describe('the scene pack catalogue', () => {
  let directory: string;
  let fetchImpl: jest.Mock;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-catalogue-'));
    fetchImpl = jest.fn();
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const build = () =>
    createScenePackCatalogue({
      userDataDir: directory,
      config: CONFIG,
      fetchImpl,
    });

  it('starts empty and asks the public listing anonymously', async () => {
    fetchImpl.mockResolvedValue(json([AURORA]));
    const catalogue = build();
    expect(catalogue.list()).toEqual([]);
    expect(await catalogue.refresh()).toBe(true);
    expect(catalogue.list().map((entry) => entry.id)).toEqual(['aurora']);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/scene_catalogue');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(CONFIG.supabaseAnonKey);
    // The publishable key alone: the picker exists before anyone signs in.
    expect(headers.Authorization).toBe(`Bearer ${CONFIG.supabaseAnonKey}`);
  });

  it('remembers the listing on disk for the next launch', async () => {
    fetchImpl.mockResolvedValue(json([AURORA]));
    await build().refresh();
    expect(
      build()
        .list()
        .map((entry) => entry.id),
    ).toEqual(['aurora']);
  });

  it('answers "unchanged" for the same listing and keeps it when the server fails', async () => {
    fetchImpl.mockResolvedValue(json([AURORA]));
    const catalogue = build();
    await catalogue.refresh();
    expect(await catalogue.refresh()).toBe(false);

    fetchImpl.mockResolvedValue(json({ error: 'down' }, 500));
    expect(await catalogue.refresh()).toBe(false);
    expect(catalogue.list()).toHaveLength(1);

    fetchImpl.mockRejectedValue(new Error('offline'));
    expect(await catalogue.refresh()).toBe(false);
    expect(catalogue.list()).toHaveLength(1);
  });

  it('drops malformed rows and duplicate ids rather than guessing', async () => {
    fetchImpl.mockResolvedValue(
      json([AURORA, { ...AURORA, version: 2 }, { id: 'broken' }, 'nope']),
    );
    const catalogue = build();
    await catalogue.refresh();
    expect(catalogue.list()).toHaveLength(1);
    expect(catalogue.list()[0].version).toBe(1);
  });
});
