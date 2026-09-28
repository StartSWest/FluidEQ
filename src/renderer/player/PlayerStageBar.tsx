/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isLockedLookId } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import GraphAutoCycle from '../graph/GraphAutoCycle';
import GraphWallpaperToggle from '../graph/GraphWallpaperToggle';
import LightingToggle from '../graph/LightingToggle';
import LookPicker from '../graph/LookPicker';
import SceneLikeButton from '../graph/SceneLikeButton';
import SceneTintMenu from '../graph/SceneTintMenu';
import {
  cycleGraphLook,
  setGraphLook,
  useSelectedLookId,
} from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import PlayerIcon from './PlayerIcon';
import { setPlayerWidthNeed } from './playerLayout';
import useRowFit from './useRowFit';
import { setWindowMode } from './windowModeStore';

interface IPlayerStageBarProps {
  /** A Plus visualizer is the picture: its own keys join the bar. */
  isScene: boolean;
  isFull: boolean;
  onFull: () => void;
}

/**
 * The visualizer's own bar, on the picture itself rather than in the
 * header (Ivan, 2026-09-27: "don't put the viz select on the header, we want
 * a clean header for dragging"): the look and the arrows either side of it
 * on one glass pill; on another the automatic switching, then on a Plus
 * visualizer what it does to the window, the heart on a member's scene, the
 * desk lights and the desktop background, and the full screen. Each is the
 * graph's own control and hides itself where it can do nothing, so the
 * picker, the arrows and the switching here move the graph's selection.
 *
 * ON ONE LINE, ALWAYS (Ivan, 2026-09-28: "add a min width to the amp so this
 * fits properly"). The automatic switching gives up its words first where
 * the room runs short (`useRowFit`), and what the bar needs with them gone is
 * the window's floor (`setPlayerWidthNeed`): it used to wrap onto two rows,
 * or run under the sheet in a wide window.
 */
const PlayerStageBar = ({ isScene, isFull, onFull }: IPlayerStageBarProps) => {
  const { t } = useTranslation();
  const selectedLookId = useSelectedLookId();
  const memberScenes = useUsableMemberScenes();
  const memberScene = isMemberLookId(selectedLookId)
    ? memberScenes.find((candidate) => candidate.lookId === selectedLookId)
    : undefined;
  const choose = useCallback((lookId: string) => {
    if (!isLockedLookId(lookId)) {
      setGraphLook(lookId);
      return;
    }
    // Plus is explained and bought in the Account panel, which is the full
    // app's; the look on screen stays put, as it does there.
    setWindowMode('app')
      .then(() => requestAccountPanel())
      .catch(() => undefined);
  }, []);
  const barRef = useRef<HTMLDivElement>(null);
  // The bar's content, and its inset from the window's edge on each side.
  const onNeed = useCallback((width: number) => {
    const bar = barRef.current;
    if (bar) {
      setPlayerWidthNeed(
        'bar',
        width + 2 * parseFloat(getComputedStyle(bar).left),
      );
    }
  }, []);
  useRowFit(barRef, 1, onNeed);
  useEffect(() => () => setPlayerWidthNeed('bar', undefined), []);

  return (
    <div className="player-stagebar" ref={barRef}>
      <span className="player-stagebar__pill player-stagebar__looks">
        <button
          type="button"
          className="player-stagebar__step"
          aria-label={t('graph.style.previous')}
          title={t('graph.style.previous')}
          onClick={() => cycleGraphLook(-1)}
        >
          <PlayerIcon name="chevronLeft" />
        </button>
        <LookPicker value={selectedLookId} disabled={false} onChoose={choose} />
        <button
          type="button"
          className="player-stagebar__step"
          aria-label={t('graph.style.next')}
          title={t('graph.style.next')}
          onClick={() => cycleGraphLook(1)}
        >
          <PlayerIcon name="chevronRight" />
        </button>
      </span>
      <span className="player-stagebar__pill player-stagebar__tools">
        <GraphAutoCycle
          selectedLookId={selectedLookId}
          isWaveHidden={false}
          isEditing={false}
        />
        {isScene && <SceneTintMenu />}
        {isScene && memberScene && (
          <SceneLikeButton key={memberScene.lookId} scene={memberScene} />
        )}
        {isScene && <LightingToggle />}
        {isScene && <GraphWallpaperToggle lookId={selectedLookId} />}
        <button
          type="button"
          className="player-stagebar__step"
          aria-pressed={isFull}
          aria-label={t('graph.view.fullscreen')}
          title={t('graph.view.fullscreen')}
          onClick={onFull}
        >
          <PlayerIcon name="expand" />
        </button>
      </span>
    </div>
  );
};

export default PlayerStageBar;
