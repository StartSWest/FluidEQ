// SPDX-License-Identifier: GPL-3.0-or-later
#include "desktop.h"
#include "icons.h"
#include "pointer.h"

#include <dwmapi.h>
#include <shellapi.h>
#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <iterator>
#include <limits>
#include <optional>

namespace {
struct State {
  HWND surface = nullptr;
  DWORD owner_pid = 0;
  HANDLE owner = nullptr;
  HANDLE shell = nullptr;
  HANDLE input_closed = nullptr;
  HANDLE input_changed = nullptr;
  std::atomic<int> requested_visibility{-1};
  std::atomic<int> requested_touch{-1};
  std::atomic<bool> invalid_command{false};
  wallpaper::Desktop desktop;
  RECT screen_rect{};
  RECT monitor_rect{};
  RECT work_rect{};
  HMONITOR monitor = nullptr;
  bool attached = false;
  bool finished = false;
  wallpaper::Cover cover = wallpaper::Cover::none;
  bool reported_visibility = false;
  bool requested_visible = false;
  int exit_code = 0;
  std::array<HWINEVENTHOOK, 5> hooks{};
  // The mouse (`pointer.h`): main's word on whether to pass it on, whether
  // Raw Input is registered now, and the window it is delivered to.
  bool touch_requested = false;
  bool listening = false;
  HWND input_sink = nullptr;
  std::optional<wallpaper::PointerRouter> router;
  // The icons (`icons.h`): the list view they live in, and their rectangles
  // as the reading thread last found them. `icons_known` false — never read,
  // or Explorer would not say — passes nothing on over a visible list view.
  HWND list_view = nullptr;
  HANDLE icons_wanted = nullptr;
  SRWLOCK icons_lock = SRWLOCK_INIT;
  RECT icons[wallpaper::kMaxIcons]{};
  int icon_count = 0;
  bool icons_known = false;
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

/** A note for main's log. Never where the pointer is: nothing of that is kept. */
void note(const char* text) {
  DWORD written = 0;
  WriteFile(GetStdHandle(STD_ERROR_HANDLE), text, static_cast<DWORD>(std::strlen(text)),
            &written, nullptr);
}

void pointer_line(const char* text) {
  if (state.finished) return;
  if (!line(text)) {
    state.finished = true;
    hide_owned();
  }
}

/**
 * Whether the window under `at` is the desktop itself — its icons' list
 * view, the shell windows around it, or this background — rather than an
 * application, the taskbar, a menu or a widget standing on it.
 */
bool desktop_under(POINT at) {
  const HWND hit = WindowFromPoint(at);
  if (!hit) return false;
  if (hit == state.surface) return true;
  const HWND root = GetAncestor(hit, GA_ROOT);
  return root == GetAncestor(state.desktop.icons, GA_ROOT) ||
         root == GetAncestor(state.desktop.parent, GA_ROOT);
}

/** This monitor's desktop, with no icon on it either. */
bool bare_desktop_at(POINT at) {
  if (!PtInRect(&state.monitor_rect, at) || !desktop_under(at)) return false;
  // Desktop icons switched off in Explorer: nothing there to keep clear of.
  if (!state.list_view || !IsWindowVisible(state.list_view)) return true;
  AcquireSRWLockShared(&state.icons_lock);
  const bool bare =
    state.icons_known && !wallpaper::over_any(at, state.icons, state.icon_count);
  ReleaseSRWLockShared(&state.icons_lock);
  return bare;
}

/**
 * Raw Input registered exactly while the mouse is to be passed on: main asked
 * for it, the background is shown, and some of the desktop is in sight. The
 * rest of the time this process receives no mouse input at all.
 */
void update_listening() {
  const bool wanted = state.attached && !state.finished && state.touch_requested &&
                      state.requested_visible && state.cover == wallpaper::Cover::none &&
                      state.router.has_value();
  if (wanted == state.listening) return;
  // RIDEV_INPUTSINK: delivered while another process has the foreground,
  // which on a desktop is always. Removing names no window.
  RAWINPUTDEVICE device{0x01, 0x02, wanted ? static_cast<DWORD>(RIDEV_INPUTSINK) : RIDEV_REMOVE,
                        wanted ? state.input_sink : nullptr};
  if (!RegisterRawInputDevices(&device, 1, sizeof(device))) {
    // The background plays on without the mouse; nothing else depends on it.
    note(wanted ? "touch-unavailable\n" : "touch-stop-failed\n");
    if (wanted) return;
  }
  state.listening = wanted;
  if (wanted) {
    SetEvent(state.icons_wanted);
  } else {
    state.router->cancel(pointer_line);
  }
}

void on_raw_input(HRAWINPUT handle) {
  if (!state.listening || state.finished) return;
  RAWINPUT input{};
  UINT size = sizeof(input);
  if (GetRawInputData(handle, RID_INPUT, &input, &size, sizeof(RAWINPUTHEADER)) ==
        static_cast<UINT>(-1) ||
      input.header.dwType != RIM_TYPEMOUSE) return;
  wallpaper::PointerSample sample;
  // Read when the report is handled, after Windows has moved the cursor by it.
  if (!GetCursorPos(&sample.at)) return;
  const USHORT flags = input.data.mouse.usButtonFlags;
  wallpaper::raw_buttons(flags, sample.downs, sample.ups);
  if ((flags & RI_MOUSE_WHEEL) != 0) {
    sample.wheel = static_cast<SHORT>(input.data.mouse.usButtonData);
  }
  sample.bare = bare_desktop_at(sample.at);
  // Ctrl's state at this one moment, and only when the report is passed on:
  // the camera's key, and nothing else of the keyboard is ever read.
  if (sample.bare || state.router->holding()) {
    sample.ctrl = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
  }
  state.router->feed(sample, pointer_line);
  // A release over the desktop is how an icon is dropped somewhere new.
  if ((sample.ups & wallpaper::kAllButtons) != 0 && desktop_under(sample.at)) {
    SetEvent(state.icons_wanted);
  }
}

LRESULT CALLBACK sink_procedure(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_INPUT) on_raw_input(reinterpret_cast<HRAWINPUT>(lparam));
  // WM_INPUT's own cleanup is DefWindowProc's.
  return DefWindowProcW(window, message, wparam, lparam);
}

/** Found where `icons_wanted` is set and read here: copied in whole, under the lock. */
RECT g_found_icons[wallpaper::kMaxIcons];

DWORD WINAPI read_icons_thread(void*) {
  SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  // Multithreaded: a call into Explorer here pumps no messages, and the
  // thread that reads the mouse never waits on one.
  if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) {
    note("icons-unavailable\n");
    return 0;
  }
  wallpaper::Held<IFolderView> view;
  bool reported = false;
  while (WaitForSingleObject(state.icons_wanted, INFINITE) == WAIT_OBJECT_0) {
    int count = 0;
    bool known = (view || wallpaper::desktop_folder_view(view)) &&
                 wallpaper::read_icons(*view.get(), state.list_view, g_found_icons, count);
    if (!known) {
      // A view kept from before may be one Explorer has since replaced.
      view.reset();
      known = wallpaper::desktop_folder_view(view) &&
              wallpaper::read_icons(*view.get(), state.list_view, g_found_icons, count);
    }
    AcquireSRWLockExclusive(&state.icons_lock);
    state.icons_known = known;
    state.icon_count = known ? count : 0;
    std::memcpy(state.icons, g_found_icons, sizeof(RECT) * static_cast<std::size_t>(state.icon_count));
    ReleaseSRWLockExclusive(&state.icons_lock);
    if (!known && !reported) {
      reported = true;
      note("icons-unavailable\n");
    }
  }
  return 0;
}

/** Something in the icons' list view changed: an icon added, moved or taken away. */
void CALLBACK on_icons_event(HWINEVENTHOOK, DWORD, HWND window, LONG, LONG, DWORD, DWORD) {
  if (window && window == state.list_view) SetEvent(state.icons_wanted);
}

/**
 * Whether this window hides what is behind it, rather than being drawn over
 * it. A see-through one — click-through, colour-keyed, faded, or painting its
 * own alpha per pixel as overlays and widgets do — leaves the desktop in
 * sight, and so does one on another virtual desktop (Windows cloaks those)
 * and the desktop's own windows.
 */
bool hides_desktop(HWND window) {
  if (window == state.surface || !IsWindowVisible(window) || IsIconic(window)) {
    return false;
  }
  const LONG_PTR extended = GetWindowLongPtrW(window, GWL_EXSTYLE);
  if ((extended & WS_EX_TRANSPARENT) != 0) return false;
  if ((extended & WS_EX_LAYERED) != 0) {
    COLORREF key = 0;
    BYTE alpha = 0;
    DWORD flags = 0;
    // A layered window with no attributes of its own paints per-pixel alpha.
    if (!GetLayeredWindowAttributes(window, &key, &alpha, &flags)) return false;
    if ((flags & LWA_COLORKEY) != 0) return false;
    if ((flags & LWA_ALPHA) != 0 && alpha < 255) return false;
  }
  DWORD cloaked = 0;
  if (SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_CLOAKED, &cloaked,
                                     sizeof(cloaked))) && cloaked != 0) return false;
  for (const auto* name : {L"Progman", L"WorkerW", L"SHELLDLL_DefView"}) {
    if (wallpaper::class_is(window, name)) return false;
  }
  return true;
}

struct Covering {
  RECT work{};
  RECT windows[64]{};
  int count = 0;
  // The same windows less the owner's, for `wallpaper::cover_of`: never more
  // of them than of `windows`, so the bound on that list holds for this one.
  RECT others[64]{};
  int other_count = 0;
  bool overflowed = false;
};

BOOL CALLBACK collect_covering(HWND window, LPARAM parameter) {
  auto& covering = *reinterpret_cast<Covering*>(parameter);
  RECT frame{};
  RECT overlap{};
  // Cheap first, and DWM last. Dragging a window sends one of these for every
  // step of the mouse, and a desk has a couple of hundred top-level windows
  // of which a handful are on this monitor: asking DWM about each one, as the
  // style and cloak checks do, is the whole cost of the walk. What DWM
  // reports is inside the window's own rectangle, so nothing that reaches
  // this monitor is dropped by measuring against that rectangle here.
  if (!IsWindowVisible(window) || IsIconic(window) ||
      !GetWindowRect(window, &frame) ||
      !IntersectRect(&overlap, &frame, &covering.work) ||
      !hides_desktop(window)) {
    return TRUE;
  }
  RECT bounds{};
  // DWM excludes the invisible resize border, which a window's own rectangle
  // includes: counted raw, a maximized window appears to cover more than it
  // does and every neighbouring monitor with it.
  if (SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS,
                                      &bounds, sizeof(bounds))) &&
      !IntersectRect(&overlap, &bounds, &covering.work)) {
    return TRUE;
  }
  if (covering.count == static_cast<int>(std::size(covering.windows))) {
    covering.overflowed = true;
    return FALSE;
  }
  covering.windows[covering.count++] = overlap;
  if (!wallpaper::owned_by(window, state.owner_pid)) {
    covering.others[covering.other_count++] = overlap;
  }
  return TRUE;
}

/**
 * Whether nothing of this monitor's desktop can be seen: every part of the
 * work area — the monitor minus its taskbar, which is not desktop and is
 * often see-through in front of it — is behind a window that hides it.
 *
 * A full-screen game is one such window. So are two ordinary windows side by
 * side, which is what a desk looks like most of the day, and drawing a
 * visualizer nobody can see is the GPU time this is here to give back.
 *
 * And whether the owner's own windows are what hides it (`cover_of`).
 */
wallpaper::Cover cover() {
  Covering covering;
  covering.work = state.work_rect;
  EnumWindows(collect_covering, reinterpret_cast<LPARAM>(&covering));
  if (covering.overflowed) return wallpaper::Cover::none;
  return wallpaper::cover_of(covering.work, covering.windows, covering.count,
                             covering.others, covering.other_count);
}

const char* cover_line(wallpaper::Cover cover) {
  switch (cover) {
    case wallpaper::Cover::owner: return "paused-owner\n";
    case wallpaper::Cover::others: return "paused\n";
    case wallpaper::Cover::none: break;
  }
  return "active\n";
}

void verify_attachment();

void apply_visibility() {
  if (!state.attached || state.finished) return;
  verify_attachment();
  if (state.finished) return;
  // Whether the background is on the desktop is the app's to say, and it says
  // it once: a monitor nothing of whose desktop is in sight is reported as
  // such and its page stops drawing, but the window stays where it is with
  // the picture it had. Hiding it here as well took it off a strip of desktop
  // that was still on screen while DWM animated the window that covered it.
  const UINT visibility_flag =
    state.requested_visible ? SWP_SHOWWINDOW : SWP_HIDEWINDOW;
  // Electron's ShowInactive path can restore a cached top-level placement and
  // enter initial-focus bookkeeping. Keep child visibility and z-order here.
  if (!SetWindowPos(state.surface, nullptr, 0, 0, 0, 0,
                    visibility_flag | SWP_NOACTIVATE | SWP_NOMOVE |
                    SWP_NOSIZE | SWP_NOZORDER)) fail("visibility-failed");
}

void visibility() {
  if (!state.attached || state.finished) return;
  const wallpaper::Cover now = cover();
  if (!state.reported_visibility || state.cover != now) {
    state.cover = now;
    state.reported_visibility = true;
    apply_visibility();
    if (state.finished) return;
    // Covered, the mouse stops at once — before main has heard of it.
    update_listening();
    if (state.finished) return;
    if (!line(cover_line(now))) {
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
  // The taskbar moving, hiding or growing changes the work area alone; the
  // background still covers the whole monitor, and only what counts as the
  // desktop being in sight moves with it.
  state.work_rect = info.rcWork;
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
  // The icons' list view tells of its items moving, arriving and going as
  // objects of its own: the list of where the icons are is read again.
  if (window && window == state.list_view) SetEvent(state.icons_wanted);
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
  // Any top-level window appearing, moving, resizing, minimizing or closing
  // can be the one that covered this monitor or uncovered it, so the whole
  // desk is looked at again. Windows sends these only when something actually
  // moved; the look itself is a walk of the top-level windows, once.
  if (event == EVENT_SYSTEM_FOREGROUND || event == EVENT_SYSTEM_MINIMIZESTART ||
      event == EVENT_SYSTEM_MINIMIZEEND ||
      (window && GetAncestor(window, GA_ROOT) == window)) visibility();
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
  // The mouse is passed on in this monitor's own pixels from its corner, and
  // the icons are found in the list view inside the shell's DefView. No list
  // view (a shell without one) leaves the desktop bare of icons to avoid.
  state.router.emplace(state.monitor_rect);
  state.list_view = FindWindowExW(state.desktop.icons, nullptr, L"SysListView32", nullptr);
  if (state.list_view) {
    HANDLE icons = CreateThread(nullptr, 0, read_icons_thread, nullptr, 0, nullptr);
    if (icons) {
      CloseHandle(icons);
    } else {
      note("icons-unavailable\n");
    }
  }
  if (!line("ready\n")) {
    state.finished = true;
    hide_owned();
    return;
  }
  visibility();
}

DWORD WINAPI read_input(void*) {
  char buffer[64];
  wallpaper::CommandReader reader;
  DWORD count = 0;
  // A bounded parser accepts only complete records (`CommandReader`). The
  // latest policy wins if main changes it several times before the UI thread
  // wakes.
  while (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer), &count, nullptr) &&
         count != 0) {
    for (DWORD index = 0; index < count; ++index) {
      switch (reader.feed(buffer[index])) {
        case wallpaper::Command::none: continue;
        case wallpaper::Command::show: state.requested_visibility.store(1); break;
        case wallpaper::Command::hide: state.requested_visibility.store(0); break;
        case wallpaper::Command::touch: state.requested_touch.store(1); break;
        case wallpaper::Command::still: state.requested_touch.store(0); break;
        case wallpaper::Command::invalid:
          state.invalid_command.store(true);
          SetEvent(state.input_changed);
          return 0;
      }
      SetEvent(state.input_changed);
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
  state.work_rect = monitor.rcWork;
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
  state.icons_wanted = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!state.shell || !state.input_closed || !state.input_changed || !state.icons_wanted) {
    fail("lifetime-unavailable"); return 1;
  }
  // Where Raw Input delivers the mouse while it is passed on: a message-only
  // window of this thread's, which nothing can see, focus or click.
  WNDCLASSW sink_class{};
  sink_class.lpfnWndProc = sink_procedure;
  sink_class.hInstance = GetModuleHandleW(nullptr);
  sink_class.lpszClassName = L"FluidEQWallpaperInput";
  if (!RegisterClassW(&sink_class)) { fail("input-unavailable"); return 1; }
  state.input_sink = CreateWindowExW(0, sink_class.lpszClassName, L"", 0, 0, 0, 0, 0,
                                     HWND_MESSAGE, nullptr, sink_class.hInstance, nullptr);
  if (!state.input_sink) { fail("input-unavailable"); return 1; }
  HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (!reader) { fail("input-unavailable"); return 1; }
  CloseHandle(reader);
  constexpr DWORD flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
  state.hooks = {
    SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_REORDER, nullptr, on_event, 0, 0, flags),
    SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_PARENTCHANGE, nullptr, on_event, 0, 0, flags),
    // An icon arriving on the desktop, from Explorer alone: every other
    // window being created anywhere is nothing this helper has to look at.
    SetWinEventHook(EVENT_OBJECT_CREATE, EVENT_OBJECT_CREATE, nullptr, on_icons_event,
                    state.desktop.pid, 0, flags)
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
      state.touch_requested = state.requested_touch.load() == 1;
      apply_visibility();
      update_listening();
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
