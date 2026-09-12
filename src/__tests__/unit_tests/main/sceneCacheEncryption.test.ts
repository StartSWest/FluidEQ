/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { safeStorage } from 'electron';
import { generateKeyPairSync, sign } from 'crypto';
import {
  createMemberSceneStore,
  memberSceneFingerprint,
} from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { writeSceneCache } from '../../../main/sceneCacheFile';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  memberPack,
  memberPayload,
  signedEnvelope,
  ME,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

let root: string;
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting('cache-test', publicKey);
const officialEnvelope = () => {
  const bytes = Buffer.from(JSON.stringify(memberPack()));
  return {
    schema: 1 as const,
    algorithm: 'ed25519' as const,
    keyId: 'cache-test',
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
};
const ownFile = () =>
  path.join(root, 'member-scenes', 'own', ME, 'neon-city.json');
const importedFile = () =>
  path.join(root, 'member-scenes', 'imported', SOMEONE, 'neon-city.json');
const officialFile = () =>
  path.join(root, 'scene-packs', 'packs', 'neon-city.pack.enc');
const legacyOfficialFile = () =>
  path.join(root, 'scene-packs', 'packs', 'neon-city.pack.json');
const seed = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-cipher-'));
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

it('encrypts official, imported and own graph copies and reloads them offline after restart', () => {
  const member = createMemberSceneStore({ userDataDir: root });
  const official = createScenePackStore({ userDataDir: root });
  const envelope = signedEnvelope(memberPayload());
  const officialSigned = officialEnvelope();
  member.save(ME, memberPack());
  member.saveImported(envelope);
  official.adopt(
    [{ id: 'neon-city', version: 1, envelope: officialSigned }],
    true,
  );
  [ownFile(), importedFile(), officialFile()].forEach((file) => {
    const stored = fs.readFileSync(file, 'utf8');
    expect(stored).not.toContain('sceneColour');
    expect(stored).not.toContain(envelope.payload);
    expect(stored).not.toContain(officialSigned.payload);
    expect(JSON.parse(stored)).toHaveProperty('encrypted');
  });
  expect(
    createMemberSceneStore({ userDataDir: root }).load(ME, 'neon-city'),
  ).toEqual(memberPack());
  expect(
    createMemberSceneStore({ userDataDir: root }).load(SOMEONE, 'neon-city'),
  ).toEqual(memberPack());
  expect(createScenePackStore({ userDataDir: root }).load('neon-city')).toEqual(
    memberPack(),
  );
});

it('migrates all three existing cache types without changing scene identity or losing withdrawn copies', () => {
  seed(ownFile(), { schema: 1, authorId: ME, pack: memberPack() });
  seed(importedFile(), signedEnvelope(memberPayload()));
  seed(legacyOfficialFile(), officialEnvelope());
  expect(createMemberSceneStore({ userDataDir: root }).list()).toHaveLength(2);
  expect(createScenePackStore({ userDataDir: root }).list()).toHaveLength(1);
  expect(fs.existsSync(legacyOfficialFile())).toBe(false);
  [ownFile(), importedFile(), officialFile()].forEach((file) => {
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toHaveProperty(
      'encrypted',
    );
    expect(fs.readdirSync(path.dirname(file))).toEqual([path.basename(file)]);
  });
});

it('refuses new saves when secure storage is unavailable and never writes plaintext as a fallback', () => {
  jest.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(false);
  const member = createMemberSceneStore({ userDataDir: root });
  expect(() => member.save(ME, memberPack())).toThrow();
  expect(() => member.saveImported(signedEnvelope(memberPayload()))).toThrow();
  expect(() =>
    createScenePackStore({ userDataDir: root }).adopt(
      [{ id: 'neon-city', version: 1, envelope: officialEnvelope() }],
      true,
    ),
  ).toThrow();
  expect(fs.existsSync(ownFile())).toBe(false);
  expect(fs.existsSync(importedFile())).toBe(false);
  expect(fs.existsSync(officialFile())).toBe(false);
});

it('keeps an inaccessible encrypted copy intact so unlocking the OS key store restores offline playback', () => {
  createMemberSceneStore({ userDataDir: root }).saveImported(
    signedEnvelope(memberPayload()),
  );
  const saved = fs.readFileSync(importedFile());
  const locked = jest
    .spyOn(safeStorage, 'decryptString')
    .mockImplementation(() => {
      throw new Error('locked');
    });
  expect(
    createMemberSceneStore({ userDataDir: root }).load(SOMEONE, 'neon-city'),
  ).toBeUndefined();
  expect(fs.readFileSync(importedFile())).toEqual(saved);
  locked.mockRestore();
  expect(
    createMemberSceneStore({ userDataDir: root }).load(SOMEONE, 'neon-city'),
  ).toEqual(memberPack());
});

it('preserves the legacy copy if migration cannot encrypt, then retries when encryption is available', () => {
  seed(importedFile(), signedEnvelope(memberPayload()));
  const saved = fs.readFileSync(importedFile());
  const locked = jest
    .spyOn(safeStorage, 'encryptString')
    .mockImplementation(() => {
      throw new Error('locked');
    });
  expect(
    createMemberSceneStore({ userDataDir: root }).load(SOMEONE, 'neon-city'),
  ).toBeUndefined();
  expect(fs.readFileSync(importedFile())).toEqual(saved);
  locked.mockRestore();
  expect(
    createMemberSceneStore({ userDataDir: root }).load(SOMEONE, 'neon-city'),
  ).toEqual(memberPack());
  expect(JSON.parse(fs.readFileSync(importedFile(), 'utf8'))).toHaveProperty(
    'encrypted',
  );
});

it('cannot reinterpret an encrypted import as an own scene by copying it to another cache path', () => {
  const member = createMemberSceneStore({ userDataDir: root });
  member.saveImported(signedEnvelope(memberPayload()));
  fs.mkdirSync(path.dirname(ownFile()), { recursive: true });
  fs.copyFileSync(importedFile(), ownFile());
  expect(member.load(ME, 'neon-city')).toBeUndefined();
  expect(member.load(SOMEONE, 'neon-city')).toEqual(memberPack());
});

it('rejects altered ciphertext without deleting the original file', () => {
  const official = createScenePackStore({ userDataDir: root });
  official.adopt(
    [{ id: 'neon-city', version: 1, envelope: officialEnvelope() }],
    true,
  );
  const stored = JSON.parse(fs.readFileSync(officialFile(), 'utf8'));
  const bytes = Buffer.from(stored.encrypted, 'base64');
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] + 1) % 256;
  stored.encrypted = bytes.toString('base64');
  seed(officialFile(), stored);
  expect(official.load('neon-city')).toBeUndefined();
  expect(fs.existsSync(officialFile())).toBe(true);
});

it('does not replace the previous offline copy or leave a temporary file when a write fails', () => {
  const member = createMemberSceneStore({ userDataDir: root });
  member.saveImported(signedEnvelope(memberPayload()));
  const before = fs.readFileSync(importedFile());
  const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
    throw new Error('disk full');
  });
  expect(() =>
    member.saveImported(
      signedEnvelope(memberPayload({ pack: memberPack({ version: 2 }) })),
    ),
  ).toThrow();
  rename.mockRestore();
  expect(fs.readFileSync(importedFile())).toEqual(before);
  expect(fs.readdirSync(path.dirname(importedFile()))).toEqual([
    'neon-city.json',
  ]);
  expect(member.load(SOMEONE, 'neon-city')?.version).toBe(1);
});

it('checks encryption round trips before replacing an existing copy', () => {
  const member = createMemberSceneStore({ userDataDir: root });
  member.saveImported(signedEnvelope(memberPayload()));
  const before = fs.readFileSync(importedFile());
  jest.spyOn(safeStorage, 'decryptString').mockReturnValue('wrong bytes');
  expect(() => member.saveImported(signedEnvelope(memberPayload()))).toThrow();
  expect(fs.readFileSync(importedFile())).toEqual(before);
});

it('encrypts blocked legacy files during listing without offering them for playback', () => {
  seed(importedFile(), signedEnvelope(memberPayload()));
  const member = createMemberSceneStore({ userDataDir: root });
  member.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
  expect(member.list()).toEqual([]);
  expect(member.load(SOMEONE, 'neon-city')).toBeUndefined();
  expect(JSON.parse(fs.readFileSync(importedFile(), 'utf8'))).toHaveProperty(
    'encrypted',
  );
  member.setBlocked([]);
  expect(member.load(SOMEONE, 'neon-city')).toEqual(memberPack());
});

it('refuses the Linux plaintext key-store fallback', () => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', {
    value: 'linux',
    configurable: true,
  });
  jest
    .spyOn(safeStorage, 'getSelectedStorageBackend')
    .mockReturnValue('basic_text');
  try {
    expect(() =>
      createMemberSceneStore({ userDataDir: root }).save(ME, memberPack()),
    ).toThrow();
    expect(fs.existsSync(ownFile())).toBe(false);
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
});

it('moves the first encrypted format out of the namespace old readers delete', () => {
  writeSceneCache(
    legacyOfficialFile(),
    'official/neon-city',
    officialEnvelope(),
  );
  const store = createScenePackStore({ userDataDir: root });
  expect(store.load('neon-city')).toEqual(memberPack());
  expect(fs.existsSync(legacyOfficialFile())).toBe(false);
  expect(fs.existsSync(officialFile())).toBe(true);
  // The old reader enumerates only *.pack.json, so it cannot see ciphertext.
  expect(
    fs
      .readdirSync(path.dirname(officialFile()))
      .filter((name) => name.endsWith('.pack.json')),
  ).toEqual([]);
  expect(createScenePackStore({ userDataDir: root }).load('neon-city')).toEqual(
    memberPack(),
  );
});

it('preserves a legacy official copy when relocation fails and retries offline', () => {
  seed(legacyOfficialFile(), officialEnvelope());
  const before = fs.readFileSync(legacyOfficialFile());
  const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
    throw new Error('disk full');
  });
  expect(
    createScenePackStore({ userDataDir: root }).load('neon-city'),
  ).toBeUndefined();
  expect(fs.readFileSync(legacyOfficialFile())).toEqual(before);
  expect(fs.existsSync(officialFile())).toBe(false);
  rename.mockRestore();
  expect(createScenePackStore({ userDataDir: root }).load('neon-city')).toEqual(
    memberPack(),
  );
  expect(fs.existsSync(legacyOfficialFile())).toBe(false);
});

it('never falls back to a stale legacy copy when protected ciphertext is locked', () => {
  const store = createScenePackStore({ userDataDir: root });
  store.adopt(
    [{ id: 'neon-city', version: 1, envelope: officialEnvelope() }],
    true,
  );
  seed(legacyOfficialFile(), officialEnvelope());
  jest.spyOn(safeStorage, 'decryptString').mockImplementation(() => {
    throw new Error('locked');
  });
  expect(store.load('neon-city')).toBeUndefined();
  expect(fs.existsSync(officialFile())).toBe(true);
});

it('removes both names so a legacy copy cannot resurrect an explicitly removed scene', () => {
  const store = createScenePackStore({ userDataDir: root });
  store.adopt(
    [{ id: 'neon-city', version: 1, envelope: officialEnvelope() }],
    true,
  );
  seed(legacyOfficialFile(), officialEnvelope());
  expect(store.list()).toHaveLength(1);
  expect(store.remove('neon-city')).toBe(true);
  expect(fs.existsSync(officialFile())).toBe(false);
  expect(fs.existsSync(legacyOfficialFile())).toBe(false);
  expect(createScenePackStore({ userDataDir: root }).list()).toEqual([]);
});
