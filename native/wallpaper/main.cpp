// SPDX-License-Identifier: GPL-3.0-or-later
#include "desktop.h"

#include <dwmapi.h>
#include <shellapi.h>
#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <limits>

namespace {
struct State {
  HWND surface = nullptr;
  DWORD owner_pid = 0;
  HANDLE owner = nullptr;
  HANDLE shell = nullptr;
  HANDLE input_closed = nullptr;
  HANDLE input_changed = nullptr;
  std::atomic<int> requested_visibility{-1};
  std::atomic<bool> invalid_command{false};
  wallpaper::Desktop desktop;
  RECT screen_rect{};
  RECT monitor_rect{};
  HMONITOR monitor = nullptr;
  bool attached = false;
  bool finished = false;
  bool paused = false;
  bool reported_visibility = false;
  bool requested_visible = false;
  int exit_code = 0;
  std::array<HWINEVENTHOOK, 4> hooks{};
} state;

bool line(const char* text) {
  DWORD written = 0;
  const auto length = static_cast<DWORD>(std::strlen(text));
  return WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), text, length, &written, nullptr) &&
         written == length;
}

void hide_owned() {
  if (!wallpaper::owned_by(state.surface, state.owner_pid)) return;
  // Never restore a disposable wallpaper as a top-level window. A message-only
  // parent stays invisible even when Explorer disappears during shutdown.
  SetWindowPos(state.surface, nullptr, 0, 0, 0, 0,
               SWP_HIDEWINDOW | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER);
  if (wallpaper::owned_by(state.surface, state.owner_pid)) {
    SetParent(state.surface, HWND_MESSAGE);
  }
}

void fail(const char* reason) {
  if (state.finished) return;
  state.finished = true;
  state.exit_code = 1;
  hide_owned();
  line("error:");
  line(reason);
  line("\n");
}

bool set_style(int index, LONG_PTR style) {
  SetLastError(ERROR_SUCCESS);
  return SetWindowLongPtrW(state.surface, index, style) != 0 || GetLastError() == ERROR_SUCCESS;
}

bool fullscreen() {
  const HWND foreground = GetForegroundWindow();
  if (!foreground || foreground == state.surface || !IsWindowVisible(foreground) ||
      IsIconic(foreground) || foreground == GetShellWindow()) return false;
  const LONG_PTR style = GetWindowLongPtrW(foreground, GWL_EXSTYLE);
  if ((style & WS_EX_TOOLWINDOW) != 0) return false;
  for (const auto* name : {L"Progman", L"WorkerW", L"SHELLDLL_DefView",
                           L"Shell_TrayWnd", L"Shell_SecondaryTrayWnd"}) {
    if (wallpaper::class_is(foreground, name)) return false;
  }
  DWORD cloaked = 0;
  if (SUCCEEDED(DwmGetWindowAttribute(foreground, DWMWA_CLOAKED, &cloaked,
                                     sizeof(cloaked))) && cloaked != 0) return false;
  RECT bounds{};
  // DWM excludes the invisible resize border: a maximized window above a
  // visible taskbar must not be mistaken for a fullscreen application.
  if (FAILED(DwmGetWindowAttribute(foreground, DWMWA_EXTENDED_FRAME_BOUNDS,
                                  &bounds, sizeof(bounds))) &&
      !GetWindowRect(foreground, &bounds)) return false;
  return wallpaper::covers(bounds, state.monitor_rect);
}

void verify_attachment();

void apply_visibility() {
  if (!state.attached || state.finished) return;
  verify_attachment();
  if (state.finished) return;
  const UINT visibility_flag = state.requested_visible && !state.paused
    ? SWP_SHOWWINDOW : SWP_HIDEWINDOW;
  // Electron's ShowInactive path can restore a cached top-level placement and
  // enter initial-focus bookkeeping. Keep child visibility and z-order here.
  if (!SetWindowPos(state.surface, nullptr, 0, 0, 0, 0,
                    visibility_flag | SWP_NOACTIVATE | SWP_NOMOVE |
                    SWP_NOSIZE | SWP_NOZORDER)) fail("visibility-failed");
}

void visibility() {
  if (!state.attached || state.finished) return;
  const bool paused = fullscreen();
  if (!state.reported_visibility || state.paused != paused) {
    state.paused = paused;
    state.reported_visibility = true;
    apply_visibility();
    if (state.finished) return;
    if (!line(paused ? "paused\n" : "active\n")) {
      state.finished = true;
      hide_owned();
    }
  }
}

void verify_attachment() {
  if (!state.attached || state.finished) return;
  if (!wallpaper::valid(state.desktop) ||
      !wallpaper::owned_by(state.surface, state.owner_pid) ||
      GetParent(state.surface) != state.desktop.parent) {
    fail("desktop-changed");
    return;
  }
  MONITORINFO info{sizeof(MONITORINFO)};
  if (!GetMonitorInfoW(state.monitor, &info) ||
      !EqualRect(&info.rcMonitor, &state.monitor_rect)) {
    fail("display-changed");
    return;
  }
  // Reassert ONLY our own sibling's order. Explorer's icons and wallpaper
  // windows are never hidden, restyled, or reordered by this helper.
  if (state.desktop.raised &&
      !wallpaper::stacked_between(state.desktop.icons, state.surface, state.desktop.backdrop)) {
    if (!SetWindowPos(state.surface, state.desktop.icons, 0, 0, 0, 0,
                      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)) fail("position-failed");
  }
  RECT placed{};
  if (!GetWindowRect(state.surface, &placed) || !EqualRect(&placed, &state.screen_rect)) {
    fail("position-failed");
  }
}

void CALLBACK on_event(HWINEVENTHOOK, DWORD event, HWND window, LONG object,
                       LONG child, DWORD, DWORD) {
  if (state.finished) return;
  if (event >= EVENT_OBJECT_CREATE &&
      (!window || object != OBJID_WINDOW || child != CHILDID_SELF)) return;
  if (event == EVENT_OBJECT_DESTROY &&
      (window == state.desktop.progman || window == state.desktop.parent ||
       window == state.desktop.icons || window == state.desktop.backdrop ||
       window == state.surface)) {
    fail("desktop-destroyed");
    return;
  }
  if (!state.attached) return;
  verify_attachment();
  if (event == EVENT_SYSTEM_FOREGROUND || event == EVENT_SYSTEM_MINIMIZESTART ||
      event == EVENT_SYSTEM_MINIMIZEEND || window == GetForegroundWindow()) visibility();
}

void CALLBACK desktop_ready(HWND, UINT, ULONG_PTR, LRESULT) {
  if (state.finished) return;
  if (!wallpaper::discover(state.desktop)) {
    fail("desktop-unavailable");
    return;
  }
  if (!wallpaper::owned_by(state.surface, state.owner_pid)) {
    fail("owner-mismatch");
    return;
  }
  LONG_PTR style = GetWindowLongPtrW(state.surface, GWL_STYLE);
  style = (style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_VISIBLE)) | WS_CHILD;
  LONG_PTR extended = GetWindowLongPtrW(state.surface, GWL_EXSTYLE);
  extended = (extended & ~(WS_EX_APPWINDOW | WS_EX_TOPMOST)) |
             WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT;
  if (state.desktop.raised) extended |= WS_EX_LAYERED;
  if (!set_style(GWL_STYLE, style) || !set_style(GWL_EXSTYLE, extended)) {
    fail("style-failed");
    return;
  }
  SetLastError(ERROR_SUCCESS);
  if (!SetParent(state.surface, state.desktop.parent) && GetLastError() != ERROR_SUCCESS) {
    fail("attach-failed");
    return;
  }
  if (state.desktop.raised && !SetLayeredWindowAttributes(state.surface, 0, 255, LWA_ALPHA)) {
    fail("composition-failed");
    return;
  }
  POINT points[2]{{state.screen_rect.left, state.screen_rect.top},
                  {state.screen_rect.right, state.screen_rect.bottom}};
  SetLastError(ERROR_SUCCESS);
  if (MapWindowPoints(nullptr, state.desktop.parent, points, 2) == 0 &&
      GetLastError() != ERROR_SUCCESS) {
    fail("coordinates-failed");
    return;
  }
  const HWND after = state.desktop.raised ? state.desktop.icons : HWND_BOTTOM;
  if (!SetWindowPos(state.surface, after, points[0].x, points[0].y,
                    points[1].x - points[0].x, points[1].y - points[0].y,
                    SWP_NOACTIVATE | SWP_FRAMECHANGED)) {
    fail("position-failed");
    return;
  }
  state.attached = true;
  verify_attachment();
  if (state.finished) return;
  if (!line("ready\n")) {
    state.finished = true;
    hide_owned();
    return;
  }
  visibility();
}

DWORD WINAPI read_input(void*) {
  char buffer[64];
  char command[4]{};
  std::size_t used = 0;
  DWORD count = 0;
  // A bounded parser accepts only complete show/hide records. The latest
  // policy wins if main changes it several times before the UI thread wakes.
  while (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer), &count, nullptr) &&
         count != 0) {
    for (DWORD index = 0; index < count; ++index) {
      const char value = buffer[index];
      if (value == '\n' && used == 4 &&
          (std::memcmp(command, "show", 4) == 0 || std::memcmp(command, "hide", 4) == 0)) {
        state.requested_visibility.store(command[0] == 's' ? 1 : 0);
        used = 0;
        SetEvent(state.input_changed);
      } else if (value != '\n' && used < 4) {
        command[used++] = value;
      } else {
        state.invalid_command.store(true);
        SetEvent(state.input_changed);
        return 0;
      }
    }
  }
  SetEvent(state.input_closed);
  return 0;
}

bool decimal(const wchar_t* text, std::uint64_t maximum, std::uint64_t& result) {
  result = 0;
  if (!text || *text == L'\0') return false;
  for (; *text != L'\0'; ++text) {
    if (*text < L'0' || *text > L'9') return false;
    const auto digit = static_cast<std::uint64_t>(*text - L'0');
    if (result > (maximum - digit) / 10) return false;
    result = result * 10 + digit;
  }
  return result != 0;
}

int run() {
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  std::uint64_t hwnd_value = 0;
  std::uint64_t pid_value = 0;
  const bool arguments_valid = argv && argc == 3 &&
    decimal(argv[1], std::numeric_limits<std::uintptr_t>::max(), hwnd_value) &&
    decimal(argv[2], std::numeric_limits<DWORD>::max(), pid_value);
  if (argv) LocalFree(argv);
  if (!arguments_valid) { fail("invalid-arguments"); return 1; }
  state.surface = reinterpret_cast<HWND>(static_cast<std::uintptr_t>(hwnd_value));
  state.owner_pid = static_cast<DWORD>(pid_value);
  if (!wallpaper::owned_by(state.surface, state.owner_pid)) {
    // No mutation, including cleanup, is permitted for a mismatched HWND.
    state.surface = nullptr;
    fail("owner-mismatch");
    return 1;
  }
  state.owner = OpenProcess(SYNCHRONIZE, FALSE, state.owner_pid);
  if (!state.owner) { fail("owner-unavailable"); return 1; }
  if (!SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
    fail("dpi-unavailable"); return 1;
  }
  if (!GetWindowRect(state.surface, &state.screen_rect) ||
      state.screen_rect.right <= state.screen_rect.left ||
      state.screen_rect.bottom <= state.screen_rect.top) {
    fail("invalid-bounds"); return 1;
  }
  state.monitor = MonitorFromRect(&state.screen_rect, MONITOR_DEFAULTTONULL);
  MONITORINFO monitor{sizeof(MONITORINFO)};
  if (!state.monitor || !GetMonitorInfoW(state.monitor, &monitor)) {
    fail("display-unavailable"); return 1;
  }
  state.monitor_rect = monitor.rcMonitor;
  // The window's own rectangle only names the monitor. Windows clamps a
  // top-level window to the work area — 2560x1392 on a 2560x1440 display with
  // its taskbar — and Chromium's frame styles add invisible insets, so placing
  // it where it stood left the taskbar strip showing the ordinary wallpaper
  // and the picture shifted sideways. As a child it can cover the monitor.
  state.screen_rect = state.monitor_rect;
  SetWindowPos(state.surface, nullptr, 0, 0, 0, 0,
               SWP_HIDEWINDOW | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER);
  state.desktop.progman = FindWindowW(L"Progman", nullptr);
  if (!state.desktop.progman ||
      !GetWindowThreadProcessId(state.desktop.progman, &state.desktop.pid) ||
      !wallpaper::owned_by(GetShellWindow(), state.desktop.pid)) {
    fail("desktop-unavailable"); return 1;
  }
  state.shell = OpenProcess(SYNCHRONIZE, FALSE, state.desktop.pid);
  state.input_closed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  state.input_changed = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!state.shell || !state.input_closed || !state.input_changed) {
    fail("lifetime-unavailable"); return 1;
  }
  HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (!reader) { fail("input-unavailable"); return 1; }
  CloseHandle(reader);
  constexpr DWORD flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
  state.hooks = {
    SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_REORDER, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_PARENTCHANGE, nullptr, on_event, 0, 0, flags)
  };
  for (const auto hook : state.hooks) {
    if (!hook) { fail("events-unavailable"); return 1; }
  }
  // Completion, not a guessed delay, says Explorer has processed the request.
  // The message loop can still respond to owner/stdin/shell loss while waiting.
  if (!SendMessageCallbackW(state.desktop.progman, 0x052C, 0xD, 1, desktop_ready, 0)) {
    fail("desktop-request-failed"); return 1;
  }
  const HANDLE handles[]{state.owner, state.input_closed, state.shell, state.input_changed};
  while (!state.finished) {
    const DWORD result = MsgWaitForMultipleObjectsEx(4, handles, INFINITE, QS_ALLINPUT,
                                                     MWMO_INPUTAVAILABLE);
    if (result == WAIT_OBJECT_0 || result == WAIT_OBJECT_0 + 1) break;
    if (result == WAIT_OBJECT_0 + 2) { fail("desktop-destroyed"); break; }
    if (result == WAIT_FAILED) { fail("wait-failed"); break; }
    if (result == WAIT_OBJECT_0 + 3) {
      if (state.invalid_command.load()) { fail("invalid-command"); break; }
      state.requested_visible = state.requested_visibility.load() == 1;
      apply_visibility();
    }
    MSG message{};
    while (!state.finished && PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
      if (message.message == WM_QUIT) { state.finished = true; break; }
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
  }
  return state.exit_code;
}
}  // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  const int result = run();
  state.finished = true;
  hide_owned();
  for (const auto hook : state.hooks) if (hook) UnhookWinEvent(hook);
  // Kernel handles and the blocked stdin reader belong to this process only;
  // process exit closes them without racing a cancellation against ReadFile.
  return result;
}
