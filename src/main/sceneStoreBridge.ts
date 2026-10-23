import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IKeptSceneVersions,
  ISceneStore,
  TBuyOutcome,
  TCheckoutOutcome,
  TSceneStoreOutcome,
  TStarterOutcome,
} from '../common/sceneStore';

// The scene store (premium 0055 and 0057): credits, owned scenes, a buy, a
// pack paid for in the browser.
export const sceneStoreBridge = {
  getSceneStore: (): Promise<TSceneStoreOutcome> =>
    ipcRenderer.invoke('scene-store-get'),
  claimStarterCredits: (): Promise<TStarterOutcome> =>
    ipcRenderer.invoke('scene-store-claim'),
  buyScene: (authorId: string, sceneId: string): Promise<TBuyOutcome> =>
    ipcRenderer.invoke('scene-store-buy', authorId, sceneId),
  checkoutCreditPack: (
    packId: string,
    locale: string,
  ): Promise<TCheckoutOutcome> =>
    ipcRenderer.invoke('scene-store-checkout', packId, locale),
  // How a pack's payment ended, told when its return page opens FluidEQ
  // (`appLinks.ts`).
  onCheckoutReturned: (listener: (ended: 'paid' | 'cancelled') => void) => {
    const handler = (_event: IpcRendererEvent, ended: unknown) => {
      if (ended === 'paid' || ended === 'cancelled') {
        listener(ended);
      }
    };
    ipcRenderer.on('scene-store-checkout-returned', handler);
    return () => {
      ipcRenderer.removeListener('scene-store-checkout-returned', handler);
    };
  },
  // The admin's: one of FluidEQ's scenes free for every account, or paid.
  setOfficialSceneFree: (
    sceneId: string,
    free: boolean,
  ): Promise<TSceneStoreOutcome> =>
    ipcRenderer.invoke('scene-store-set-free', sceneId, free),
  // The earlier versions this computer kept of an owned scene, and going
  // back to one (`null` is the newest again).
  keptSceneVersions: (
    authorId: string,
    sceneId: string,
  ): Promise<IKeptSceneVersions> =>
    ipcRenderer.invoke('scene-versions-kept', authorId, sceneId),
  playSceneVersion: (
    authorId: string,
    sceneId: string,
    version: number | null,
  ): Promise<boolean> =>
    ipcRenderer.invoke('scene-versions-play', authorId, sceneId, version),
  onSceneStoreChanged: (
    listener: (store: ISceneStore | null) => void,
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, store: ISceneStore | null) =>
      listener(store);
    ipcRenderer.on('scene-store-changed', handler);
    return () => {
      ipcRenderer.removeListener('scene-store-changed', handler);
    };
  },
};
