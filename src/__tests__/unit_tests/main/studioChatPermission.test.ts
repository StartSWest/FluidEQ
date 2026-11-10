/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * How the member's Claude Code is started for the Studio's chat, and how its
 * permission questions are answered (Ivan, 2026-11-09: "if I ask it to
 * create app or modify fliid or anting it doent have access from there"):
 * no tool that reaches past the files, every use of a file put to FluidEQ,
 * Claude Code's own fences on, and FluidEQ answering every question itself.
 * Each wall is checked on the real argument list `claudeCodeCommand` builds.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CHAT_TOOLS,
  claudeCodeCommand,
} from '../../../main/studioChat/chatLaunch';
import {
  answerPermission,
  permissionAnswerLine,
} from '../../../main/studioChat/chatPermission';
import type { IChatProcess } from '../../../main/studioChat/chatProcess';
import { readStreamLine } from '../../../main/studioChat/chatStream';

/** The line Claude Code writes when it asks (measured on 2.1.316). */
const asking = (request: Record<string, unknown>) =>
  JSON.stringify({
    type: 'control_request',
    request_id: 'r-1',
    request: { subtype: 'can_use_tool', tool_use_id: 't-1', ...request },
  });

describe("Claude Code's question", () => {
  it("is read with the tool's own name beside the name it shows", () => {
    expect(
      readStreamLine(
        asking({
          tool_name: 'Read',
          display_name: 'Read file',
          input: { file_path: 'scene.frag' },
          description: 'scene.frag',
        }),
      ),
    ).toEqual([
      {
        type: 'permission',
        requestId: 'r-1',
        name: 'Read',
        tool: 'Read file',
        detail: 'scene.frag',
        input: { file_path: 'scene.frag' },
      },
    ]);
  });

  it('is nothing when it is some other control line', () => {
    expect(
      readStreamLine(
        JSON.stringify({
          type: 'control_request',
          request_id: 'r-2',
          request: { subtype: 'interrupt' },
        }),
      ),
    ).toEqual([]);
  });
});

describe("FluidEQ's answer", () => {
  let folder: string;
  let written: string[];
  const process = {
    write: (line: string) => {
      written.push(line);
    },
  } as unknown as IChatProcess;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-answer-'));
    written = [];
  });
  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const ask = (name: string, input: Record<string, unknown>) => {
    const [event] = readStreamLine(asking({ tool_name: name, input }));
    if (event?.type !== 'permission') {
      throw new Error('not a question');
    }
    const answer = answerPermission(process, folder, event);
    return { answer, line: JSON.parse(written[written.length - 1]) };
  };

  it("allows a file in the scene's folder, handing its input back unchanged", () => {
    const { answer, line } = ask('Write', {
      file_path: 'scene.frag',
      content: 'x',
    });
    expect(answer).toEqual({ allowed: true });
    expect(line).toEqual({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'r-1',
        response: {
          behavior: 'allow',
          updatedInput: { file_path: 'scene.frag', content: 'x' },
        },
      },
    });
  });

  it('refuses everything else, telling Claude why and not to try another way', () => {
    const outside = path.join(os.tmpdir(), 'not-the-scene.txt');
    (
      [
        ['Write', { file_path: outside, content: 'x' }],
        ['Bash', { command: 'mkdir C:\\elsewhere' }],
        ['PowerShell', { command: 'New-Item C:\\elsewhere' }],
        ['WebFetch', { url: 'https://example.com' }],
      ] as const
    ).forEach(([name, input]) => {
      const { answer, line } = ask(name, input);
      expect(answer.allowed).toBe(false);
      expect(line.response.response.behavior).toBe('deny');
      expect(line.response.response.message).toMatch(
        /Refused by FluidEQ.*do not try another way/,
      );
    });
    expect(written.every((one) => one.endsWith('\n'))).toBe(true);
  });

  it('builds its line from any answer', () => {
    expect(
      JSON.parse(
        permissionAnswerLine('r-9', {}, { allowed: false, why: 'because' }),
      ).response.response,
    ).toEqual({ behavior: 'deny', message: 'because' });
  });
});

describe("the member's Claude Code, started for a chat", () => {
  let own: string;
  beforeEach(() => {
    own = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-launch-'));
  });
  afterEach(() => {
    fs.rmSync(own, { recursive: true, force: true });
  });

  const launch = () =>
    claudeCodeCommand({
      own,
      folder: 'C:/Scenes/Lake',
      executable: 'claude',
      brief: 'brief',
      tools: { url: 'http://127.0.0.1:1/mcp', key: 'k' },
      model: 'default',
      effort: 'default',
      sessionId: undefined,
    });

  /** Every value given to a flag that takes a list, up to the next flag. */
  const listAfter = (args: string[], flag: string) => {
    const from = args.indexOf(flag) + 1;
    const end = args.findIndex((arg, at) => at >= from && arg.startsWith('--'));
    return args.slice(from, end === -1 ? undefined : end);
  };

  it('has the files and the skills, and no shell, web or agent', () => {
    const { args, cwd } = launch();
    expect(cwd).toBe('C:/Scenes/Lake');
    expect(args[args.indexOf('--tools') + 1]).toBe(CHAT_TOOLS);
    expect(CHAT_TOOLS.split(',')).toEqual([
      'Read',
      'Edit',
      'Write',
      'Glob',
      'Grep',
      'Skill',
    ]);
    // Denied by name too, which outranks any allow the member's settings hold.
    expect(listAfter(args, '--disallowedTools')).toEqual(
      expect.arrayContaining(['Bash', 'PowerShell', 'WebFetch', 'WebSearch']),
    );
    // Nothing about files is allowed unasked: every use comes to FluidEQ.
    const allowed = listAfter(args, '--allowedTools');
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.every((rule) => rule.startsWith('mcp__fluideq__'))).toBe(
      true,
    );
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--mcp-config');
  });

  it("puts every file use to FluidEQ, with Claude Code's own fences on top", () => {
    const { args } = launch();
    const file = args[args.indexOf('--settings') + 1];
    expect(path.dirname(file)).toBe(own);
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(settings.permissions.ask).toEqual(
      expect.arrayContaining(['Read', 'Edit', 'Write', 'Glob', 'Grep']),
    );
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(['Bash', 'PowerShell', 'WebFetch']),
    );
    expect(settings.permissions.blockReadsOutsideWorkingDirectories).toBe(true);
    expect(settings.permissions.blockWritesOutsideWorkingDirectories).toBe(
      true,
    );
    expect(settings.permissions.disableBypassPermissionsMode).toBe('disable');
    expect(settings.disableAllHooks).toBe(true);
    expect(settings.permissions.additionalDirectories).toBeUndefined();
  });

  it("asks in Claude Code's own manual mode, never a mode that asks nobody, and reads no scene folder's settings", () => {
    const { args } = launch();
    expect(args).toEqual(
      expect.arrayContaining(['--permission-prompt-tool', 'stdio']),
    );
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('manual');
    expect(args).not.toContain('dontAsk');
    expect(args).not.toContain('bypassPermissions');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--add-dir');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('user');
    // The per-machine lines out of the system prompt, which with the same
    // brief for every project is one cache for every scene's chat.
    expect(args).toContain('--exclude-dynamic-system-prompt-sections');
  });
});
