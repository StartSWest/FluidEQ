/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the core's Library player tells the FluidEQ Engine about its song,
 * and the handshake at a stopped transport that decides who runs its rack
 * (`main/libraryPlayer/sourcePublication.ts`). The window ran this over a
 * channel; the cases it was held to now hold the core's copy, which speaks
 * to the publisher directly.
 */
import type { ISourceAnalysisUpdate } from '../../../common/dsp/sourceAnalysis';
import {
  createSourcePublication,
  type TSourcePublisher,
} from '../../../main/libraryPlayer/sourcePublication';

/** A publisher whose answers the test settles by hand, in any order. */
const publisherSpy = () => {
  const calls: { action: string; update?: ISourceAnalysisUpdate }[] = [];
  const answers: Array<(value: boolean) => void> = [];
  const pending = (action: string, update?: unknown) => {
    calls.push({
      action,
      ...(update ? { update: update as ISourceAnalysisUpdate } : {}),
    });
    return new Promise<boolean>((resolve) => {
      answers.push(resolve);
    });
  };
  const publisher: TSourcePublisher = {
    publish: (update) => {
      calls.push({
        action: 'publish',
        update: update as ISourceAnalysisUpdate,
      });
      return Promise.resolve();
    },
    capable: () => pending('capable'),
    prepare: (update) => pending('prepare', update),
    fallback: (update) => pending('fallback', update),
    release: () => {
      calls.push({ action: 'release' });
      return Promise.resolve();
    },
  };
  return {
    publisher,
    calls,
    /** Answer the oldest question still waiting. */
    answer: (value: boolean) => answers.shift()?.(value),
  };
};

const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 16; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

describe('the song published', () => {
  it('is a new passage for a new song, and not for its measurement arriving', () => {
    const { publisher, calls } = publisherSpy();
    const sources = createSourcePublication(publisher);
    sources.setSource('a', undefined);
    const first = calls[calls.length - 1]?.update;
    sources.setSource('a', {
      version: 2,
      integratedLufs: -14,
      truePeakDbtp: -1,
    });
    const measured = calls[calls.length - 1]?.update;
    sources.setSource('b', undefined);
    const next = calls[calls.length - 1]?.update;
    expect(measured?.epoch).toBe(first?.epoch);
    expect(measured?.analysis?.integratedLufs).toBe(-14);
    expect(next?.epoch).toBe((first?.epoch ?? 0) + 1);
    expect(next).not.toHaveProperty('analysis');
  });

  it('is a new passage after a seek', () => {
    const { publisher, calls } = publisherSpy();
    const sources = createSourcePublication(publisher);
    sources.setSource('a', undefined);
    const before = calls[calls.length - 1]?.update?.epoch ?? 0;
    sources.markBoundary();
    expect(calls[calls.length - 1]?.update?.epoch).toBe(before + 1);
  });

  it('sends nothing when nothing changed', () => {
    const { publisher, calls } = publisherSpy();
    const sources = createSourcePublication(publisher);
    sources.setPlayback(true, false);
    const count = calls.length;
    sources.setPlayback(true, false);
    expect(calls).toHaveLength(count);
  });
});

describe('preparing a start', () => {
  it('lets the engine take the song when it can and acknowledges it', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('first-track', undefined);
    const preparing = sources.prepareStart(true);
    await drain();
    spy.answer(true);
    await drain();
    expect(spy.calls.map(({ action }) => action)).toContain('prepare');
    expect(
      spy.calls.find(({ action }) => action === 'prepare')?.update,
    ).toMatchObject({ trackId: 'first-track', libraryAudible: true });
    spy.answer(true);
    await expect(preparing).resolves.toBe(true);
  });

  it('keeps the host’s rack, without asking, when the engine does not run', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('first-track', undefined);
    const preparing = sources.prepareStart(false);
    await drain();
    expect(spy.calls.map(({ action }) => action)).not.toContain('capable');
    expect(spy.calls[spy.calls.length - 1]).toMatchObject({
      action: 'fallback',
      update: { trackId: 'first-track', libraryAudible: true },
    });
    spy.answer(true);
    await expect(preparing).resolves.toBe(false);
  });

  it('falls back when the engine says it cannot take the song', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('first-track', undefined);
    const preparing = sources.prepareStart(true);
    await drain();
    spy.answer(false);
    await drain();
    expect(spy.calls[spy.calls.length - 1]?.action).toBe('fallback');
    spy.answer(true);
    await expect(preparing).resolves.toBe(false);
  });

  it('refuses the start when even the fallback was refused', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('first-track', undefined);
    const preparing = sources.prepareStart(false);
    await drain();
    spy.answer(false);
    await drain();
    // Refused once more on the way out: an error is asked about again.
    expect(
      spy.calls.filter(({ action }) => action === 'fallback'),
    ).toHaveLength(2);
    spy.answer(false);
    await expect(preparing).rejects.toThrow('could not be prepared');
  });

  it('lets no old answer make the engine the owner after a release', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('first-track', undefined);
    const preparing = sources.prepareStart(true);
    await drain();
    spy.answer(true);
    await drain();
    // The transport stopped while the engine was still preparing.
    await expect(sources.release()).resolves.toBe(true);
    spy.answer(true);
    await expect(preparing).resolves.toBe(false);
  });

  it('holds the Library heard while a start is being prepared', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setSource('a', undefined);
    sources.setPlayback(true, false);
    const preparing = sources.prepareStart(false);
    await drain();
    // A status saying "not heard" arriving mid-preparation does not win.
    sources.setPlayback(false, false);
    const published = spy.calls.filter(({ action }) => action === 'publish');
    expect(published[published.length - 1]?.update?.libraryAudible).toBe(true);
    spy.answer(true);
    await preparing;
  });
});

describe('releasing', () => {
  it('says the Library is no longer heard and releases the engine', async () => {
    const spy = publisherSpy();
    const sources = createSourcePublication(spy.publisher);
    sources.setPlayback(true, false);
    await expect(sources.release()).resolves.toBe(true);
    expect(spy.calls[spy.calls.length - 1]?.action).toBe('release');
  });
});
