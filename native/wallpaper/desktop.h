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
