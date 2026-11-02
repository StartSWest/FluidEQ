/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type os from 'os';
import { isLanRemoteAudioSignal } from '../../common/remoteAudio';
import {
  decodeDiscoveryAnnouncement,
  encodeDiscoveryAnnouncement,
  encodeDiscoveryQuery,
  isDiscoveryQuery,
} from '../remoteAudioDiscovery';
import { discoveryTargets, lanInterfaces } from '../remoteAudioLanAddresses';
import {
  PACKET_AUDIO,
  PACKET_AUTH_ACCEPTED,
  PACKET_AUTH_CHALLENGE,
  PACKET_AUTH_READY,
  PACKET_SIGNAL,
  computerIdOf,
  decodePairingCode,
  deriveSessionKey,
  encodeAudioAsync,
  encodeAudioRaw,
  encodePairingCode,
  keyFromSecret,
  normalizeAudioChunk,
  sealPacket,
} from '../remoteAudioLanProtocol';

/**
 * Share Audio's wire as this side writes and reads it, written by
 * `generate-sound-hops-fixture.ts` into `native/share-core/tests/
 * share_wire_fixture.h` for `share_wire_test.cpp`: a computer whose link is
 * the C++ one (`native/share-core`) has to be read by every FluidEQ that
 * links with it, and read every one of them. Every value here is made by
 * the TypeScript the app runs — the codes, the ids, the keys, packets sealed
 * under fixed IVs (the wire's are fresh, `sealPacket`), audio raw and
 * squeezed, the discovery datagrams — and every reading is asked of it:
 * which codes, control messages and datagrams it takes, and what it takes
 * them as.
 */

const SECRETS = [
  'q3ZpY8K2wP0aB1cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'secret with spaces and ñandú, forty characters at the least',
];
const PEER_IDS = ['peer-1', 'a8f0c2e4-91b3-4d5e-8f70-123456789abc', 'ñ'];

/**
 * A C string of UTF-8 bytes, everything but printable ASCII in octal; a
 * digit after an escape starts a literal of its own, which the compiler
 * would otherwise warn could be read as part of it.
 */
const cText = (value: string | Buffer) => {
  let out = '"';
  let escaped = false;
  [...(typeof value === 'string' ? Buffer.from(value, 'utf8') : value)].forEach(
    (byte) => {
      if (byte >= 0x20 && byte < 0x7f && byte !== 0x22 && byte !== 0x5c) {
        const isDigit = byte >= 0x30 && byte <= 0x39;
        out += `${escaped && isDigit ? '" "' : ''}${String.fromCharCode(byte)}`;
        escaped = false;
      } else {
        out += `\\${byte.toString(8).padStart(3, '0')}`;
        escaped = true;
      }
    },
  );
  return `${out}"`;
};

const cBytes = (value: Uint8Array) =>
  value.length === 0 ? '{}' : `{${[...value].join(', ')}}`;

const ivOf = (seed: number) =>
  Buffer.from(
    Array.from({ length: 12 }, (_, at) => (seed * 31 + at * 7) % 256),
  );

/** What codes are made from: addresses, port, which secret, the name. */
const MADE: [string[], number, number, string][] = [
  [
    [
      '192.168.1.20',
      '8.8.8.8',
      '10.0.0.5',
      '192.168.1.20',
      '172.32.0.1',
      '172.15.255.255',
      '172.20.1.1',
    ],
    51234,
    0,
    'Living room PC',
  ],
  [['169.254.10.2'], 1, 2, 'Estudio de Iván 🎧'],
  [
    Array.from({ length: 7 }, (_, at) => `10.0.0.${at + 1}`),
    65535,
    1,
    'Seven addresses',
  ],
];

const pairingCodes = () => {
  const made = MADE.map(([addresses, port, secret, name]) =>
    encodePairingCode(addresses, port, SECRETS[secret], name),
  );
  const json = (value: object) =>
    `FLUIDEQ-LAN-2.${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`;
  const valid = {
    address: '192.168.0.9',
    addresses: ['192.168.0.9'],
    deviceName: 'Den',
    port: 4000,
    secret: SECRETS[0],
  };
  const decoded = [
    ...made,
    // Spaces and the other alphabet are passed over, as Node reads base64.
    `FLUIDEQ-LAN-2. ${made[0].slice('FLUIDEQ-LAN-2.'.length).replace(/-/g, '+')}`,
    `${made[0]}x`,
    // Short in JavaScript's count, long in bytes: still read.
    `${made[0]}${'é'.repeat(400)}`,
    'FLUIDEQ-LAN-1.abc',
    `FLUIDEQ-LAN-2.${'A'.repeat(1011)}`,
    'FLUIDEQ-LAN-2.bm90IGpzb24',
    json(valid),
    json({ ...valid, deviceName: '   ' }),
    json({ ...valid, deviceName: undefined }),
    json({ ...valid, deviceName: null }),
    json({ ...valid, deviceName: 'x'.repeat(129) }),
    json({ ...valid, port: 0 }),
    json({ ...valid, port: 65536 }),
    json({ ...valid, port: 1.5 }),
    json({ ...valid, port: '4000' }),
    json({ ...valid, secret: 'short' }),
    json({ ...valid, secret: 'x'.repeat(65) }),
    json({ ...valid, address: '8.8.8.8', addresses: [] }),
    json({
      ...valid,
      address: '8.8.8.8',
      addresses: ['10.1.1.1', '010.1.1.1'],
    }),
    json({
      ...valid,
      addresses: Array.from({ length: 7 }, (_, at) => `10.0.0.${at + 1}`),
    }),
    json({ ...valid, addresses: 'not a list' }),
    json([valid]),
  ];
  return { made, decoded };
};

const SIGNALS: unknown[] = [
  { peerId: 'p', signal: { kind: 'stop' } },
  { peerId: 'p', signal: { kind: 'stop', forget: true } },
  { peerId: 'p', signal: { kind: 'stop', forget: 'yes' } },
  { peerId: 'p', signal: { kind: 'stop', forget: null } },
  { peerId: '', signal: { kind: 'stop' } },
  { peerId: 'x'.repeat(129), signal: { kind: 'stop' } },
  { peerId: 'p'.repeat(128), signal: { kind: 'stop' } },
  { peerId: 'p', signal: { kind: 'unknown' } },
  { peerId: 'p', signal: [] },
  { peerId: 'p', signal: { kind: 'stream-mode', mode: 'music' } },
  { peerId: 'p', signal: { kind: 'stream-mode', mode: 'radio' } },
  {
    peerId: 'p',
    signal: {
      kind: 'stream-mode',
      mode: 'video',
      duplex: { sends: true, plays: false },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'stream-mode',
      mode: 'video',
      duplex: { sends: true, plays: false, paused: 1 },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'stream-mode',
      mode: 'music',
      group: {
        version: 1,
        endpoint: {
          computerId: computerIdOf(SECRETS[0]),
          deviceName: 'Den',
          addresses: ['192.168.1.2'],
          port: 4000,
        },
        known: [computerIdOf(SECRETS[1])],
      },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'stream-mode',
      mode: 'music',
      group: {
        version: 2,
        endpoint: {
          computerId: computerIdOf(SECRETS[0]),
          deviceName: 'Den',
          addresses: [],
          port: 4000,
        },
        known: [],
      },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'group-link',
      link: {
        computerId: computerIdOf(SECRETS[0]),
        deviceName: 'Den',
        addresses: ['192.168.1.2', '10.0.0.200'],
        port: 4000,
        issuer: computerIdOf(SECRETS[1]),
        secret: SECRETS[0],
      },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'group-link',
      link: {
        computerId: computerIdOf(SECRETS[0]),
        deviceName: 'Den',
        addresses: ['192.168.100.200'],
        port: 4000,
        issuer: computerIdOf(SECRETS[1]),
        secret: SECRETS[0],
      },
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'peer-ready',
      deviceName: '  Kitchen  ',
      address: '192.168.1.4',
      computerId: computerIdOf(SECRETS[1]),
      introduced: true,
    },
  },
  { peerId: 'p', signal: { kind: 'peer-ready', deviceName: '  　 ' } },
  {
    peerId: 'p',
    signal: { kind: 'peer-ready', deviceName: '🎧'.repeat(64) },
  },
  {
    peerId: 'p',
    signal: { kind: 'peer-ready', deviceName: '🎧'.repeat(65) },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'now-playing',
      playing: {
        title: 'Song',
        artist: 'Band',
        isPlaying: true,
        positionMs: 1200.5,
        durationMs: 180000,
        canNext: true,
        canPrevious: false,
        canStep: true,
        canStop: false,
      },
      started: true,
      singlePlayer: false,
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'now-playing',
      playing: {
        title: 'Song',
        isPlaying: true,
        positionMs: -1,
        durationMs: 180000,
        canNext: true,
        canPrevious: false,
        canStep: true,
        canStop: false,
      },
    },
  },
  { peerId: 'p', signal: { kind: 'now-playing' } },
  { peerId: 'p', signal: { kind: 'transport', command: 'toggle' } },
  { peerId: 'p', signal: { kind: 'transport', command: 'rewind' } },
  {
    peerId: 'p',
    signal: { kind: 'transport', command: 'nudge', deltaMs: -60000 },
  },
  {
    peerId: 'p',
    signal: { kind: 'transport', command: 'nudge', deltaMs: 60001 },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'transport',
      command: 'seek',
      positionMs: 9007199254740991,
    },
  },
  {
    peerId: 'p',
    signal: {
      kind: 'transport',
      command: 'seek',
      positionMs: 9007199254740992,
    },
  },
  {
    peerId: 'p',
    signal: { kind: 'transport', command: 'seek', positionMs: 10.5 },
  },
];

const signalTexts = (): string[] => [
  ...SIGNALS.map((signal) => JSON.stringify(signal)),
  // Written by hand: a key twice (the last value counts), and text no
  // JSON.stringify makes.
  '{"peerId":"p","signal":{"kind":"stop","forget":"no","forget":false}}',
  '{"peerId":"p","signal":{"kind":"stop"} ,}',
  ' {"peerId" : "p", "signal" : {"kind" : "stop"}} ',
  '{"peerId":"\\ud83c\\udfa7","signal":{"kind":"stop"}}',
];

const pcmOf = (channels: number, frames: number) => {
  const samples = new Float32Array(channels * frames);
  for (let at = 0; at < samples.length; at += 1) {
    samples[at] = Math.sin(at * 0.05) * 0.5 + ((at * 7919) % 13) / 1000;
  }
  return Buffer.from(samples.buffer);
};

const ADAPTERS: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
  'vEthernet (WSL)': [
    {
      address: '172.24.16.1',
      netmask: '255.255.240.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '172.24.16.1/20',
    },
  ],
  'Wi-Fi': [
    {
      address: '192.168.1.42',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '192.168.1.42/24',
    },
    {
      address: 'fe80::1',
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: 'fe80::1/64',
      scopeid: 3,
    },
  ],
  Ethernet: [
    {
      address: '10.0.0.7',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '10.0.0.7/8',
    },
    {
      address: '192.168.1.42',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '192.168.1.42/24',
    },
  ],
  'Loopback Pseudo-Interface 1': [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '127.0.0.1/8',
    },
  ],
  'Ethernet 3 (VirtualBox Host-Only Network)': [
    {
      address: '192.168.56.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '192.168.56.1/24',
    },
  ],
  'Bluetooth Network Connection': [
    {
      address: '169.254.3.3',
      netmask: '255.255.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '169.254.3.3/16',
    },
  ],
  'Public adapter': [
    {
      address: '8.8.4.4',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '8.8.4.4/24',
    },
  ],
};

export const shareWireFixture = async (): Promise<string> => {
  const lines: string[] = [];
  const add = (...more: string[]) => lines.push(...more);
  add(
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/main/shareAudio/shareWireFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    '#include <cstdint>',
    '#include <vector>',
    '',
    'namespace feq::share::fixture {',
    '',
    'struct Text { const char* value; };',
    'struct Bytes { std::vector<std::uint8_t> value; };',
    '',
  );

  add('// Secrets, and the computer each names.');
  add(
    `inline const Text kSecrets[] = {${SECRETS.map((s) => `{${cText(s)}}`).join(', ')}};`,
  );
  add(
    `inline const Text kComputerIds[] = {${SECRETS.map((s) => `{${cText(computerIdOf(s))}}`).join(', ')}};`,
  );
  add(
    `inline const Bytes kKeys[] = {${SECRETS.map((s) => `{${cBytes(keyFromSecret(s))}}`).join(', ')}};`,
  );
  add('// The session key for secret 0, challenge 1 and each peer id.');
  const challenge = Buffer.from(SECRETS[1])
    .subarray(0, 32)
    .toString('base64url');
  add(`inline const char* const kChallenge = ${cText(challenge)};`);
  add(
    `inline const Text kPeerIds[] = {${PEER_IDS.map((p) => `{${cText(p)}}`).join(', ')}};`,
  );
  add(
    `inline const Bytes kSessionKeys[] = {${PEER_IDS.map(
      (peer) =>
        `{${cBytes(deriveSessionKey(keyFromSecret(SECRETS[0]), challenge, peer))}}`,
    ).join(', ')}};`,
  );
  add('');

  const { made, decoded } = pairingCodes();
  add(
    '// Codes made: addresses (comma-joined), port, which secret, name, the code.',
  );
  add(
    'struct MadeCode { const char* addresses; int port; int secret; const char* name; const char* code; };',
  );
  add('inline const MadeCode kMadeCodes[] = {');
  MADE.forEach(([addresses, port, secret, name], at) =>
    add(
      `    {${cText(addresses.join(','))}, ${port}, ${secret}, ${cText(name)}, ${cText(made[at])}},`,
    ),
  );
  add('};');
  add(
    '// Codes read: the code, then what it reads as (JSON), or "" for refused.',
  );
  add('struct CodeCase { const char* code; const char* reads; };');
  add('inline const CodeCase kCodeCases[] = {');
  decoded.forEach((code) => {
    let reads = '';
    try {
      reads = JSON.stringify(decodePairingCode(code));
    } catch {
      reads = '';
    }
    add(`    {${cText(code)}, ${cText(reads)}},`);
  });
  add('};', '');

  add(
    '// Packets sealed under key 0 with a fixed IV: kind, IV seed, clear text, packet.',
  );
  add(
    'struct SealCase { std::uint8_t kind; int seed; const char* clear; Bytes packet; };',
  );
  add('inline const SealCase kSealCases[] = {');
  const key = keyFromSecret(SECRETS[0]);
  const sealed: [number, string][] = [
    [PACKET_SIGNAL, JSON.stringify({ peerId: 'p', signal: { kind: 'stop' } })],
    [PACKET_AUTH_CHALLENGE, JSON.stringify({ challenge })],
    [
      PACKET_AUTH_READY,
      JSON.stringify({
        challenge,
        deviceName: 'Den',
        peerId: PEER_IDS[1],
        computerId: computerIdOf(SECRETS[1]),
        fresh: true,
      }),
    ],
    [PACKET_AUTH_ACCEPTED, JSON.stringify({ challenge, peerId: PEER_IDS[2] })],
    [PACKET_AUDIO, ''],
  ];
  sealed.forEach(([kind, clear], seed) => {
    const packet = sealPacket(
      kind,
      Buffer.from(clear, 'utf8'),
      key,
      ivOf(seed),
    );
    add(`    {${kind}, ${seed}, ${cText(clear)}, {${cBytes(packet)}}},`);
  });
  add('};', '');

  add(
    '// Control messages: the JSON text, and whether the TypeScript takes it.',
  );
  add('struct SignalCase { const char* text; bool taken; };');
  add('inline const SignalCase kSignalCases[] = {');
  signalTexts().forEach((text) => {
    let taken = false;
    try {
      taken = isLanRemoteAudioSignal(JSON.parse(text));
    } catch {
      taken = false;
    }
    add(`    {${cText(text)}, ${taken}},`);
  });
  add('};', '');

  add(
    '// Audio: 2 channels of 480 frames, sequence 77 at 48 kHz, raw and squeezed.',
  );
  const chunk = normalizeAudioChunk({
    peerId: 'p',
    sequence: 77,
    sampleRate: 48000,
    channels: 2,
    frames: 480,
    pcm: pcmOf(2, 480),
  });
  add(`inline const Bytes kAudioPcm = {${cBytes(chunk.pcm)}};`);
  add(`inline const Bytes kAudioRaw = {${cBytes(encodeAudioRaw(chunk))}};`);
  add(
    `inline const Bytes kAudioSqueezed = {${cBytes(await encodeAudioAsync(chunk))}};`,
  );
  add('');

  add(
    '// Discovery for secret 0: the query, an announcement, and datagrams read.',
  );
  add(
    `inline const Bytes kQuery = {${cBytes(encodeDiscoveryQuery(SECRETS[0]))}};`,
  );
  const announcement = encodeDiscoveryAnnouncement(SECRETS[0], 51234, 'Den ñ');
  add(`inline const Bytes kAnnouncement = {${cBytes(announcement)}};`);
  add(
    'struct DatagramCase { const char* text; bool query; const char* announces; };',
  );
  add('inline const DatagramCase kDatagramCases[] = {');
  const tampered = JSON.parse(announcement.toString('utf8')) as Record<
    string,
    unknown
  >;
  const datagrams = [
    encodeDiscoveryQuery(SECRETS[0]).toString('utf8'),
    encodeDiscoveryQuery(SECRETS[1]).toString('utf8'),
    announcement.toString('utf8'),
    JSON.stringify({ ...tampered, port: 51235 }),
    JSON.stringify({ ...tampered, deviceName: 'Other' }),
    JSON.stringify({ ...tampered, id: `${String(tampered.id)}=` }),
    JSON.stringify({ ...tampered, protocol: 'FLUIDEQ-LAN-1' }),
    'not json',
    '[]',
  ];
  datagrams.forEach((text) => {
    const data = Buffer.from(text, 'utf8');
    const read = decodeDiscoveryAnnouncement(data, SECRETS[0]);
    add(
      `    {${cText(text)}, ${isDiscoveryQuery(data, SECRETS[0])}, ${cText(
        read ? `${read.port}\n${read.deviceName}` : '',
      )}},`,
    );
  });
  add('};', '');

  add(
    '// Adapters: name, address, netmask, internal; what is chosen; where asking goes.',
  );
  add(
    'struct AdapterRow { const char* name; const char* address; const char* netmask; bool internal; };',
  );
  add('inline const AdapterRow kAdapters[] = {');
  Object.entries(ADAPTERS).forEach(([name, entries]) =>
    (entries ?? [])
      .filter((entry) => entry.family === 'IPv4')
      .forEach((entry) =>
        add(
          `    {${cText(name)}, ${cText(entry.address)}, ${cText(entry.netmask)}, ${entry.internal}},`,
        ),
      ),
  );
  add('};');
  const chosen = lanInterfaces(ADAPTERS);
  add(
    `inline const Text kChosen[] = {${chosen.map((e) => `{${cText(`${e.address} ${e.broadcast}`)}}`).join(', ')}};`,
  );
  add(
    `inline const Text kTargets[] = {${discoveryTargets(ADAPTERS)
      .map((t) => `{${cText(t)}}`)
      .join(', ')}};`,
  );
  add('', '}  // namespace feq::share::fixture', '');
  return lines.join('\n');
};
