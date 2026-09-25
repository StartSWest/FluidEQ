import type { IScenePack } from 'common/scenePacks';
import type { ISceneWorld } from 'common/sceneWorld';

/**
 * Worlds by what they say, not by which object holds them: a pack read again
 * from the same bytes is a new object with the same world. Kept per object,
 * because a world with models carries megabytes to write out.
 */
const worldKeys = new WeakMap<ISceneWorld, string>();
const worldKey = (world: ISceneWorld | undefined): string => {
  if (!world) {
    return '';
  }
  const known = worldKeys.get(world);
  if (known !== undefined) {
    return known;
  }
  const key = JSON.stringify(world);
  worldKeys.set(world, key);
  return key;
};

const fingerprints = new WeakMap<ISceneWorld, string>();

/**
 * A world, short: for keys that are held for the session (the size a scene
 * has proved it can draw at, what a still refused), where the whole world's
 * text, models and all, would be megabytes kept to tell two worlds apart.
 */
export const worldFingerprint = (world: ISceneWorld | undefined): string => {
  if (!world) {
    return '';
  }
  const known = fingerprints.get(world);
  if (known !== undefined) {
    return known;
  }
  const text = worldKey(world);
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = (a * 33 + code) % 4294967296;
    b = (b * 31 + code) % 4294967291;
  }
  const print = `world:${text.length}:${a.toString(36)}${b.toString(36)}`;
  fingerprints.set(world, print);
  return print;
};

/** Only code, uniform declarations, artwork and a world belong to the GPU program. */
const sameSceneProgramInputs = (
  previous: IScenePack | null,
  next: IScenePack,
): boolean =>
  previous !== null &&
  previous.id === next.id &&
  previous.contract === next.contract &&
  previous.source === next.source &&
  previous.params.length === next.params.length &&
  previous.params.every((param, index) => param.id === next.params[index].id) &&
  previous.artwork?.mime === next.artwork?.mime &&
  previous.artwork?.width === next.artwork?.width &&
  previous.artwork?.height === next.artwork?.height &&
  previous.artwork?.data === next.artwork?.data &&
  (previous.world === next.world ||
    worldKey(previous.world) === worldKey(next.world));

export default sameSceneProgramInputs;
