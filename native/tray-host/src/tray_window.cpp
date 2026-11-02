/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "tray_window.h"

#include <shellapi.h>
#include <shellscalingapi.h>
#include <windowsx.h>

#include <cwchar>
#include <vector>

#include "icon_images.h"

namespace feq::tray {
namespace {

constexpr wchar_t kClassName[] = L"FluidEQ-Tray-Window";
/** The shell's calls about the icon: clicks, the menu key. */
constexpr UINT kNotifyMessage = WM_APP + 1;
/** A state is waiting in the mailbox. */
constexpr UINT kStateMessage = WM_APP + 2;
constexpr UINT kCloseMessage = WM_APP + 3;
constexpr UINT kIconId = 1;

/**
 * The icon's size at the system's scale, which is what the notification
 * area draws at: `GetSystemMetrics(SM_CXSMICON)` in a DPI-unaware process,
 * which is what Electron's tray asked for. Read once a process; a scale
 * changed later reaches the tray at the next sign-in, as it does every
 * per-monitor program's system metrics.
 */
int notification_icon_size() {
  return GetSystemMetricsForDpi(SM_CXSMICON, GetDpiForSystem());
}

/** Windows' build number, which the version helpers hide from programs
 * without a manifest naming the newest Windows. */
DWORD windows_build() {
  using GetVersion = LONG(WINAPI*)(OSVERSIONINFOW*);
  const HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  const auto get = ntdll != nullptr ? reinterpret_cast<GetVersion>(reinterpret_cast<void*>(
                                          GetProcAddress(ntdll, "RtlGetVersion")))
                                    : nullptr;
  OSVERSIONINFOW version{};
  version.dwOSVersionInfoSize = sizeof(version);
  return get != nullptr && get(&version) == 0 ? version.dwBuildNumber : 0;
}

/**
 * uxtheme's unnamed export `ordinal`, or null. Only from Windows 10 1809
 * (17763), where the ones used here first stood at these numbers.
 */
template <class Function>
Function uxtheme_export(int ordinal) {
  // Loaded once and kept: every menu the process opens draws through it.
  static const HMODULE uxtheme =
      windows_build() >= 17763
          ? LoadLibraryExW(L"uxtheme.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32)
          : nullptr;
  return uxtheme == nullptr
             ? nullptr
             : reinterpret_cast<Function>(reinterpret_cast<void*>(
                   GetProcAddress(uxtheme, MAKEINTRESOURCEA(ordinal))));
}

/** The next menu opened is drawn in the app mode Windows has now. */
void flush_menu_themes() {
  if (const auto flush = uxtheme_export<void(WINAPI*)()>(136)) {
    flush();
  }
}

/**
 * The menu dark while Windows' apps are dark, as the one Electron drew
 * followed it. A Win32 menu follows the app mode only in a process that asks,
 * through uxtheme's unnamed exports: `SetPreferredAppMode` (135; on 1809
 * `AllowDarkModeForApp`, for which 1 is the same request),
 * `RefreshImmersiveColorPolicyState` (104), `AllowDarkModeForWindow` (133)
 * on the menu's owner and `FlushMenuThemes` (136) — the sequence Notepad++
 * and Windows Terminal use. Where any is missing the menu stays light.
 */
void follow_app_mode(HWND owner) {
  constexpr int kAllowDark = 1;
  if (const auto set_mode = uxtheme_export<int(WINAPI*)(int)>(135)) {
    set_mode(kAllowDark);
  }
  if (const auto refresh = uxtheme_export<void(WINAPI*)()>(104)) {
    refresh();
  }
  if (const auto allow = uxtheme_export<BOOL(WINAPI*)(HWND, BOOL)>(133)) {
    allow(owner, TRUE);
  }
  flush_menu_themes();
}

/** The scale of the monitor the menu opens on, for its marks. */
UINT dpi_at(POINT point) {
  UINT x = USER_DEFAULT_SCREEN_DPI;
  UINT y = USER_DEFAULT_SCREEN_DPI;
  const HMONITOR monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST);
  if (FAILED(GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &x, &y))) {
    return GetDpiForSystem();
  }
  return x;
}

}  // namespace

TrayWindow::TrayWindow(Events events) : events_(std::move(events)) {}

std::unique_ptr<TrayWindow> TrayWindow::create(HINSTANCE instance, Events events) {
  WNDCLASSEXW type{};
  type.cbSize = sizeof(type);
  type.lpfnWndProc = &TrayWindow::procedure;
  type.hInstance = instance;
  type.lpszClassName = kClassName;
  if (RegisterClassExW(&type) == 0 &&
      GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
    return nullptr;
  }
  std::unique_ptr<TrayWindow> tray(new TrayWindow(std::move(events)));
  // Never shown: an overlapped window that is never given WS_VISIBLE.
  if (CreateWindowExW(0, kClassName, L"FluidEQ", WS_OVERLAPPED, 0, 0, 0, 0,
                      nullptr, nullptr, instance, tray.get()) == nullptr) {
    return nullptr;
  }
  tray->target_ = tray->window_;
  follow_app_mode(tray->window_);
  tray->taskbar_created_ = RegisterWindowMessageW(L"TaskbarCreated");
  // A tray started from an elevated FluidEQ is elevated too, and Explorer's
  // messages reach it from a lower integrity level only where allowed: its
  // clicks on the icon, and its word that it came back.
  ChangeWindowMessageFilterEx(tray->window_, kNotifyMessage, MSGFLT_ALLOW,
                              nullptr);
  ChangeWindowMessageFilterEx(tray->window_, tray->taskbar_created_,
                              MSGFLT_ALLOW, nullptr);
  return tray;
}

TrayWindow::~TrayWindow() {
  if (window_ != nullptr) {
    take_icon_down();
    SetWindowLongPtrW(window_, GWLP_USERDATA, 0);
    DestroyWindow(window_);
  }
  if (icon_ != nullptr) {
    DestroyIcon(icon_);
  }
}

void TrayWindow::show(TrayState state) {
  {
    const std::lock_guard<std::mutex> hold(mailbox_lock_);
    mailbox_ = std::move(state);
  }
  PostMessageW(target_, kStateMessage, 0, 0);
}

void TrayWindow::close() { PostMessageW(target_, kCloseMessage, 0, 0); }

LRESULT CALLBACK TrayWindow::procedure(HWND window, UINT message, WPARAM w,
                                       LPARAM l) {
  if (message == WM_NCCREATE) {
    auto* self = static_cast<TrayWindow*>(
        reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);
    self->window_ = window;
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
  }
  auto* self =
      reinterpret_cast<TrayWindow*>(GetWindowLongPtrW(window, GWLP_USERDATA));
  LRESULT result = 0;
  if (self != nullptr && self->handle(message, w, l, &result)) {
    return result;
  }
  return DefWindowProcW(window, message, w, l);
}

bool TrayWindow::handle(UINT message, WPARAM w, LPARAM l, LRESULT* result) {
  if (message == kStateMessage) {
    take_state();
    return true;
  }
  if (message == kCloseMessage) {
    take_icon_down();
    DestroyWindow(window_);
    return true;
  }
  if (message == WM_DESTROY) {
    take_icon_down();
    SetWindowLongPtrW(window_, GWLP_USERDATA, 0);
    window_ = nullptr;
    PostQuitMessage(0);
    return true;
  }
  if (message == kNotifyMessage) {
    // NOTIFYICON_VERSION_4: the event in the low word, the anchor in w.
    switch (LOWORD(l)) {
      case NIN_SELECT:
      case NIN_KEYSELECT:
        if (events_.pressed) {
          events_.pressed("open");
        }
        break;
      case WM_CONTEXTMENU:
        open_menu(GET_X_LPARAM(w), GET_Y_LPARAM(w));
        break;
      default:
        break;
    }
    return true;
  }
  if (message == taskbar_created_ && taskbar_created_ != 0) {
    // Explorer restarted, and every icon went with it.
    added_ = false;
    put_icon();
    return true;
  }
  if (message == WM_SETTINGCHANGE && l != 0 &&
      std::wcscmp(reinterpret_cast<const wchar_t*>(l), L"ImmersiveColorSet") == 0) {
    // Windows' apps changed between light and dark: the next menu follows.
    flush_menu_themes();
    return false;
  }
  if (message == WM_QUERYENDSESSION) {
    *result = TRUE;
    return true;
  }
  if (message == WM_ENDSESSION) {
    // After this returns the process can be ended at any moment, so what has
    // to happen happens inside it.
    if (w != FALSE && events_.session_ending) {
      events_.session_ending();
      take_icon_down();
    }
    return true;
  }
  return false;
}

void TrayWindow::take_state() {
  std::optional<TrayState> next;
  {
    const std::lock_guard<std::mutex> hold(mailbox_lock_);
    next.swap(mailbox_);
  }
  if (!next) {
    return;
  }
  // An icon that cannot be read keeps the one on screen: an empty image
  // would make the whole icon disappear, which is worse than a stale mark.
  if (next->icon != icon_path_) {
    load_icon_for(next->icon);
  }
  state_ = std::move(*next);
  put_icon();
}

void TrayWindow::load_icon_for(const std::wstring& path) {
  const HICON loaded = load_icon(path, notification_icon_size());
  if (loaded == nullptr) {
    return;
  }
  if (icon_ != nullptr) {
    DestroyIcon(icon_);
  }
  icon_ = loaded;
  icon_path_ = path;
}

void TrayWindow::put_icon() {
  if (icon_ == nullptr) {
    return;
  }
  NOTIFYICONDATAW data{};
  data.cbSize = sizeof(data);
  data.hWnd = window_;
  data.uID = kIconId;
  data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
  data.uCallbackMessage = kNotifyMessage;
  data.hIcon = icon_;
  wcsncpy_s(data.szTip, state_.tooltip.c_str(), _TRUNCATE);
  if (added_) {
    Shell_NotifyIconW(NIM_MODIFY, &data);
    return;
  }
  // Fails while there is no taskbar yet — a start with Windows can come
  // before Explorer's — and `TaskbarCreated` puts it up when there is one.
  if (Shell_NotifyIconW(NIM_ADD, &data) == FALSE) {
    return;
  }
  added_ = true;
  data.uVersion = NOTIFYICON_VERSION_4;
  Shell_NotifyIconW(NIM_SETVERSION, &data);
}

void TrayWindow::take_icon_down() {
  if (!added_) {
    return;
  }
  NOTIFYICONDATAW data{};
  data.cbSize = sizeof(data);
  data.hWnd = window_;
  data.uID = kIconId;
  Shell_NotifyIconW(NIM_DELETE, &data);
  added_ = false;
}

void TrayWindow::open_menu(int x, int y) {
  // What was on the menu when it opened: a state arriving while it is open
  // is drawn by the modal loop, and must not change what a press means.
  const std::vector<MenuItem> items = state_.menu;
  if (items.empty()) {
    return;
  }
  const HMENU menu = CreatePopupMenu();
  if (menu == nullptr) {
    return;
  }
  const int mark = GetSystemMetricsForDpi(SM_CXSMICON, dpi_at(POINT{x, y}));
  std::vector<HBITMAP> marks;
  UINT command = 1;
  for (const auto& item : items) {
    MENUITEMINFOW info{};
    info.cbSize = sizeof(info);
    info.fMask = MIIM_ID | MIIM_STRING | MIIM_FTYPE;
    info.fType = MFT_STRING;
    info.wID = command;
    command += 1;
    std::wstring label = item.label;
    info.dwTypeData = label.data();
    if (const HBITMAP bitmap = load_menu_bitmap(item.icon, mark)) {
      info.fMask |= MIIM_BITMAP;
      info.hbmpItem = bitmap;
      marks.push_back(bitmap);
    }
    InsertMenuItemW(menu, static_cast<UINT>(GetMenuItemCount(menu)), TRUE, &info);
    if (item.separator_after) {
      AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    }
  }
  // The menu closes on a click elsewhere only while its owner is in front.
  SetForegroundWindow(window_);
  // At the anchor, as Microsoft's own notification-icon sample places it;
  // Windows moves a menu that does not fit there to where it does.
  const UINT align = GetSystemMetrics(SM_MENUDROPALIGNMENT) != 0
                         ? TPM_RIGHTALIGN
                         : TPM_LEFTALIGN;
  const UINT chosen = static_cast<UINT>(TrackPopupMenuEx(
      menu, TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON | align, x, y,
      window_, nullptr));
  // And a second open works only once the menu's own loop has seen a message.
  PostMessageW(window_, WM_NULL, 0, 0);
  DestroyMenu(menu);
  for (const HBITMAP bitmap : marks) {
    DeleteObject(bitmap);
  }
  if (chosen >= 1 && chosen <= items.size() && events_.pressed) {
    events_.pressed(items[chosen - 1].id);
  }
}

}  // namespace feq::tray
