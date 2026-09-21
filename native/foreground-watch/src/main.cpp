/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * Which program is in front, and which programs are open.
 *
 * Game profiles switch the sound when a game comes to the front, so the app
 * has to be told the moment it does. Windows says so itself —
 * `EVENT_SYSTEM_FOREGROUND` through `SetWinEventHook` — and this is the
 * process that listens, because Electron cannot: Node has no way to ask which
 * window is in front, and asking every second would be a clock guessing at
 * something Windows already announces.
 *
 * It runs only while there are game profiles to match, it holds no state of
 * its own, and it exits when its input closes, which is also what happens
 * when FluidEQ ends however it ends — no parent watching, no timer, nothing
 * left behind at logon.
 *
 * The protocol is one record a line, tab between the fields. A path can hold
 * spaces and a semicolon; it cannot hold a tab or a newline.
 *
 *   out: front <tab> pid <tab> rect <tab> name <tab> path  what came to the front
 *   in:  list                                        which programs are open?
 *   out: open <tab> pid <tab> rect <tab> name <tab> path   one each, then:
 *   out: listed                                      the end of that answer
 *   in:  hold <space> pid                            tell me when this ends
 *   out: gone <tab> pid                              it ended
 *
 * `hold` is how a game keeps its sound while somebody alt-tabs out of it: the
 * app asks to be told when that program actually ends, rather than treating
 * the loss of the foreground as the end of the game. One at a time — the app
 * plays one game's sound at a time — and `hold 0` stops holding. A process
 * that has already ended answers `gone` at once. Waiting on it costs nothing
 * and no thread: the process handle is signalled when it exits, so it joins
 * the same wait as everything else here. Nothing polls.
 *
 * `rect` is the window's place on the desktop as `x,y,w,h` in real pixels, so
 * a card about the game can be shown on the screen the game is on rather than
 * wherever the mouse happens to be; it is empty where the window would not
 * say. `name` is the executable's own description — "Forza Horizon 6", not
 * "ForzaHorizon6.exe" — and is empty where the file carries none. The first
 * record is sent without being asked: what is in front at the moment this
 * starts.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <dwmapi.h>
#include <psapi.h>

#include <atomic>
#include <cwctype>
#include <cstdio>
#include <cstring>
#include <set>
#include <string>
#include <vector>

namespace {

struct State {
  HANDLE input_closed = nullptr;
  /** Something was asked for; which it was, the flags below say. */
  HANDLE asked = nullptr;
  std::atomic<bool> list_wanted{false};
  std::atomic<bool> hold_wanted{false};
  std::atomic<DWORD> hold_pid{0};
  std::atomic<bool> bad_command{false};
  DWORD reported = 0;
};

State state;

/** UTF-8, because every name that reaches the app goes through JSON. */
std::string utf8_of(const std::wstring& wide) {
  if (wide.empty()) {
    return {};
  }
  const int size = WideCharToMultiByte(CP_UTF8, 0, wide.c_str(),
                                       static_cast<int>(wide.size()), nullptr,
                                       0, nullptr, nullptr);
  if (size <= 0) {
    return {};
  }
  std::string out(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), static_cast<int>(wide.size()),
                      out.data(), size, nullptr, nullptr);
  return out;
}

/** Tabs and newlines would end the field early; a description may hold both. */
std::string one_field(const std::wstring& wide) {
  std::string text = utf8_of(wide);
  for (char& value : text) {
    if (value == '\t' || value == '\r' || value == '\n') {
      value = ' ';
    }
  }
  return text;
}

void say(const std::string& line) {
  std::fputs(line.c_str(), stdout);
  std::fputc('\n', stdout);
  std::fflush(stdout);
}

std::wstring image_of(DWORD pid) {
  const HANDLE process =
      OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process == nullptr) {
    return {};
  }
  wchar_t buffer[MAX_PATH * 2]{};
  DWORD length = static_cast<DWORD>(std::size(buffer));
  const bool read = QueryFullProcessImageNameW(process, 0, buffer, &length) != 0;
  CloseHandle(process);
  return read ? std::wstring(buffer, length) : std::wstring{};
}

/**
 * What the file calls itself, which is what Task Manager and a player call it.
 * Its own translation is asked for first and English second: a game shipped
 * in one language carries one, and taking the first translation blindly named
 * a Japanese release in a language nobody reading this list had chosen.
 */
std::wstring description_of(const std::wstring& path) {
  if (path.empty()) {
    return {};
  }
  DWORD ignored = 0;
  const DWORD size = GetFileVersionInfoSizeW(path.c_str(), &ignored);
  if (size == 0) {
    return {};
  }
  std::vector<unsigned char> block(size);
  if (!GetFileVersionInfoW(path.c_str(), 0, size, block.data())) {
    return {};
  }
  struct Translation {
    WORD language;
    WORD page;
  };
  Translation* translations = nullptr;
  UINT bytes = 0;
  if (!VerQueryValueW(block.data(), L"\\VarFileInfo\\Translation",
                      reinterpret_cast<void**>(&translations), &bytes) ||
      translations == nullptr || bytes < sizeof(Translation)) {
    return {};
  }
  const std::size_t count = bytes / sizeof(Translation);
  for (std::size_t at = 0; at < count; ++at) {
    wchar_t key[64]{};
    std::swprintf(key, std::size(key),
                  L"\\StringFileInfo\\%04x%04x\\FileDescription",
                  translations[at].language, translations[at].page);
    wchar_t* value = nullptr;
    UINT length = 0;
    if (VerQueryValueW(block.data(), key, reinterpret_cast<void**>(&value),
                       &length) &&
        value != nullptr && length > 1) {
      return std::wstring(value, length - 1);
    }
  }
  return {};
}

bool is_frame_host(const std::wstring& path) {
  static const std::wstring host = L"\\applicationframehost.exe";
  if (path.size() < host.size()) {
    return false;
  }
  std::wstring tail = path.substr(path.size() - host.size());
  for (wchar_t& value : tail) {
    value = static_cast<wchar_t>(towlower(value));
  }
  return tail == host;
}

struct FrameSearch {
  DWORD frame;
  DWORD found;
};

BOOL CALLBACK on_frame_child(HWND child, LPARAM parameter) {
  wchar_t name[64]{};
  GetClassNameW(child, name, static_cast<int>(std::size(name)));
  if (std::wcscmp(name, L"Windows.UI.Core.CoreWindow") != 0) {
    return TRUE;
  }
  DWORD pid = 0;
  GetWindowThreadProcessId(child, &pid);
  auto* search = reinterpret_cast<FrameSearch*>(parameter);
  if (pid == 0 || pid == search->frame) {
    return TRUE;
  }
  search->found = pid;
  return FALSE;
}

/**
 * The program somebody would name, not the window's owner.
 *
 * A store app — which is how Game Pass installs a game — draws inside a frame
 * belonging to Windows' own `ApplicationFrameHost.exe`, and that is the
 * process the foreground event names. Without this every game bought from the
 * Microsoft Store came up as "Application Frame Host", all of them alike, and
 * a profile could be attached to none of them. The app itself owns the
 * `CoreWindow` inside that frame.
 */
DWORD program_of(HWND window, DWORD pid) {
  if (window == nullptr || !is_frame_host(image_of(pid))) {
    return pid;
  }
  FrameSearch search{pid, pid};
  EnumChildWindows(window, on_frame_child, reinterpret_cast<LPARAM>(&search));
  return search.found;
}

/** Where the window sits on the desktop, so a card can be shown on its own
 *  screen rather than wherever the mouse happens to be. */
std::string where(HWND window) {
  RECT rect{};
  if (window == nullptr || !GetWindowRect(window, &rect)) {
    return {};
  }
  return std::to_string(rect.left) + ',' + std::to_string(rect.top) + ',' +
         std::to_string(rect.right - rect.left) + ',' +
         std::to_string(rect.bottom - rect.top);
}

void report(const char* kind, DWORD pid, HWND window) {
  const std::wstring path = image_of(pid);
  if (path.empty()) {
    return;
  }
  std::string line = kind;
  line.push_back('\t');
  line.append(std::to_string(pid));
  line.push_back('\t');
  line.append(where(window));
  line.push_back('\t');
  line.append(one_field(description_of(path)));
  line.push_back('\t');
  line.append(one_field(path));
  say(line);
}

void CALLBACK on_foreground(HWINEVENTHOOK, DWORD event, HWND window,
                            LONG object, LONG child, DWORD, DWORD) {
  if (event != EVENT_SYSTEM_FOREGROUND || object != OBJID_WINDOW ||
      child != CHILDID_SELF || window == nullptr) {
    return;
  }
  DWORD pid = 0;
  GetWindowThreadProcessId(window, &pid);
  pid = program_of(window, pid);
  // The same program raises several of its windows in a row — a launcher, a
  // splash, then the game — and a profile that switched on every one of them
  // would rewrite the whole rack three times for one launch.
  if (pid == 0 || pid == state.reported) {
    return;
  }
  state.reported = pid;
  report("front", pid, window);
}

/** A window somebody could alt-tab to: what belongs in a list to pick from. */
bool is_a_program_window(HWND window) {
  if (!IsWindowVisible(window) || GetWindow(window, GW_OWNER) != nullptr ||
      GetWindowTextLengthW(window) == 0) {
    return false;
  }
  if ((GetWindowLongPtrW(window, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) {
    return false;
  }
  // A store app that is not running is still a window, cloaked. Listing those
  // offered every app the machine has ever opened.
  BOOL cloaked = FALSE;
  if (SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_CLOAKED, &cloaked,
                                      sizeof(cloaked))) &&
      cloaked != FALSE) {
    return false;
  }
  return true;
}

BOOL CALLBACK on_window(HWND window, LPARAM parameter) {
  auto* seen = reinterpret_cast<std::set<DWORD>*>(parameter);
  if (!is_a_program_window(window)) {
    return TRUE;
  }
  DWORD pid = 0;
  GetWindowThreadProcessId(window, &pid);
  pid = program_of(window, pid);
  if (pid == 0 || pid == GetCurrentProcessId() || !seen->insert(pid).second) {
    return TRUE;
  }
  report("open", pid, window);
  return TRUE;
}

void answer_list() {
  std::set<DWORD> seen;
  EnumWindows(on_window, reinterpret_cast<LPARAM>(&seen));
  say("listed");
}

/**
 * One command, already whole.
 *
 * Anything that is not a command this knows ends the helper rather than being
 * ignored: the only thing writing here is FluidEQ, so a line nobody
 * recognises means the two sides disagree about the protocol, and carrying on
 * would mean answering a question that was never asked.
 */
bool take_command(const char* command, std::size_t used) {
  if (used == 4 && std::memcmp(command, "list", 4) == 0) {
    state.list_wanted.store(true);
    return true;
  }
  if (used > 5 && std::memcmp(command, "hold ", 5) == 0) {
    DWORD pid = 0;
    for (std::size_t at = 5; at < used; ++at) {
      if (command[at] < '0' || command[at] > '9') {
        return false;
      }
      pid = pid * 10 + static_cast<DWORD>(command[at] - '0');
    }
    state.hold_pid.store(pid);
    state.hold_wanted.store(true);
    return true;
  }
  return false;
}

DWORD WINAPI read_input(void*) {
  char buffer[64]{};
  // Room for "hold " and every pid Windows can produce.
  char command[24]{};
  std::size_t used = 0;
  DWORD count = 0;
  while (ReadFile(GetStdHandle(STD_INPUT_HANDLE), buffer, sizeof(buffer),
                  &count, nullptr) &&
         count != 0) {
    for (DWORD at = 0; at < count; ++at) {
      const char value = buffer[at];
      if (value == '\r') {
        continue;
      }
      if (value == '\n') {
        if (take_command(command, used)) {
          used = 0;
          SetEvent(state.asked);
          continue;
        }
        state.bad_command.store(true);
        SetEvent(state.asked);
        return 0;
      }
      if (used >= sizeof(command)) {
        state.bad_command.store(true);
        SetEvent(state.asked);
        return 0;
      }
      command[used++] = value;
    }
  }
  SetEvent(state.input_closed);
  return 0;
}

/**
 * Start waiting on the program the app named, in place of whatever was held.
 *
 * A process handle is signalled when the process ends, so the wait costs a
 * handle and nothing else. One that cannot be opened has already ended —
 * answered at once, because the app is waiting to hear it either way.
 */
HANDLE hold_process(HANDLE held, DWORD* held_pid) {
  if (held != nullptr) {
    CloseHandle(held);
  }
  *held_pid = 0;
  const DWORD wanted = state.hold_pid.load();
  if (wanted == 0) {
    return nullptr;
  }
  const HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, wanted);
  if (process == nullptr) {
    say("gone\t" + std::to_string(wanted));
    return nullptr;
  }
  *held_pid = wanted;
  return process;
}

int run() {
  state.input_closed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  state.asked = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (state.input_closed == nullptr || state.asked == nullptr) {
    return 1;
  }
  const HANDLE reader = CreateThread(nullptr, 0, read_input, nullptr, 0, nullptr);
  if (reader == nullptr) {
    return 1;
  }
  CloseHandle(reader);
  const HWINEVENTHOOK hook = SetWinEventHook(
      EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, on_foreground,
      0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
  if (hook == nullptr) {
    return 1;
  }
  // What is already in front, before anything changes: the app has just been
  // told to watch, and the game it is meant to match may be running now.
  const HWND front = GetForegroundWindow();
  if (front != nullptr) {
    DWORD pid = 0;
    GetWindowThreadProcessId(front, &pid);
    pid = program_of(front, pid);
    if (pid != 0) {
      state.reported = pid;
      report("front", pid, front);
    }
  }
  HANDLE held = nullptr;
  DWORD held_pid = 0;
  bool finished = false;
  while (!finished) {
    // The held game's own handle is the third thing waited on, while there is
    // one: its exit is an event like any other here, never a check on a clock.
    HANDLE handles[]{state.input_closed, state.asked, held};
    const DWORD result = MsgWaitForMultipleObjectsEx(
        held != nullptr ? 3 : 2, handles, INFINITE, QS_ALLINPUT,
        MWMO_INPUTAVAILABLE);
    if (result == WAIT_OBJECT_0 || result == WAIT_FAILED) {
      break;
    }
    if (result == WAIT_OBJECT_0 + 1) {
      if (state.bad_command.load()) {
        break;
      }
      if (state.list_wanted.exchange(false)) {
        answer_list();
      }
      if (state.hold_wanted.exchange(false)) {
        held = hold_process(held, &held_pid);
      }
    }
    if (held != nullptr && result == WAIT_OBJECT_0 + 2) {
      say("gone\t" + std::to_string(held_pid));
      CloseHandle(held);
      held = nullptr;
      held_pid = 0;
    }
    MSG message{};
    while (!finished && PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
      if (message.message == WM_QUIT) {
        finished = true;
        break;
      }
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
  }
  if (held != nullptr) {
    CloseHandle(held);
  }
  UnhookWinEvent(hook);
  return 0;
}

}  // namespace

int main() { return run(); }
