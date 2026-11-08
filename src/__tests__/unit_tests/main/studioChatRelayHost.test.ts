/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * What the process holding the Studio's chats across a restart keeps, and
 * for how long (`chatRelayHost.ts`): a FluidEQ that comes back gets each
 * chat's lines since the turn it last saw finish, never a question it
 * already answered; with no FluidEQ there, a chat between turns is let go at
 * once and one mid-turn when the turn ends; and with nothing left, the host
 * writes down what nobody collected and exits.
 */

import {
  createRelayHost,
  type IHeldProcess,
} from '../../../main/studioChat/chatRelayHost';
import {
  readRelayReport,
  relayLine,
  type IRelayChild,
  type TRelayReport,
} from '../../../main/studioChat/chatRelayProtocol';

const TOKEN = 'secret';

interface IFakeChild {
  process: IHeldProcess;
  events: {
    line(line: string): void;
    closed(): void;
  };
  written: string[];
  inputClosed: boolean;
  ended: boolean;
}

const setUp = () => {
  const children: IFakeChild[] = [];
  const left: IRelayChild[][] = [];
  let exits = 0;
  const host = createRelayHost({
    token: TOKEN,
    spawn: (_command, events) => {
      const child: IFakeChild = {
        events,
        written: [],
        inputClosed: false,
        ended: false,
        process: {
          pid: 100 + children.length,
          write: (text) => {
            child.written.push(text);
          },
          closeInput: () => {
            child.inputClosed = true;
          },
          end: () => {
            child.ended = true;
          },
        },
      };
      children.push(child);
      return child.process;
    },
    writeLeft: (children_) => left.push(children_),
    exit: () => {
      exits += 1;
    },
  });
  /** A FluidEQ connecting, and what it is told. */
  const connect = (token = TOKEN) => {
    const reports: TRelayReport[] = [];
    let closed = false;
    const link = host.connect(
      (text) =>
        text
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            const report = readRelayReport(line);
            if (report) {
              reports.push(report);
            }
          }),
      () => {
        closed = true;
      },
    );
    link.receive(relayLine({ type: 'hello', token }).trim());
    const request = (message: Parameters<typeof relayLine>[0]) =>
      link.receive(relayLine(message).trim());
    return {
      reports,
      link,
      request,
      closed: () => closed,
      welcome: () =>
        reports.find(
          (report): report is Extract<TRelayReport, { type: 'welcome' }> =>
            report.type === 'welcome',
        ),
    };
  };
  return { children, left, exits: () => exits, connect, host };
};

const say = (message: Record<string, unknown>) => JSON.stringify(message);
const userLine = `${say({ type: 'user', uuid: 'u', message: { content: 'hi' } })}\n`;
const result = say({ type: 'result', subtype: 'success', result: 'done' });
const question = (id: string) =>
  say({
    type: 'control_request',
    request_id: id,
    request: { subtype: 'can_use_tool', tool_name: 'Bash' },
  });
const answer = (id: string) =>
  `${say({
    type: 'control_response',
    response: { subtype: 'success', request_id: id, response: {} },
  })}\n`;
const command = { executable: 'claude', args: [], cwd: 'C:/Scenes/Lake' };

describe('the chat relay host', () => {
  it('says nothing to a connection without the key, and hangs up on it', () => {
    const { connect } = setUp();
    const stranger = connect('guess');
    expect(stranger.reports).toEqual([]);
    expect(stranger.closed()).toBe(true);
    // The control: the key is welcomed.
    expect(connect().welcome()).toEqual({ type: 'welcome', children: [] });
  });

  it("hands a FluidEQ that comes back the turn's lines, without questions it answered", () => {
    const { children, connect } = setUp();
    const first = connect();
    first.request({ type: 'start', id: 'lake', ...command });
    first.request({ type: 'write', id: 'lake', text: userLine });
    const [child] = children;
    child.events.line('one');
    child.events.line(question('q-1'));
    first.request({ type: 'write', id: 'lake', text: answer('q-1') });
    child.events.line('two');
    child.events.line(question('q-2'));
    first.link.gone();

    const [held] = connect().welcome()?.children ?? [];
    expect(held.lines).toEqual([
      { seq: 0, line: 'one' },
      { seq: 2, line: 'two' },
      { seq: 3, line: question('q-2') },
    ]);
    expect(held).toMatchObject({ id: 'lake', pid: 100, next: 4, ended: false });
    // Mid-turn, it was kept running for the FluidEQ that came back.
    expect(child.inputClosed).toBe(false);
  });

  it('starts afresh at the message after a finished turn, never before', () => {
    const { children, connect } = setUp();
    const fluid = connect();
    fluid.request({ type: 'start', id: 'lake', ...command });
    fluid.request({ type: 'write', id: 'lake', text: userLine });
    const [child] = children;
    child.events.line('first turn');
    child.events.line(result);
    // FluidEQ may not have read the end yet: the turn is still kept.
    fluid.request({
      type: 'write',
      id: 'lake',
      text: `${say({ type: 'control_request', request_id: 'x', request: {} })}\n`,
    });
    fluid.link.gone();
    const kept = connect();
    expect(kept.welcome()?.children[0].lines.map(({ line }) => line)).toEqual([
      'first turn',
      result,
    ]);
    kept.request({ type: 'write', id: 'lake', text: userLine });
    child.events.line('second turn');
    kept.link.gone();
    expect(
      connect()
        .welcome()
        ?.children[0].lines.map(({ line }) => line),
    ).toEqual(['second turn']);
  });

  it('with no FluidEQ, lets a chat between turns go at once and one mid-turn at its end', () => {
    const { children, connect } = setUp();
    const fluid = connect();
    fluid.request({ type: 'start', id: 'idle', ...command });
    fluid.request({ type: 'start', id: 'busy', ...command });
    fluid.request({ type: 'write', id: 'busy', text: userLine });
    const [idle, busy] = children;
    fluid.link.gone();
    expect(idle.inputClosed).toBe(true);
    expect(busy.inputClosed).toBe(false);
    busy.events.line('still working');
    expect(busy.inputClosed).toBe(false);
    busy.events.line(result);
    expect(busy.inputClosed).toBe(true);
  });

  it('writes down what nobody collected and exits once nothing runs', () => {
    const { children, connect, left, exits } = setUp();
    const fluid = connect();
    fluid.request({ type: 'start', id: 'lake', ...command });
    fluid.request({ type: 'write', id: 'lake', text: userLine });
    const [child] = children;
    fluid.link.gone();
    child.events.line('the rest');
    child.events.line(result);
    expect(exits()).toBe(0);
    child.events.closed();
    expect(exits()).toBe(1);
    expect(left).toEqual([
      [
        {
          id: 'lake',
          pid: 100,
          lines: [
            { seq: 0, line: 'the rest' },
            { seq: 1, line: result },
          ],
          next: 2,
          ended: true,
          failed: false,
        },
      ],
    ]);
  });

  it('stays while a FluidEQ is connected, and leaves nothing behind when it saw the end', () => {
    const { children, connect, left, exits } = setUp();
    const fluid = connect();
    fluid.request({ type: 'start', id: 'lake', ...command });
    children[0].events.closed();
    expect(exits()).toBe(0);
    expect(fluid.reports).toContainEqual({ type: 'closed', id: 'lake' });
    fluid.link.gone();
    expect(exits()).toBe(1);
    expect(left).toEqual([]);
  });

  it('a process replaced under the same id says nothing as it ends', () => {
    const { children, connect } = setUp();
    const fluid = connect();
    fluid.request({ type: 'start', id: 'lake', ...command });
    fluid.request({ type: 'start', id: 'lake', ...command });
    const [old, current] = children;
    expect(old.ended).toBe(true);
    old.events.closed();
    expect(fluid.reports).not.toContainEqual({ type: 'closed', id: 'lake' });
    // The control: the current one ending is told.
    current.events.closed();
    expect(fluid.reports).toContainEqual({ type: 'closed', id: 'lake' });
  });

  it('a second FluidEQ takes over, and the first one going changes nothing', () => {
    const { children, connect } = setUp();
    const first = connect();
    first.request({ type: 'start', id: 'lake', ...command });
    first.request({ type: 'write', id: 'lake', text: userLine });
    const second = connect();
    children[0].events.line('to the second');
    first.link.gone();
    expect(second.reports).toContainEqual({
      type: 'line',
      id: 'lake',
      seq: 0,
      line: 'to the second',
    });
    expect(first.reports.some((report) => report.type === 'line')).toBe(false);
    expect(children[0].inputClosed).toBe(false);
  });
});
