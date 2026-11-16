/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type IKaraokePlaylistItem } from '../../common/karaoke/files';

/** What a song row carries while it is dragged to a new place in the list. */
export const KARAOKE_PLAYLIST_DRAG_MIME = 'application/x-fluideq-karaoke-song';

export interface IKaraokePlaylistTreeNode {
  id: string;
  label?: string;
  path: string;
  items: IKaraokePlaylistItem[];
  children: IKaraokePlaylistTreeNode[];
}

export const karaokePlaylistFolderPath = (
  item: IKaraokePlaylistItem,
): string | undefined => {
  const normalized = item.relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/g, '');
  const separator = normalized.lastIndexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : undefined;
};

/** Build a visual folder tree without mutating the playback queue. */
export const buildKaraokePlaylistFolderTree = (
  items: readonly IKaraokePlaylistItem[],
): IKaraokePlaylistTreeNode[] => {
  const roots: IKaraokePlaylistTreeNode[] = [];
  const nodes = new Map<string, IKaraokePlaylistTreeNode>();
  const looseItems: IKaraokePlaylistItem[] = [];

  items.forEach((item) => {
    const folder = karaokePlaylistFolderPath(item);
    if (!folder) {
      looseItems.push(item);
      return;
    }
    let parent: IKaraokePlaylistTreeNode | undefined;
    let path = '';
    folder.split('/').forEach((label) => {
      path = path ? `${path}/${label}` : label;
      const id = path.toLocaleLowerCase();
      let node = nodes.get(id);
      if (!node) {
        node = { id, label, path, items: [], children: [] };
        nodes.set(id, node);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
      parent = node;
    });
    parent?.items.push(item);
  });

  if (looseItems.length) {
    roots.push({
      id: '__loose_files__',
      path: '',
      items: looseItems,
      children: [],
    });
  }
  return roots;
};

/** The songs a folder holds, its sub-folders' included. */
export const songsIn = (node: IKaraokePlaylistTreeNode): number =>
  node.items.length +
  node.children.reduce((total, child) => total + songsIn(child), 0);
