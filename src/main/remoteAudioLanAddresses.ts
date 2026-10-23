/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import os from 'os';

/**
 * Where this computer can be reached on the local network, and where its
 * "who is there?" goes.
 *
 * Every private IPv4 address used to get a code of its own. A Linux machine
 * running Docker has one bridge per compose project — this server had
 * seventeen addresses, sixteen of them bridges no other computer can reach —
 * so the page showed seventeen codes and nothing said which one to use. A
 * Windows machine with WSL or Hyper-V has the same problem with its
 * `vEthernet` adapters. One code now carries the addresses worth trying,
 * virtual adapters left out, and the computer that pastes it tries them all at
 * once (`remoteAudioLanJoin.ts`).
 */

const CANONICAL_IPV4 = /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;

/** The most addresses one code carries: a code is pasted, not read. */
export const MAX_CODE_ADDRESSES = 6;

export const isPrivateIpv4 = (address: string): boolean => {
  if (!CANONICAL_IPV4.test(address)) {
    return false;
  }
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
};

/**
 * Adapters that exist only inside this computer: container and VM bridges,
 * VPN tunnels. Another computer on the LAN never reaches them, and a
 * container bridge on the OTHER computer can have the very same address — a
 * code carrying 172.18.0.1 sent the other computer knocking on its own
 * Docker network.
 */
const VIRTUAL_ADAPTER =
  /^(docker|br-|veth|virbr|vnet|vmnet|vboxnet|lxc|lxd|cni|flannel|cali|podman|tun|tap|wg|zt|tailscale|utun|bridge\d)|vethernet|virtualbox|vmware|hyper-v|wsl|loopback|bluetooth|npcap/i;

export const isVirtualAdapter = (name: string): boolean =>
  VIRTUAL_ADAPTER.test(name);

export interface ILanInterface {
  address: string;
  /** The subnet's own broadcast address, for "who is there?". */
  broadcast: string;
}

const toNumber = (address: string) =>
  address
    .split('.')
    .map(Number)
    .reduce((total, octet) => total * 256 + octet, 0);

const toAddress = (value: number) =>
  [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');

export const broadcastOf = (address: string, netmask: string): string => {
  const host = toNumber(address);
  const mask = toNumber(netmask);
  // Bitwise operators work on signed 32 bits; this stays in plain numbers.
  return toAddress(host - (host % (2 ** 32 - mask)) + (2 ** 32 - mask - 1));
};

/** Home networks first: 192.168, then 10, then 172.16/12, then link-local. */
const rank = (address: string) => {
  if (address.startsWith('192.168.')) {
    return 0;
  }
  if (address.startsWith('10.')) {
    return 1;
  }
  if (address.startsWith('172.')) {
    return 2;
  }
  return 3;
};

/**
 * This computer's LAN interfaces, best first. Virtual adapters are left out
 * unless nothing else is left, so a machine whose only network a name here
 * happens to match is still reachable.
 */
export const lanInterfaces = (
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): ILanInterface[] => {
  const all = Object.entries(interfaces).flatMap(([name, entries]) =>
    (entries ?? [])
      .filter(
        (entry) =>
          entry.family === 'IPv4' &&
          !entry.internal &&
          isPrivateIpv4(entry.address),
      )
      .map((entry) => ({
        name,
        address: entry.address,
        broadcast: broadcastOf(entry.address, entry.netmask),
      })),
  );
  const real = all.filter((entry) => !isVirtualAdapter(entry.name));
  const chosen = real.length > 0 ? real : all;
  const seen = new Set<string>();
  return chosen
    .filter((entry) => {
      if (seen.has(entry.address)) {
        return false;
      }
      seen.add(entry.address);
      return true;
    })
    .sort(
      (left, right) =>
        rank(left.address) - rank(right.address) ||
        left.address.localeCompare(right.address),
    )
    .map(({ address, broadcast }) => ({ address, broadcast }));
};

export const lanAddresses = (): string[] =>
  lanInterfaces().map((entry) => entry.address);

/**
 * Where a "who is there?" goes: the all-ones broadcast, which leaves through
 * the default route only, and each LAN's own broadcast, so a computer on the
 * second network card is asked too.
 */
export const discoveryTargets = (): string[] => [
  ...new Set(['255.255.255.255', ...lanInterfaces().map((e) => e.broadcast)]),
];
