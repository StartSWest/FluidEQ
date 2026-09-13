import type { TStudioPictures } from 'main/ipc/studioPictures';

/** A settings save changes the project revision, but not its picture previews. */
export default function sameStudioPictures(
  previous: TStudioPictures | undefined,
  next: TStudioPictures,
): boolean {
  if (!previous || previous.kind !== next.kind) {
    return false;
  }
  if (previous.kind !== 'atlas' || next.kind !== 'atlas') {
    return true;
  }
  const { image: before, ...previousLayout } = previous;
  const { image: after, ...nextLayout } = next;
  if (JSON.stringify(previousLayout) !== JSON.stringify(nextLayout)) {
    return false;
  }
  if (before === after) {
    return true;
  }
  if (!before || !after || before.length !== after.length) {
    return false;
  }
  return before.every((byte, index) => byte === after[index]);
}
