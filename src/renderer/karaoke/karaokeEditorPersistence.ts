/* FluidEQ renderer-side Karaoke progress persistence. GPL-3.0-or-later. */

export type TKaraokeMakerPersistedSelection =
  { kind: 'word'; id: string } | { kind: 'note'; id: string };

export interface IKaraokeMakerEditorView {
  viewStartMs: number;
  viewDurationMs: number;
  followViewport: boolean;
  previewOpen: boolean;
  previewTextSize?: number;
  previewHeight?: number;
  timingScope: 'all' | 'from-word';
  selection?: TKaraokeMakerPersistedSelection;
}

interface IKaraokeMakerEditorViewRecord extends IKaraokeMakerEditorView {
  updatedAt: number;
}

interface IKaraokeMakerEditorViewStore {
  version: 1;
  projects: Record<string, IKaraokeMakerEditorViewRecord>;
}

export interface IKaraokeProgressSnapshot {
  version: 1;
  selectedPlaylistId: string;
  playheadMs: number;
}

const MAKER_VIEW_STORAGE_KEY = 'fluideq.karaoke.maker-editor-views.v1';
const MAKER_OPEN_STORAGE_KEY = 'fluideq.karaoke.maker-open';
const PROGRESS_STORAGE_KEY = 'fluideq.karaoke.current-progress.v1';
const MAX_SAVED_EDITOR_VIEWS = 32;

const finiteNonNegative = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

const normalizeSelection = (
  value: unknown,
): TKaraokeMakerPersistedSelection | undefined => {
  const candidate = value as { kind?: unknown; id?: unknown } | undefined;
  return candidate &&
    (candidate.kind === 'word' || candidate.kind === 'note') &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= 2_048
    ? { kind: candidate.kind, id: candidate.id }
    : undefined;
};

const normalizeEditorView = (
  value: unknown,
): IKaraokeMakerEditorViewRecord | undefined => {
  const candidate = value as Partial<IKaraokeMakerEditorViewRecord> | undefined;
  const viewStartMs = finiteNonNegative(candidate?.viewStartMs);
  const viewDurationMs = finiteNonNegative(candidate?.viewDurationMs);
  if (
    viewStartMs === undefined ||
    viewDurationMs === undefined ||
    viewDurationMs < 1 ||
    typeof candidate?.followViewport !== 'boolean' ||
    typeof candidate.previewOpen !== 'boolean'
  ) {
    return undefined;
  }
  return {
    viewStartMs,
    viewDurationMs,
    followViewport: candidate.followViewport,
    previewOpen: candidate.previewOpen,
    previewTextSize: finiteNonNegative(candidate.previewTextSize),
    previewHeight: finiteNonNegative(candidate.previewHeight),
    timingScope: candidate.timingScope === 'from-word' ? 'from-word' : 'all',
    selection: normalizeSelection(candidate.selection),
    updatedAt: finiteNonNegative(candidate.updatedAt) ?? 0,
  };
};

const readEditorStore = (): IKaraokeMakerEditorViewStore => {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(MAKER_VIEW_STORAGE_KEY) ?? '',
    ) as Partial<IKaraokeMakerEditorViewStore>;
    if (value.version !== 1 || !value.projects) {
      throw new Error('Invalid Karaoke Maker editor view store.');
    }
    const projects = Object.fromEntries(
      Object.entries(value.projects)
        .map(
          ([projectId, state]) =>
            [projectId, normalizeEditorView(state)] as const,
        )
        .filter(
          (entry): entry is readonly [string, IKaraokeMakerEditorViewRecord] =>
            Boolean(entry[1]),
        ),
    );
    return { version: 1, projects };
  } catch {
    return { version: 1, projects: {} };
  }
};

export const readKaraokeMakerEditorView = (
  projectId: string,
): IKaraokeMakerEditorView | undefined => {
  const saved = readEditorStore().projects[projectId];
  if (!saved) {
    return undefined;
  }
  const { updatedAt: _updatedAt, ...view } = saved;
  return view;
};

export const writeKaraokeMakerEditorView = (
  projectId: string,
  view: IKaraokeMakerEditorView,
): void => {
  if (!projectId || projectId.length > 2_048) {
    return;
  }
  try {
    const store = readEditorStore();
    const normalized = normalizeEditorView({ ...view, updatedAt: Date.now() });
    if (!normalized) {
      return;
    }
    const projects = Object.fromEntries(
      Object.entries({ ...store.projects, [projectId]: normalized })
        .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
        .slice(0, MAX_SAVED_EDITOR_VIEWS),
    );
    window.localStorage.setItem(
      MAKER_VIEW_STORAGE_KEY,
      JSON.stringify({ version: 1, projects }),
    );
  } catch {
    // Restricted renderer storage must not make the editor unusable.
  }
};

export const readKaraokeMakerOpen = (): boolean => {
  try {
    return window.localStorage.getItem(MAKER_OPEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeKaraokeMakerOpen = (open: boolean): void => {
  try {
    window.localStorage.setItem(MAKER_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Restricted renderer storage must not affect opening the editor.
  }
};

export const readKaraokeProgress = (): IKaraokeProgressSnapshot | undefined => {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '',
    ) as Partial<IKaraokeProgressSnapshot>;
    const playheadMs = finiteNonNegative(value.playheadMs);
    return value.version === 1 &&
      typeof value.selectedPlaylistId === 'string' &&
      value.selectedPlaylistId.length > 0 &&
      playheadMs !== undefined
      ? {
          version: 1,
          selectedPlaylistId: value.selectedPlaylistId,
          playheadMs,
        }
      : undefined;
  } catch {
    return undefined;
  }
};

export const writeKaraokeProgress = (
  selectedPlaylistId: string | undefined,
  playheadMs: number,
): void => {
  if (!selectedPlaylistId || !Number.isFinite(playheadMs) || playheadMs < 0) {
    return;
  }
  try {
    window.localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 1, selectedPlaylistId, playheadMs }),
    );
  } catch {
    // The disk-backed session remains the fallback when storage is restricted.
  }
};

export const clearKaraokeProgress = (): void => {
  try {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // Nothing else needs to be cleared when renderer storage is restricted.
  }
};
