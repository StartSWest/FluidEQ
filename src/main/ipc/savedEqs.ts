/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import ChannelEnum from '../../common/channels';
import { isSavedEqId } from '../../common/savedEq';
import {
  addSavedEq,
  deleteSavedEq,
  renameSavedEq,
  updateSavedEq,
} from '../../common/savedEqStore';
import { toSongSound } from '../../common/songSound';
import type { ISongSoundHolder } from '../songSoundHolder';
import { isText, replyInvalidParameter, replySuccess } from './songSoundCheck';
import onWindowMessage from './windowMessages';

/**
 * Auto EQ's saved EQs (`savedEq.ts`): kept in the song sounds' store, so a
 * song or an album that follows one and the EQ itself are written together
 * and a delete can never leave a link to nothing. Every change is told to the
 * window like any other change to that store (`SONG_SOUNDS_CHANGED`), which
 * is how the panel, Manage, the Library and a song playing one follow it.
 */
const registerSavedEqIpc = (holder: ISongSoundHolder): void => {
  onWindowMessage(ChannelEnum.SAVE_EQ, (event, arg) => {
    const channel = ChannelEnum.SAVE_EQ;
    const name: unknown = arg?.[0];
    const sound = toSongSound(arg?.[1]);
    const added =
      isText(name) && sound
        ? addSavedEq(
            holder.read(),
            `eq-${randomUUID()}`,
            name,
            sound,
            Date.now(),
          )
        : undefined;
    if (!added) {
      replyInvalidParameter(event, channel);
      return;
    }
    holder.write(added.settings);
    replySuccess(event, channel, { id: added.eq.id, name: added.eq.name });
  });

  onWindowMessage(ChannelEnum.UPDATE_EQ, (event, arg) => {
    const channel = ChannelEnum.UPDATE_EQ;
    const id: unknown = arg?.[0];
    const sound = toSongSound(arg?.[1]);
    const next =
      isSavedEqId(id) && sound
        ? updateSavedEq(holder.read(), id, sound, Date.now())
        : undefined;
    if (!next) {
      replyInvalidParameter(event, channel);
      return;
    }
    holder.write(next);
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.RENAME_EQ, (event, arg) => {
    const channel = ChannelEnum.RENAME_EQ;
    const id: unknown = arg?.[0];
    const name: unknown = arg?.[1];
    const next =
      isSavedEqId(id) && isText(name)
        ? renameSavedEq(holder.read(), id, name)
        : undefined;
    if (!next) {
      replyInvalidParameter(event, channel);
      return;
    }
    holder.write(next);
    replySuccess(event, channel, undefined);
  });

  onWindowMessage(ChannelEnum.DELETE_EQ, (event, arg) => {
    const channel = ChannelEnum.DELETE_EQ;
    const id: unknown = arg?.[0];
    if (!isSavedEqId(id)) {
      replyInvalidParameter(event, channel);
      return;
    }
    holder.write(deleteSavedEq(holder.read(), id));
    replySuccess(event, channel, undefined);
  });
};

export default registerSavedEqIpc;
