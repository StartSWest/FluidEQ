/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import {
  IRoomPreset,
  resetRoom,
  roomInShape,
  roomPresetOf,
  roomPresetSettings,
} from '../../common/dsp/roomPresets';
import { withSoloWhileFed } from '../../common/dsp/roomSpeakers';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { ProcessorCard } from './DspControls';
import DspRoomBar from './DspRoomBar';
import DspRoomFit from './DspRoomFit';
import DspRoomGraph from './DspRoomGraph';
import DspRoomQuick from './DspRoomQuick';
import DspRoomSignal from './DspRoomSignal';
import DspRoomSpeakerPanel from './DspRoomSpeakerPanel';
import DspRoomTune from './DspRoomTune';
import {
  forgetRoomSource,
  IRoomSource,
  rememberRoomSource,
  roomRestoreSource,
  trackRoomEdit,
} from './roomProfileMemory';
import { TRoomPick } from './roomSpeakerNames';
import { isRoomPlaying, roomFeedOf } from './roomView';
import {
  deleteSavedRoom,
  ISavedRoom,
  ISaveRoomResult,
  readSavedRooms,
  roomShapesMatch,
  saveRoom,
} from './savedRooms';
import { IRoomLive } from './useRoomLive';
import '../styles/DspRoom.scss';
import '../styles/LookPicker.scss';

interface IDspRoomCardProps {
  room: IRoomSettings;
  live: IRoomLive;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/**
 * Each speaker's mirror across the front: left with right, the centre with
 * nobody. A plain move takes the pair, so a layout stays symmetric without
 * a second drag that never quite lands on the same angle.
 */
const ROOM_MIRROR = [1, 0, -1, 4, 3, 6, 5];

/**
 * The Room's page: the rooms in the same picker every other stage has, then
 * one page with nothing behind a tab. The room from above stands on the
 * left; beside it, filling the rest of the card, every band of the page —
 * the selected speaker's own, there from the first press of a drag, the three
 * dials most rooms are made with, what the room is made of past those, and
 * the listener. A first version put the last two behind "Tune" and "Fit"
 * tabs and the rooms behind a "Browse" button, and what it hid was not found.
 *
 * All of it is free. Dragging a speaker, its dials, the room's dials, saved
 * rooms and the listening test were Plus until 2026-09-20, and the locks came
 * off on Ivan's call: Plus is the visualizers and what the server does for
 * them, and this page is sound. It also could not have held — every line of
 * it runs on the listener's own machine under a licence that lets them delete
 * the check and pass the build on, so the lock was a promise the licence
 * cannot keep.
 */
const DspRoomCard = ({ room, live, onPatch, onCommit }: IDspRoomCardProps) => {
  const { t } = useTranslation();
  // The Room is sound, and sound is not Plus. Plus is the visualizers and
  // what the server does for them; everything on this page runs on the
  // listener's own machine, where a lock is a line anybody may delete and
  // share — the licence says so in as many words. Shaping needs the room
  // switched on and nothing else.
  const canShape = room.enabled;
  // Nothing chosen to begin with: the pane beside the picture rests behind a
  // card asking for a speaker, and a press on the room lets go of one again.
  const [picked, setPicked] = useState<TRoomPick | undefined>(undefined);
  const [saved, setSaved] = useState<ISavedRoom[]>(() => readSavedRooms());
  /** The room a drag began in, to go back to if it is called off. */
  const dragOrigin = useRef<IRoomSettings | null>(null);
  const feed = roomFeedOf(live.state);
  const isSurround =
    live.state === '5.1' || live.state === '7.1' || live.state === 'on';
  /** The saved room the card stands in: a custom room in a saved shape. */
  const savedHere =
    room.presetId === 'custom'
      ? saved.find((one) => roomShapesMatch(one.shape, room))
      : undefined;
  const standingIn: IRoomSource | undefined =
    savedHere === undefined
      ? undefined
      : { presetId: 'custom', name: savedHere.name, shape: savedHere.shape };

  /**
   * A solo is let go when what is playing stops reaching its speaker — a 7.1
   * game closed and a stereo video started, say. On the engine's word, which
   * is the only thing that knows what the stream is; the front-stage switch
   * does its own part at once, without waiting for it.
   */
  const heldMutes = withSoloWhileFed(room.mutes, feed.fed);
  useEffect(() => {
    // The same array back means there was nothing to let go.
    if (heldMutes !== room.mutes) {
      const next: IRoomSettings = {
        ...room,
        mutes: [...heldMutes],
        presetId: 'custom',
      };
      trackRoomEdit(room, next);
      onPatch(next);
      onCommit();
    }
  }, [heldMutes, room, onPatch, onCommit]);

  /**
   * An edit of the room's shape, from anywhere on the card: remembered, so
   * Restore knows what it was edited away from, then applied.
   */
  const edit = (next: IRoomSettings) => {
    trackRoomEdit(room, next, standingIn);
    onPatch(next);
  };
  /** Any change to the room's shape makes the result Custom. */
  const shape = (next: Partial<IRoomSettings>) =>
    edit({ ...room, ...next, presetId: 'custom' });
  /** The pane and the picture both move a speaker, and both take its pair. */
  const turn = (speaker: number, angleDeg: number, mirrored: boolean) => {
    const pair = mirrored ? ROOM_MIRROR[speaker] : -1;
    shape({
      angles: room.angles.map((angle, at) => {
        if (at === speaker) {
          return angleDeg;
        }
        return at === pair ? -angleDeg : angle;
      }),
    });
  };

  const restore = roomRestoreSource(room);
  const restorePreset =
    restore === undefined ? undefined : roomPresetOf(restore.presetId);
  const restoreName =
    restorePreset !== undefined
      ? t(restorePreset.labelKey as TranslationKey)
      : restore?.name;

  // What the resting pane shows is the front left's, so its note is too.
  const pickedFor = picked ?? 0;
  const pickedIsFed = pickedFor === 'sub' ? feed.subFed : feed.fed[pickedFor];

  return (
    <ProcessorCard
      id="dsp-room"
      titleKey="dsp.room.title"
      isEnabled={room.enabled}
      onToggle={() => {
        onPatch({ ...room, enabled: !room.enabled });
        onCommit();
      }}
      toolbar={
        <DspRoomBar
          room={room}
          saved={saved}
          savedHere={savedHere}
          restoreName={restoreName}
          onPreset={(preset: IRoomPreset) => {
            rememberRoomSource({ presetId: preset.id, shape: preset.shape });
            onPatch({ ...roomPresetSettings(room, preset.id), enabled: true });
            onCommit();
          }}
          onSaved={(one) => {
            rememberRoomSource({
              presetId: 'custom',
              name: one.name,
              shape: one.shape,
            });
            onPatch({
              ...roomInShape(room, one.shape, 'custom'),
              enabled: true,
            });
            onCommit();
          }}
          onRestore={() => {
            if (restore === undefined) {
              return;
            }
            rememberRoomSource(restore);
            onPatch(roomInShape(room, restore.shape, restore.presetId));
            onCommit();
          }}
          onReset={() => {
            forgetRoomSource();
            onPatch(resetRoom(room));
            onCommit();
          }}
          onSave={(name): ISaveRoomResult => {
            const result = saveRoom(name, room);
            setSaved(result.rooms);
            return result;
          }}
          onDelete={(one) => setSaved(deleteSavedRoom(one.id))}
        />
      }
    >
      <div className="dsp-room-status">
        <p
          className={`dsp-room-source${
            isRoomPlaying(live.state) ? ' is-on' : ''
          }`}
          aria-live="polite"
        >
          <span className="dsp-room-source__pip" aria-hidden="true" />
          {t(feed.sourceKey)}
        </p>
      </div>
      <DspRoomSignal room={room} />

      <div className="dsp-room-page">
        <div className="dsp-room-picture">
          <DspRoomGraph
            room={room}
            fed={feed.fed}
            derived={feed.derived}
            subFed={feed.subFed}
            isDisabled={!room.enabled}
            selected={picked}
            onSelect={setPicked}
            onAngle={turn}
            onDragStart={() => {
              dragOrigin.current = room;
            }}
            onDragCancel={() => {
              // Back to the room the drag began in, name and all: a drag
              // called off has not happened.
              if (dragOrigin.current !== null) {
                onPatch(dragOrigin.current);
                onCommit();
              }
              dragOrigin.current = null;
            }}
            onCommit={() => {
              dragOrigin.current = null;
              onCommit();
            }}
          />
          {room.enabled && feed.noteKey !== undefined ? (
            <p className="dsp-room-note" role="status">
              {t(feed.noteKey)}
            </p>
          ) : undefined}
        </div>

        <div className="dsp-room-bands">
          <DspRoomSpeakerPanel
            room={room}
            which={picked}
            canShape={canShape}
            isFed={pickedIsFed}
            isDerived={pickedFor !== 'sub' && feed.derived[pickedFor]}
            isDisabled={!room.enabled}
            onChange={edit}
            onCommit={onCommit}
          />
          <DspRoomQuick
            room={room}
            canShape={canShape}
            onShape={shape}
            onPatch={edit}
            onCommit={onCommit}
          />
          <DspRoomTune
            room={room}
            feed={feed}
            isSurround={isSurround}
            canShape={canShape}
            onShape={shape}
            onCommit={onCommit}
          />
          <DspRoomFit room={room} onPatch={onPatch} onCommit={onCommit} />
        </div>
      </div>
    </ProcessorCard>
  );
};

export default DspRoomCard;
