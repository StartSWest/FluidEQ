/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The cross-build instance marker.
 *
 * Every one of these is really the same question asked twice: does it stop a
 * second copy, and — the one that matters far more — can it ever stop the
 * first? Refusing to start is a worse failure than the confusion this prevents,
 * so the uncertain cases are all tested for "start".
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MARKER_REFRESH_MS,
  MARKER_STALE_MS,
  claimInstance,
  isAnotherInstanceLive,
} from '../../../main/singleInstance';

describe('the cross-build instance marker', () => {
  let dir: string;
  let marker: string;
  const NOW = 1_000_000;

  const writeMarker = (contents: unknown) =>
    fs.writeFileSync(
      marker,
      typeof contents === 'string' ? contents : JSON.stringify(contents),
      'utf8',
    );

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-instance-'));
    marker = path.join(dir, 'fluideq-running.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sees a live copy that refreshed its marker', () => {
    writeMarker({ pid: 4321, at: NOW - 1000 });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(true);
  });

  it('starts when there is no marker at all', () => {
    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  it('starts when the marker is unreadable', () => {
    writeMarker('not json');

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  it('starts when the marker is missing its fields', () => {
    writeMarker({ pid: 'four thousand' });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  it('starts when nobody has refreshed the marker', () => {
    // The crash case. The pid may well be alive again by now — handed to
    // something unrelated — and this is the check that stops that locking the
    // user out of their equaliser.
    writeMarker({ pid: 4321, at: NOW - MARKER_STALE_MS - 1 });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  it('starts when the marker is dated in the future', () => {
    // What a clock change looks like from here.
    writeMarker({ pid: 4321, at: NOW + MARKER_STALE_MS * 10 });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  it('starts when the process named by the marker is gone', () => {
    writeMarker({ pid: 4321, at: NOW });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 1,
        isAlive: () => false,
      }),
    ).toBe(false);
  });

  it('does not mistake its own marker for somebody else’s', () => {
    // A restart that reused the pid, or simply asking twice.
    writeMarker({ pid: 99, at: NOW });

    expect(
      isAnotherInstanceLive(marker, {
        now: NOW,
        selfPid: 99,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  describe('claiming it', () => {
    it('writes the marker and keeps it fresh', () => {
      let clock = NOW;
      let tick = () => undefined as unknown as void;
      const release = claimInstance(marker, {
        selfPid: 99,
        now: () => clock,
        setInterval: ((fn: () => void) => {
          tick = fn;
          return { unref: () => undefined } as unknown as NodeJS.Timeout;
        }) as unknown as typeof setInterval,
        clearInterval: (() => undefined) as unknown as typeof clearInterval,
      });

      expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toEqual({
        pid: 99,
        at: NOW,
      });

      // The refresh is what keeps a running copy from ageing into staleness.
      clock = NOW + MARKER_REFRESH_MS;
      tick();
      expect(JSON.parse(fs.readFileSync(marker, 'utf8')).at).toBe(
        NOW + MARKER_REFRESH_MS,
      );

      release();
      expect(fs.existsSync(marker)).toBe(false);
    });

    it('leaves a marker another copy has since claimed', () => {
      const release = claimInstance(marker, { selfPid: 99, now: () => NOW });
      writeMarker({ pid: 1234, at: NOW });

      release();

      // Deleting it would have handed a third copy a free pass past a running
      // second one.
      expect(JSON.parse(fs.readFileSync(marker, 'utf8')).pid).toBe(1234);
    });

    it('survives being released twice', () => {
      const release = claimInstance(marker, { selfPid: 99, now: () => NOW });
      release();
      expect(() => release()).not.toThrow();
    });

    it('starts anyway when the marker cannot be written', () => {
      // A read-only or missing directory must cost the cross-build check and
      // nothing else.
      const unwritable = path.join(dir, 'no', 'such', 'place.json');
      expect(() => claimInstance(unwritable, { selfPid: 99 })()).not.toThrow();
    });
  });
});
