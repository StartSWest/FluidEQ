// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

#include <windows.h>
#include <cwchar>

namespace wallpaper {
inline bool owned_by(HWND window, DWORD pid) {
  DWORD actual = 0;
  return IsWindow(window) && GetWindowThreadProcessId(window, &actual) != 0 && actual == pid;
}

inline bool class_is(HWND window, const wchar_t* name) {
  wchar_t actual[128]{};
  return GetClassNameW(window, actual, 128) != 0 && std::wcscmp(actual, name) == 0;
}

struct Desktop {
  HWND progman = nullptr;
  HWND parent = nullptr;
  HWND icons = nullptr;
  HWND backdrop = nullptr;
  DWORD pid = 0;
  bool raised = false;
};

inline BOOL CALLBACK find_legacy(HWND window, LPARAM parameter) {
  auto& desktop = *reinterpret_cast<Desktop*>(parameter);
  if (!owned_by(window, desktop.pid)) return TRUE;
  const HWND icons = FindWindowExW(window, nullptr, L"SHELLDLL_DefView", nullptr);
  if (!owned_by(icons, desktop.pid)) return TRUE;
  const HWND worker = FindWindowExW(nullptr, window, L"WorkerW", nullptr);
  if (!owned_by(worker, desktop.pid) ||
      FindWindowExW(worker, nullptr, L"SHELLDLL_DefView", nullptr)) return TRUE;
  desktop.icons = icons;
  desktop.parent = worker;
  desktop.backdrop = worker;
  return FALSE;
}

inline bool discover(Desktop& desktop) {
  desktop.raised = (GetWindowLongPtrW(desktop.progman, GWL_EXSTYLE) &
                    WS_EX_NOREDIRECTIONBITMAP) != 0;
  if (desktop.raised) {
    // 24H2 composes DefView and WorkerW as Progman children. The wallpaper
    // must be a layered sibling BETWEEN them, not a child of the backdrop.
    desktop.icons = FindWindowExW(desktop.progman, nullptr, L"SHELLDLL_DefView", nullptr);
    desktop.backdrop = FindWindowExW(desktop.progman, nullptr, L"WorkerW", nullptr);
    desktop.parent = desktop.progman;
  } else {
    EnumWindows(find_legacy, reinterpret_cast<LPARAM>(&desktop));
  }
  return owned_by(desktop.parent, desktop.pid) &&
         owned_by(desktop.icons, desktop.pid) && owned_by(desktop.backdrop, desktop.pid);
}

inline bool valid(const Desktop& desktop) {
  if (!owned_by(desktop.progman, desktop.pid) ||
      !owned_by(desktop.parent, desktop.pid) ||
      !owned_by(desktop.icons, desktop.pid) ||
      !owned_by(desktop.backdrop, desktop.pid)) return false;
  if (desktop.raised) {
    return GetParent(desktop.icons) == desktop.progman &&
           GetParent(desktop.backdrop) == desktop.progman;
  }
  return class_is(desktop.parent, L"WorkerW") && GetParent(desktop.parent) == nullptr;
}

inline bool covers(const RECT& foreground, const RECT& monitor) {
  return foreground.left <= monitor.left && foreground.top <= monitor.top &&
         foreground.right >= monitor.right && foreground.bottom >= monitor.bottom;
}

inline bool empty_rect(const RECT& rect) {
  return rect.right <= rect.left || rect.bottom <= rect.top;
}

/**
 * More pieces of one monitor than any desk full of windows leaves showing.
 * Each window cuts one piece into at most four, so this is reached only by a
 * pathological arrangement — where the answer is "still showing", below.
 */
constexpr int kMaxShowing = 48;

/**
 * Whether `windows` leave nothing of `area` in sight: each rectangle is cut
 * out of what is still showing, and a monitor with no pieces left is one
 * whose desktop nobody can see.
 *
 * Windows will not answer "is this visible" for a window it does not own, so
 * this is the subtraction a compositor makes — the same one Chromium's native
 * occlusion tracking makes for ordinary windows. Only rectangles of windows
 * that actually hide what is under them belong here; a see-through window is
 * not one of them, and is left out by the caller.
 *
 * More pieces than the bound and the answer is no: a background that keeps
 * drawing behind a window costs a little power, while one that stops when it
 * should not is a desktop that went black for no reason anybody can see.
 */
inline bool covered(const RECT& area, const RECT* windows, int count) {
  if (empty_rect(area)) return false;
  RECT showing[kMaxShowing];
  RECT kept[kMaxShowing];
  int pieces = 1;
  showing[0] = area;
  for (int index = 0; index < count && pieces > 0; ++index) {
    const RECT& cut = windows[index];
    int held = 0;
    for (int piece = 0; piece < pieces; ++piece) {
      const RECT& showing_piece = showing[piece];
      RECT overlap{
        cut.left > showing_piece.left ? cut.left : showing_piece.left,
        cut.top > showing_piece.top ? cut.top : showing_piece.top,
        cut.right < showing_piece.right ? cut.right : showing_piece.right,
        cut.bottom < showing_piece.bottom ? cut.bottom : showing_piece.bottom};
      const RECT around[4]{
        empty_rect(overlap) ? showing_piece
                            : RECT{showing_piece.left, showing_piece.top,
                                   showing_piece.right, overlap.top},
        {showing_piece.left, overlap.bottom, showing_piece.right,
         showing_piece.bottom},
        {showing_piece.left, overlap.top, overlap.left, overlap.bottom},
        {overlap.right, overlap.top, showing_piece.right, overlap.bottom}};
      // A piece this window does not touch is the first entry, whole; the
      // other three are then empty and drop out.
      const int parts = empty_rect(overlap) ? 1 : 4;
      for (int part = 0; part < parts; ++part) {
        if (empty_rect(around[part])) continue;
        if (held == kMaxShowing) return false;
        kept[held++] = around[part];
      }
    }
    pieces = held;
    for (int piece = 0; piece < pieces; ++piece) showing[piece] = kept[piece];
  }
  return pieces == 0;
}

// True when `window` is stacked somewhere below `above` and above `below`.
// Every monitor has its own wallpaper window between the same two shell
// windows, so demanding the slot directly under the icons made two helpers
// take it from each other on every reorder event, forever.
inline bool stacked_between(HWND above, HWND window, HWND below) {
  bool above_seen = false;
  bool window_seen = false;
  for (HWND sibling = GetWindow(window, GW_HWNDFIRST); sibling;
       sibling = GetWindow(sibling, GW_HWNDNEXT)) {
    if (sibling == above) {
      if (window_seen) return false;
      above_seen = true;
    } else if (sibling == window) {
      if (!above_seen) return false;
      window_seen = true;
    } else if (sibling == below) {
      return window_seen;
    }
  }
  return false;
}
}  // namespace wallpaper
