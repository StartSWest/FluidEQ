import type { IScenePack } from 'common/scenePacks';

/** Only code, uniform declarations and artwork belong to the GPU program. */
export const sameSceneProgramInputs = (
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
  previous.artwork?.data === next.artwork?.data;
