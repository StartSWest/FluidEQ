/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import crypto from 'crypto';

export const REMOTE_AUDIO_DISCOVERY_PORT = 49_372;
const PROTOCOL = 'FLUIDEQ-LAN-2';
const ID_CONTEXT = 'FluidEQ LAN listener discovery';
const MAX_DISCOVERY_BYTES = 1_024;

interface IDiscoveryQuery {
  id: string;
  kind: 'find-listener';
  protocol: typeof PROTOCOL;
}

export interface IDiscoveryAnnouncement {
  deviceName: string;
  id: string;
  kind: 'listener-ready';
  mac: string;
  port: number;
  protocol: typeof PROTOCOL;
}

const discoveryId = (secret: string): string =>
  crypto.createHmac('sha256', secret).update(ID_CONTEXT).digest('base64url');

const announcementMac = (
  secret: string,
  port: number,
  deviceName: string,
): string =>
  crypto
    .createHmac('sha256', secret)
    .update(`${PROTOCOL}\0${port}\0${deviceName}`, 'utf8')
    .digest('base64url');

const authenticatedEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'base64url');
  const rightBytes = Buffer.from(right, 'base64url');
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    crypto.timingSafeEqual(leftBytes, rightBytes)
  );
};

const parseMessage = (data: Buffer): Record<string, unknown> | undefined => {
  if (data.byteLength === 0 || data.byteLength > MAX_DISCOVERY_BYTES) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(data.toString('utf8'));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

export const encodeDiscoveryQuery = (secret: string): Buffer => {
  const query: IDiscoveryQuery = {
    id: discoveryId(secret),
    kind: 'find-listener',
    protocol: PROTOCOL,
  };
  return Buffer.from(JSON.stringify(query), 'utf8');
};

export const isDiscoveryQuery = (data: Buffer, secret: string): boolean => {
  const query = parseMessage(data);
  return (
    query?.protocol === PROTOCOL &&
    query.kind === 'find-listener' &&
    typeof query.id === 'string' &&
    authenticatedEqual(query.id, discoveryId(secret))
  );
};

export const encodeDiscoveryAnnouncement = (
  secret: string,
  port: number,
  deviceName: string,
): Buffer => {
  const announcement: IDiscoveryAnnouncement = {
    deviceName,
    id: discoveryId(secret),
    kind: 'listener-ready',
    mac: announcementMac(secret, port, deviceName),
    port,
    protocol: PROTOCOL,
  };
  return Buffer.from(JSON.stringify(announcement), 'utf8');
};

export const decodeDiscoveryAnnouncement = (
  data: Buffer,
  secret: string,
): IDiscoveryAnnouncement | undefined => {
  const announcement = parseMessage(data);
  if (
    announcement?.protocol !== PROTOCOL ||
    announcement.kind !== 'listener-ready' ||
    typeof announcement.id !== 'string' ||
    !authenticatedEqual(announcement.id, discoveryId(secret)) ||
    typeof announcement.deviceName !== 'string' ||
    announcement.deviceName.trim().length === 0 ||
    announcement.deviceName.length > 128 ||
    !Number.isInteger(announcement.port) ||
    (announcement.port as number) < 1 ||
    (announcement.port as number) > 65_535 ||
    typeof announcement.mac !== 'string' ||
    !authenticatedEqual(
      announcement.mac,
      announcementMac(
        secret,
        announcement.port as number,
        announcement.deviceName,
      ),
    )
  ) {
    return undefined;
  }
  return announcement as unknown as IDiscoveryAnnouncement;
};
