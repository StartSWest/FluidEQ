/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import createRemoteAudioGroup from '../../../main/remoteAudioGroup';
import type { ILanRemoteAudioSignal } from '../../../common/remoteAudio';
import {
  compareAudioComputers,
  isAudioGroupHello,
  isAudioGroupLink,
  type IAudioGroupEndpoint,
  type IAudioGroupLink,
} from '../../../common/remoteAudioGroup';

const endpoint = (id: string): IAudioGroupEndpoint => ({
  computerId: id.repeat(32),
  deviceName: `PC ${id}`,
  addresses: ['192.168.1.2'],
  port: 1234,
});
const setup = () => {
  const saved: IAudioGroupLink[] = [];
  const sent: ILanRemoteAudioSignal[] = [];
  const revoked = new Set<string>();
  const join = jest.fn();
  const group = createRemoteAudioGroup({
    self: () => ({ endpoint: endpoint('a'), secret: 'a'.repeat(43) }),
    saved: () => saved,
    known: () => saved.map((link) => link.computerId),
    revoked: (id) => revoked.has(id),
    save: (link) => {
      const index = saved.findIndex(
        (item) => item.computerId === link.computerId,
      );
      if (index >= 0) {
        saved.splice(index, 1);
      }
      saved.push(link);
    },
    join,
    send: (message) => {
      sent.push(message);
    },
  });
  const hello = (peerId: string, id: string) =>
    group.receive({
      peerId,
      signal: {
        kind: 'stream-mode',
        mode: 'music',
        group: { version: 1, endpoint: endpoint(id), known: [] },
      },
    });
  return { group, saved, sent, revoked, join, hello };
};

it('negotiates using an old message kind and never introduces to an older peer', () => {
  const { group, sent, hello } = setup();
  group.connected('b', endpoint('b').computerId);
  group.connected('c', endpoint('c').computerId);
  hello('b', 'b');
  expect(
    sent
      .filter((message) => message.peerId === 'c')
      .map((message) => message.signal.kind),
  ).toEqual(['stream-mode']);
});
it('ignores unnegotiated, forged-issuer, revoked and public-address introductions', () => {
  const { group, saved, join, hello, revoked } = setup();
  group.connected('b', endpoint('b').computerId);
  const link = {
    ...endpoint('c'),
    issuer: endpoint('b').computerId,
    secret: 'c'.repeat(43),
  };
  group.receive({ peerId: 'b', signal: { kind: 'group-link', link } });
  expect(saved).toEqual([]);
  hello('b', 'b');
  join.mockClear();
  group.receive({
    peerId: 'b',
    signal: {
      kind: 'group-link',
      link: { ...link, issuer: endpoint('c').computerId },
    },
  });
  group.receive({
    peerId: 'b',
    signal: { kind: 'group-link', link: { ...link, addresses: ['8.8.8.8'] } },
  });
  revoked.add(link.computerId);
  group.receive({ peerId: 'b', signal: { kind: 'group-link', link } });
  expect(join).not.toHaveBeenCalled();
});
it('makes concurrent pair introductions deterministic and never forwards the host secret', () => {
  const { group, saved, hello } = setup();
  group.connected('b', endpoint('b').computerId);
  hello('b', 'b');
  group.connected('c', endpoint('c').computerId);
  hello('c', 'c');
  const target = endpoint('d');
  const receive = (peerId: string, issuer: string, secret: string) =>
    group.receive({
      peerId,
      signal: {
        kind: 'group-link',
        link: {
          ...target,
          issuer: endpoint(issuer).computerId,
          secret: secret.repeat(43),
        },
      },
    });
  receive('c', 'c', 'c');
  receive('b', 'b', 'b');
  receive('c', 'c', 'c');
  expect(
    saved.find((link) => link.computerId === target.computerId)?.secret,
  ).toBe('b'.repeat(43));
});
it('bounds group descriptions and defines one duplicate-name order on every OS', () => {
  expect(
    isAudioGroupHello({
      version: 1,
      endpoint: endpoint('a'),
      known: Array(33).fill(endpoint('b').computerId),
    }),
  ).toBe(false);
  expect(
    isAudioGroupLink({
      ...endpoint('a'),
      issuer: endpoint('b').computerId,
      secret: 'too short',
    }),
  ).toBe(false);
  const rows = [
    { name: 'ＳＴＵＤＩＯ', computerId: 'z' },
    { name: 'studio', computerId: 'a' },
    { name: 'Alpha', computerId: 'b' },
  ];
  expect(rows.sort(compareAudioComputers).map((row) => row.computerId)).toEqual(
    ['b', 'a', 'z'],
  );
});
