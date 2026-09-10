/**
 * The `sub` claim out of an access token, without verifying it.
 *
 * There is nothing to verify against here and no trust decision being made:
 * the server checks the same token on every request it receives. Reading the
 * id locally only saves a round trip to ask the server who it already knows we
 * are, and lets a request name its own row without a lookup.
 */
const jwtSubject = (token: string): string | undefined => {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return undefined;
  }
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    );
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }
    const { sub } = payload as { sub?: unknown };
    return typeof sub === 'string' && sub.length > 0 && sub.length <= 64
      ? sub
      : undefined;
  } catch {
    return undefined;
  }
};

export default jwtSubject;
