import type { IScenePack } from 'common/scenePacks';
import {
  canonicalPreviewPayload,
  type IScenePreviewUpload,
} from 'common/scenePreviewMedia';
import type { IPublishPreview } from './usePublishVideo';

export interface IPreparedPublishPreview extends IPublishPreview {
  pack: IScenePack;
  sourceVersion: number;
}

export default async function preparePublishPreview(
  preview: IPreparedPublishPreview,
  operationId: string,
): Promise<IScenePreviewUpload> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalPreviewPayload(preview.pack)),
  );
  return {
    bytes: new Uint8Array(await preview.blob.arrayBuffer()),
    operationId,
    sceneId: preview.pack.id,
    sourceVersion: preview.sourceVersion,
    version: preview.pack.version,
    packSha256: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
  };
}
