/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The renderer dev server's watch, from the main checkout and from a worktree
 * nested inside it.
 *
 * The main checkout must never scan the worktrees parked under `.claude` (a
 * stale one with a locked file once killed the whole dev process), and a dev
 * server run from one of those worktrees must still watch its own files: the
 * old pattern matched `.claude` anywhere, so a worktree's dev server ignored
 * everything it served and never rebuilt. Watchpack tests the pattern with
 * forward slashes; the root arrives with backslashes on Windows.
 */
import watchIgnored from '../../../.erb/configs/watchIgnored';

const MAIN = 'D:\\DEV\\FluidEQ';
const WORKTREE = 'D:\\DEV\\FluidEQ\\.claude\\worktrees\\core-split';

describe('what the renderer dev server watches', () => {
  it('keeps the main checkout out of its embedded worktrees', () => {
    const ignored = watchIgnored(MAIN, true);
    expect(ignored.test('D:/DEV/FluidEQ/.claude/worktrees/x/src/a.ts')).toBe(
      true,
    );
    expect(ignored.test('D:/DEV/FluidEQ/.gigaide/copy/src/a.ts')).toBe(true);
    // The control: its own sources are watched.
    expect(ignored.test('D:/DEV/FluidEQ/src/renderer/App.tsx')).toBe(false);
  });

  it('watches a worktree’s own files from its own dev server', () => {
    const ignored = watchIgnored(WORKTREE, true);
    expect(
      ignored.test(
        'D:/DEV/FluidEQ/.claude/worktrees/core-split/src/renderer/App.tsx',
      ),
    ).toBe(false);
    // Folders of that name inside the worktree are still left alone.
    expect(
      ignored.test(
        'D:/DEV/FluidEQ/.claude/worktrees/core-split/.claude/harness/a.tsx',
      ),
    ).toBe(true);
  });

  it('ignores every node_modules, wherever it is', () => {
    const ignored = watchIgnored(WORKTREE, true);
    expect(ignored.test('C:/elsewhere/node_modules/react/index.js')).toBe(true);
  });

  it('reads either separator, and a root given with a trailing one', () => {
    const ignored = watchIgnored(`${MAIN}\\`, true);
    expect(ignored.test('D:\\DEV\\FluidEQ\\.claude\\worktrees\\x\\a.ts')).toBe(
      true,
    );
    expect(ignored.test('D:/DEV/FluidEQ/.claude/worktrees/x/a.ts')).toBe(true);
  });

  it('matches a drive letter in either case on Windows, and only there', () => {
    expect(
      watchIgnored(MAIN, true).test('d:/DEV/FluidEQ/.claude/worktrees/x/a.ts'),
    ).toBe(true);
    expect(
      watchIgnored('/home/dev/FluidEQ', false).test(
        '/home/dev/fluideq/.claude/worktrees/x/a.ts',
      ),
    ).toBe(false);
  });

  it('takes the root literally, not as a pattern', () => {
    const ignored = watchIgnored('D:\\DEV\\Fluid.EQ (copy)', true);
    expect(ignored.test('D:/DEV/Fluid.EQ (copy)/.claude/x/a.ts')).toBe(true);
    expect(ignored.test('D:/DEV/FluidXEQ (copy)/.claude/x/a.ts')).toBe(false);
  });
});
