/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  ILeaderboardBoard,
  ILeaderboardStatus,
  TLeaderboardResult,
} from './ipc/leaderboard';
import type { TLeaderboardPeriod } from './usage/leaderboardApi';
import type {
  IForumBoards,
  IForumTopic,
  IForumTopicPage,
  IForumTopicQuery,
  TForumAuthState,
  TForumPostKind,
  TForumResult,
} from '../common/forum/forumTypes';

/**
 * Listening minutes and the leaderboard, and the forum.
 */

// Listening minutes and the leaderboard. Seconds go up as they are observed;
// whether any of it leaves the machine is the person's choice, kept by main.
const usageAccrue = (seconds: number) =>
  ipcRenderer.invoke('usage-accrue', seconds) as Promise<void>;
const leaderboardStatus = () =>
  ipcRenderer.invoke('leaderboard-status') as Promise<ILeaderboardStatus>;
const leaderboardOptIn = (value: boolean) =>
  ipcRenderer.invoke(
    'leaderboard-opt-in',
    value,
  ) as Promise<ILeaderboardStatus>;
const leaderboardBoard = (period: TLeaderboardPeriod) =>
  ipcRenderer.invoke('leaderboard-board', period) as Promise<
    TLeaderboardResult<ILeaderboardBoard>
  >;
const leaderboardRemoveMe = () =>
  ipcRenderer.invoke('leaderboard-remove-me') as Promise<
    TLeaderboardResult<void>
  >;
const onLeaderboardStatus = (
  listener: (status: ILeaderboardStatus) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, status: ILeaderboardStatus) =>
    listener(status);
  ipcRenderer.on('leaderboard-status-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('leaderboard-status-changed', wrapped);
  };
};

// The forum: the project's GitHub Discussions. Every call answers a result
// rather than throwing, so the reason something failed survives the bridge.
const forumState = () =>
  ipcRenderer.invoke('forum-state') as Promise<TForumAuthState>;
const forumSignIn = (locale: string) =>
  ipcRenderer.invoke('forum-sign-in', locale) as Promise<
    TForumResult<TForumAuthState>
  >;
const forumCancelSignIn = () =>
  ipcRenderer.invoke('forum-sign-in-cancel') as Promise<void>;
const forumSignOut = () =>
  ipcRenderer.invoke('forum-sign-out') as Promise<TForumAuthState>;
const forumBoards = () =>
  ipcRenderer.invoke('forum-boards') as Promise<TForumResult<IForumBoards>>;
const forumTopics = (query: IForumTopicQuery) =>
  ipcRenderer.invoke('forum-topics', query) as Promise<
    TForumResult<IForumTopicPage>
  >;
const forumTopic = (number: number, cursor?: string) =>
  ipcRenderer.invoke('forum-topic', number, cursor) as Promise<
    TForumResult<IForumTopic>
  >;
const forumCreateTopic = (draft: {
  board: string;
  title: string;
  body: string;
}) =>
  ipcRenderer.invoke('forum-create-topic', draft) as Promise<
    TForumResult<number>
  >;
const forumReply = (draft: {
  topicId: string;
  body: string;
  replyToId?: string;
}) => ipcRenderer.invoke('forum-reply', draft) as Promise<TForumResult<void>>;
const forumEdit = (draft: { id: string; kind: TForumPostKind; body: string }) =>
  ipcRenderer.invoke('forum-edit', draft) as Promise<TForumResult<void>>;
const forumEditTitle = (topicId: string, title: string) =>
  ipcRenderer.invoke('forum-edit-title', topicId, title) as Promise<
    TForumResult<void>
  >;
const forumDelete = (id: string) =>
  ipcRenderer.invoke('forum-delete', id) as Promise<TForumResult<void>>;
const forumVote = (id: string, on: boolean) =>
  ipcRenderer.invoke('forum-vote', id, on) as Promise<
    TForumResult<{ votes: number; hasVoted: boolean }>
  >;
const forumMarkAnswer = (id: string, on: boolean) =>
  ipcRenderer.invoke('forum-mark-answer', id, on) as Promise<
    TForumResult<void>
  >;
const forumPreview = (body: string) =>
  ipcRenderer.invoke('forum-preview', body) as Promise<TForumResult<string>>;
const onForumState = (listener: (state: TForumAuthState) => void) => {
  const wrapped = (_event: IpcRendererEvent, state: TForumAuthState) =>
    listener(state);
  ipcRenderer.on('forum-state-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('forum-state-changed', wrapped);
  };
};

const communityBridge = {
  usageAccrue,
  leaderboardStatus,
  leaderboardOptIn,
  leaderboardBoard,
  leaderboardRemoveMe,
  onLeaderboardStatus,
  forumState,
  forumSignIn,
  forumCancelSignIn,
  forumSignOut,
  forumBoards,
  forumTopics,
  forumTopic,
  forumCreateTopic,
  forumReply,
  forumEdit,
  forumEditTitle,
  forumDelete,
  forumVote,
  forumMarkAnswer,
  forumPreview,
  onForumState,
};

export default communityBridge;
