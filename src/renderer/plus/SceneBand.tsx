/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';
import { useTranslation } from '../utils/I18nContext';
import ScenePreview from './ScenePreview';
/**
 * The starter scene at rest, as a picture, at the band's own proportion.
 *
 * What the band showed while its scene was being fetched, compiled and warmed
 * up was the aurora underneath — a coloured blur, then a night sky, which
 * reads as the picture having changed its mind. This is the same scene's
 * first frame, so the band is that scene from the moment it appears and the
 * drawing simply starts moving. Captured from the scene itself in the
 * component harness; if the scene is ever retuned, capture it again.
 */
import houseSceneStill from '../../../assets/plus/lantern-night-band.jpg';
import '../styles/SceneBand.scss';

/**
 * The scene the app plays about itself: the Studio's starter, the same one
 * the Dynamic lighting page uses.
 *
 * It ships inside the app, so it needs no network, no gallery and no
 * membership — a panel that has to appear the instant somebody opens it, or
 * the instant a payment lands, cannot wait for a scene to be downloaded.
 * Asked for once while the band is up; a window whose bridge predates the
 * demo, or a machine that cannot draw a scene at all, keeps the aurora.
 */
export const useHouseScene = (wanted: boolean) => {
  const [pack, setPack] = useState<IScenePack>();

  useEffect(() => {
    if (!wanted) {
      // Let go of it, not merely stop asking: a membership that ends while
      // the band is up (the simulator's "pretend none", a real lapse) has
      // to take the scene with it, and a pack kept from before played on.
      setPack(undefined);
      return undefined;
    }
    if (!isSceneRenderingAvailable()) {
      return undefined;
    }
    let cancelled = false;
    const asked = window.electron?.ipcRenderer?.lightingDemoScene?.();
    if (!asked) {
      return undefined;
    }
    asked
      .then((scene) => {
        if (!cancelled && scene) {
          setPack(scene);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return pack;
};

interface ISceneBandProps {
  /**
   * Whether a scene may play in it, rather than the aurora alone.
   *
   * Off by default, and on in two places: the welcome to Plus, and the
   * banner of a member's own profile in the Account panel (Ivan,
   * 2026-09-15). A scene is what Plus is, so it belongs to the moment
   * somebody joins and to the panel that says they have — never to an
   * account without it, where a band drawing on the graphics card would be
   * a cost for decoration.
   */
  playsScene?: boolean;
  /** Extra classes: the caller's own name for its band, and any modifier. */
  className?: string;
  /** Custom properties the band reads: its heights, and its leading light. */
  style?: CSSProperties;
  /** Laid over the scene, above the scrim. */
  children: ReactNode;
}

/**
 * A band with a scene playing in it and words over it.
 *
 * The top of the welcome and the top of the account panel are the same thing
 * — this app introducing itself — and were written twice before this. The
 * aurora underneath is what a machine that cannot draw a scene is left with,
 * and what covers the moment before the first frame: a band that began as a
 * black rectangle and filled in afterwards read as a picture that had failed
 * to load.
 *
 * The scene stops itself when the band leaves the screen, because
 * `ScenePreview` holds the runner and the live capture only while it is
 * mounted.
 */
export default function SceneBand({
  playsScene = false,
  className = '',
  style,
  children,
}: ISceneBandProps) {
  const { locale } = useTranslation();
  const [trouble, setTrouble] = useState(false);
  const pack = useHouseScene(playsScene && !trouble);
  const playing = pack !== undefined && !trouble;
  // A scene is coming or already here. It is what decides the band's height,
  // not `playing`: the still is up from the first frame, and growing the
  // band a second later — once the scene had been fetched and compiled —
  // moved everything under it down the panel while somebody was reading it.
  const scened = playsScene && !trouble;

  return (
    <div
      className={`scene-band${scened ? ' is-scene' : ''}${
        playing ? ' is-playing' : ''
      } ${className}`.trim()}
      style={style}
    >
      {/* Under the scene and over the aurora: the scene's own first frame,
          held until the drawing paints over it — and left there for good on
          a machine whose scene never starts, which is a still picture of the
          right thing rather than a coloured blur. */}
      {scened && (
        <img className="scene-band__still" src={houseSceneStill} alt="" />
      )}
      {playing && (
        <ScenePreview
          identity="scene-band"
          // The starter scene behind a banner is FluidEQ's own.
          madeBy="fluideq"
          pack={pack}
          label={resolveSceneName(pack, locale)}
          onTrouble={() => setTrouble(true)}
        />
      )}
      <span className="scene-band__scrim" aria-hidden="true" />
      <div className="scene-band__over">{children}</div>
    </div>
  );
}
