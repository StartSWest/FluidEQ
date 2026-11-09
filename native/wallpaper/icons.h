// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

#include <windows.h>
// Under WIN32_LEAN_AND_MEAN the OLE types exdisp.h is written against are
// missing; ole2.h and shlobj.h bring them first.
#include <ole2.h>
#include <shlobj.h>
#include <exdisp.h>
#include <shlguid.h>

/**
 * Where the desktop's icons are, so a press on one never reaches the scene.
 *
 * Asked of Explorer's own view of the desktop through the shell's documented
 * interfaces — the desktop's `IFolderView`, found through `IShellWindows`
 * (Raymond Chen, "Manipulating the positions of desktop icons", The Old New
 * Thing). Not `LVM_HITTEST` on the icons' list view: that message
 * carries a pointer, and answering it across processes needs memory written
 * into Explorer, which is what security software rightly watches for.
 *
 * Read on a thread of its own and kept: a cross-process call may wait on
 * Explorer, and the thread that reads the mouse must never. The list is read
 * again whenever the icons' list view says something in it changed, and after
 * every release over the desktop, which is how icons are dragged.
 */
namespace wallpaper {

/** More icons than any desktop holds; the rest are not looked at. */
constexpr int kMaxIcons = 1024;

/** Releases a COM interface when it goes out of scope. */
template <class T>
class Held {
 public:
  Held() = default;
  Held(const Held&) = delete;
  Held& operator=(const Held&) = delete;
  ~Held() { reset(); }
  T** put() {
    reset();
    return &pointer_;
  }
  T* operator->() const { return pointer_; }
  T* get() const { return pointer_; }
  explicit operator bool() const { return pointer_ != nullptr; }
  void reset() {
    if (pointer_) pointer_->Release();
    pointer_ = nullptr;
  }

 private:
  T* pointer_ = nullptr;
};

/** The desktop's own folder view, or false when Explorer will not give one. */
inline bool desktop_folder_view(Held<IFolderView>& view) {
  Held<IShellWindows> windows;
  if (FAILED(CoCreateInstance(CLSID_ShellWindows, nullptr, CLSCTX_LOCAL_SERVER,
                              IID_PPV_ARGS(windows.put())))) return false;
  VARIANT location{};
  location.vt = VT_I4;
  location.lVal = CSIDL_DESKTOP;
  VARIANT empty{};
  long handle = 0;
  Held<IDispatch> dispatch;
  if (windows->FindWindowSW(&location, &empty, SWC_DESKTOP, &handle,
                            SWFO_NEEDDISPATCH, dispatch.put()) != S_OK ||
      !dispatch) return false;
  Held<IServiceProvider> services;
  if (FAILED(dispatch->QueryInterface(IID_PPV_ARGS(services.put())))) return false;
  Held<IShellBrowser> browser;
  if (FAILED(services->QueryService(SID_STopLevelBrowser, IID_PPV_ARGS(browser.put())))) {
    return false;
  }
  Held<IShellView> shell_view;
  if (FAILED(browser->QueryActiveShellView(shell_view.put())) || !shell_view) return false;
  return SUCCEEDED(shell_view->QueryInterface(IID_PPV_ARGS(view.put())));
}

/**
 * Every icon's rectangle in physical screen pixels: its place in the view,
 * one cell of the view's spacing across, mapped out of the list view's client
 * area. A cell is a little wider than the icon and its label; erring that
 * way only keeps the scene from hearing a press just beside an icon.
 */
inline bool read_icons(IFolderView& view, HWND list_view, RECT* rects, int& count) {
  count = 0;
  POINT spacing{};
  if (FAILED(view.GetSpacing(&spacing)) || spacing.x <= 0 || spacing.y <= 0) return false;
  Held<IEnumIDList> items;
  if (FAILED(view.Items(SVGIO_ALLVIEW, IID_PPV_ARGS(items.put()))) || !items) return false;
  PITEMID_CHILD item = nullptr;
  while (count < kMaxIcons && items->Next(1, &item, nullptr) == S_OK) {
    POINT place{};
    const bool placed = SUCCEEDED(view.GetItemPosition(item, &place));
    CoTaskMemFree(item);
    if (!placed) continue;
    POINT corners[2]{place, {place.x + spacing.x, place.y + spacing.y}};
    SetLastError(ERROR_SUCCESS);
    if (MapWindowPoints(list_view, nullptr, corners, 2) == 0 &&
        GetLastError() != ERROR_SUCCESS) return false;
    rects[count++] = RECT{corners[0].x, corners[0].y, corners[1].x, corners[1].y};
  }
  return true;
}

}  // namespace wallpaper
