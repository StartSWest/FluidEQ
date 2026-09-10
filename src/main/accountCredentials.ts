import type { IAccountIdentity } from './account/authClient';
import {
  createEncryptedJsonStore,
  type IEncryptedJsonStore,
} from './encryptedJsonStore';

/**
 * The signed-in session, kept with the operating system's credential cipher.
 *
 * Only the refresh token is kept. Access tokens last an hour and are minted
 * from this one on demand, so writing them down would mean storing something
 * that is stale on almost every launch — and a second copy of a credential is a
 * second place it can leak from.
 */

const FILE_NAME = 'account.json';

export interface IAccountRecord {
  refreshToken: string;
  identity: IAccountIdentity;
}

export type IAccountCredentialStore = IEncryptedJsonStore<IAccountRecord>;

const isIdentity = (value: unknown): value is IAccountIdentity => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<IAccountIdentity>;
  const optionalString = (field: unknown): boolean =>
    field === undefined || (typeof field === 'string' && field.length <= 4_096);
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= 256 &&
    optionalString(candidate.email) &&
    optionalString(candidate.name)
  );
};

const isAccountRecord = (value: unknown): value is IAccountRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<IAccountRecord>;
  return (
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    candidate.refreshToken.length <= 4_096 &&
    isIdentity(candidate.identity)
  );
};

export const createAccountCredentialStore = (
  userDataDir: string,
): IAccountCredentialStore =>
  createEncryptedJsonStore(userDataDir, FILE_NAME, isAccountRecord);
