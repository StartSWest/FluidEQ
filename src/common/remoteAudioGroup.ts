/* FluidEQ — GPL-3.0-or-later */

/** Public LAN coordinates. Pairing codes and permanent secrets never travel
 * in introductions. A linked computer can introduce its other computers. */
export interface IAudioGroupEndpoint {
  computerId: string;
  deviceName: string;
  addresses: string[];
  port: number;
}

export interface IAudioGroupHello {
  version: 1;
  endpoint: IAudioGroupEndpoint;
  known: string[];
}

/** A credential scoped to precisely one pair, introduced over an already
 * authenticated link. The issuer is supplied by the receiving LAN layer. */
export interface IAudioGroupLink extends IAudioGroupEndpoint {
  secret: string;
  issuer: string;
  /** Locally assigned provenance, never trusted from the wire. */
  introduced?: boolean;
}

export const MAX_AUDIO_GROUP_COMPUTERS = 32;
export const MAX_AUDIO_REVOKED_COMPUTERS = 64;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isAudioComputerId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);

export const isAudioGroupEndpoint = (
  value: unknown,
): value is IAudioGroupEndpoint =>
  isRecord(value) &&
  isAudioComputerId(value.computerId) &&
  typeof value.deviceName === 'string' &&
  value.deviceName.trim().length > 0 &&
  value.deviceName.length <= 128 &&
  Number.isInteger(value.port) &&
  Number(value.port) > 0 &&
  Number(value.port) <= 65535 &&
  Array.isArray(value.addresses) &&
  value.addresses.length <= 8 &&
  value.addresses.every(
    (address: unknown) => typeof address === 'string' && address.length <= 15,
  );

export const isAudioGroupHello = (value: unknown): value is IAudioGroupHello =>
  isRecord(value) &&
  value.version === 1 &&
  isAudioGroupEndpoint(value.endpoint) &&
  Array.isArray(value.known) &&
  value.known.length <= MAX_AUDIO_GROUP_COMPUTERS &&
  value.known.every(isAudioComputerId);

export const isAudioGroupLink = (value: unknown): value is IAudioGroupLink =>
  isAudioGroupEndpoint(value) &&
  isRecord(value) &&
  isAudioComputerId(value.issuer) &&
  typeof value.secret === 'string' &&
  /^[A-Za-z0-9_-]{43}$/.test(value.secret) &&
  (value.introduced === undefined || typeof value.introduced === 'boolean');

/** Code-point order is identical on all OSes, including duplicate names.
 * Locale collation depends on the OS and cannot define a shared order. */
export const compareAudioComputers = (
  a: { name: string; computerId: string },
  b: { name: string; computerId: string },
): number => {
  const first = a.name.normalize('NFKC').toLowerCase();
  const second = b.name.normalize('NFKC').toLowerCase();
  if (first !== second) {
    return first < second ? -1 : 1;
  }
  return a.computerId < b.computerId ? -1 : Number(a.computerId > b.computerId);
};
