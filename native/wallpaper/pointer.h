// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

#include <windows.h>
#include <cstddef>
#include <cstdio>
#include <initializer_list>

/**
 * What the helper tells FluidEQ about the mouse over its monitor's bare
 * desktop, so the scene there answers the hand the way it does in the app.
 *
 * Windows never delivers input to the background: it sits behind the icons,
 * and Explorer's list view takes every press. So the helper reads the mouse
 * through Raw Input, which only observes — Explorer still gets every click,
 * drag and right click exactly as before, and nothing here can delay the
 * mouse for the rest of the machine the way a low-level hook can — and
 * passes on what happened over its own monitor's bare desktop alone.
 *
 * The router is the decision, apart from Windows so it can be tested: given
 * one mouse report, where the cursor is and whether that spot is bare desktop,
 * it writes the records for it. A press that began on the bare desktop is
 * followed wherever it goes until it is let go, as a captured pointer is in a
 * page; one that began on an icon, a window or the taskbar is never passed
 * on, and neither is its release.
 */
namespace wallpaper {

/** The buttons the way a page's `PointerEvent.buttons` numbers them. */
enum : unsigned {
  kLeftButton = 1,
  kRightButton = 2,
  kMiddleButton = 4,
  kAllButtons = kLeftButton | kRightButton | kMiddleButton,
};

/** One mouse report, as the helper sees it once Windows has moved the cursor. */
struct PointerSample {
  /** Where the cursor is, in physical screen pixels. */
  POINT at{};
  /** That spot is this monitor's desktop, with no icon, window or taskbar on it. */
  bool bare = false;
  /**
   * The camera key (`camera-key`, Ctrl unless the listener chose another) was
   * down at the moment of the report. The record still calls it the Ctrl bit.
   */
  bool camera = false;
  /** Buttons that went down, and up, in this report (`kLeftButton`...). */
  unsigned downs = 0;
  unsigned ups = 0;
  /** The wheel, in Windows' units: 120 a notch, positive away from the hand. */
  int wheel = 0;
};

/** The longest record: `pointer:wheel -2147483648 -2147483648 1 7 -32768\n`. */
constexpr int kMaxPointerRecord = 64;

/** The `button` a page gives the button `bit`: 0 left, 1 middle, 2 right. */
inline int page_button(unsigned bit) {
  if (bit == kLeftButton) return 0;
  return bit == kMiddleButton ? 1 : 2;
}

class PointerRouter {
 public:
  explicit PointerRouter(const RECT& monitor) : monitor_(monitor) {}

  /**
   * The records for one report, each handed to `emit` as one line. A move
   * comes first, then any releases, then any presses, then the wheel: the
   * order a page hears them in for one hardware report.
   */
  template <class Emit>
  void feed(const PointerSample& sample, Emit&& emit) {
    const bool moved = !placed_ || sample.at.x != last_.x || sample.at.y != last_.y;
    last_ = sample.at;
    placed_ = true;
    // An icon being dragged, or a window, crosses the bare desktop with its
    // button down: that hand is busy with something else, and the scene under
    // it hears nothing until it lets go.
    if (held_ != 0) {
      if (moved) line(emit, "move", sample, nullptr);
    } else if (sample.bare && foreign_ == 0) {
      if (moved || !inside_) line(emit, "move", sample, nullptr);
      inside_ = true;
    }
    for (const unsigned bit : {kLeftButton, kMiddleButton, kRightButton}) {
      if ((sample.ups & bit) == 0 || (held_ & bit) == 0) continue;
      held_ &= ~bit;
      const int button = page_button(bit);
      line(emit, "up", sample, &button);
    }
    foreign_ &= ~sample.ups;
    const bool open = sample.bare && foreign_ == 0;
    // Off the bare desktop with nothing held — moved there, let go there, or
    // something now stands under a still pointer — the page hears it leave.
    if (held_ == 0 && inside_ && !open) leave(emit);
    for (const unsigned bit : {kLeftButton, kMiddleButton, kRightButton}) {
      if ((sample.downs & bit) == 0) continue;
      // A captured pointer hears every button, wherever it is pressed.
      if (held_ == 0 && !open) {
        foreign_ |= bit;
        continue;
      }
      held_ |= bit;
      inside_ = true;
      const int button = page_button(bit);
      line(emit, "down", sample, &button);
    }
    if (sample.wheel != 0 && (held_ != 0 || (sample.bare && foreign_ == 0))) {
      inside_ = true;
      line(emit, "wheel", sample, &sample.wheel);
    }
  }

  /**
   * Nothing is passed on from here: the background paused, was covered or
   * hidden, or the listener turned the mouse off. The page hears the pointer
   * leave and forgets any press it held — never a release, which a page
   * would read as a tap where the hand never let go.
   */
  template <class Emit>
  void cancel(Emit&& emit) {
    if (inside_ || held_ != 0) leave(emit);
    placed_ = false;
    // Whatever was held when it stopped is let go unseen.
    foreign_ = 0;
  }

  /** A press passed on and not yet let go, which a move then always follows. */
  bool holding() const { return held_ != 0; }

 private:
  template <class Emit>
  void leave(Emit& emit) {
    held_ = 0;
    inside_ = false;
    emit("pointer:leave\n");
  }

  template <class Emit>
  void line(Emit& emit, const char* kind, const PointerSample& sample, const int* extra) {
    char text[kMaxPointerRecord];
    const long x = static_cast<long>(sample.at.x) - monitor_.left;
    const long y = static_cast<long>(sample.at.y) - monitor_.top;
    const int written =
      extra ? std::snprintf(text, sizeof(text), "pointer:%s %ld %ld %d %u %d\n", kind, x, y,
                            sample.camera ? 1 : 0, held_, *extra)
            : std::snprintf(text, sizeof(text), "pointer:%s %ld %ld %d %u\n", kind, x, y,
                            sample.camera ? 1 : 0, held_);
    if (written > 0 && written < static_cast<int>(sizeof(text))) emit(text);
  }

  RECT monitor_;
  POINT last_{};
  bool placed_ = false;
  bool inside_ = false;
  /** Buttons passed on and held. */
  unsigned held_ = 0;
  /** Buttons pressed somewhere else — an icon, a window — and held. */
  unsigned foreign_ = 0;
};

/** The buttons that went down and up in one Raw Input report. */
inline void raw_buttons(USHORT flags, unsigned& downs, unsigned& ups) {
  downs = 0;
  ups = 0;
  if (flags & RI_MOUSE_LEFT_BUTTON_DOWN) downs |= kLeftButton;
  if (flags & RI_MOUSE_LEFT_BUTTON_UP) ups |= kLeftButton;
  if (flags & RI_MOUSE_RIGHT_BUTTON_DOWN) downs |= kRightButton;
  if (flags & RI_MOUSE_RIGHT_BUTTON_UP) ups |= kRightButton;
  if (flags & RI_MOUSE_MIDDLE_BUTTON_DOWN) downs |= kMiddleButton;
  if (flags & RI_MOUSE_MIDDLE_BUTTON_UP) ups |= kMiddleButton;
}

/** Whether `point` lies on any of the icons' rectangles. */
inline bool over_any(const POINT& point, const RECT* rects, int count) {
  for (int index = 0; index < count; ++index) {
    if (PtInRect(&rects[index], point)) return true;
  }
  return false;
}

/** The key that moves the camera until main names another: Ctrl, as on the graph. */
constexpr unsigned kDefaultCameraKey = VK_CONTROL;

/**
 * The commands main writes on the helper's input, one a line. `show`/`hide`
 * say whether the background is on the desktop; `touch`/`still` whether the
 * mouse is passed on; `camera-key <name>` which key turns the camera (`ctrl`,
 * `alt`, `shift`, `vk:0x01` to `vk:0xFE`, or a physical key as `scan:0xNN` or
 * `scan:0xE0NN`: the listener's own choice).
 *
 * Anything else — a word this helper does not know, a key it cannot read, a
 * line longer than any command — is `unknown`, and the helper ignores it.
 * Refusing it failed every desktop background the day a newer main first sent
 * `touch` to an older helper, and the next new command would have done it
 * again.
 */
enum class Command { none, show, hide, touch, still, camera_key, unknown };

/**
 * Marks a camera key held as a physical scan code rather than a virtual key:
 * `scan:` names the key where it sits on the keyboard (KeyboardEvent.code), and
 * its virtual key depends on the layout — AZERTY's KeyA is VK 'Q' — so it is
 * turned into one only when it is read (`camera_vk`).
 */
constexpr unsigned kScanKey = 0x10000;

/**
 * `prefix` then `0x` and between `fewest` and `most` hex digits, as a number;
 * false for anything else.
 */
inline bool hex_named(const char* name, std::size_t length, const char* prefix,
                      std::size_t fewest, std::size_t most, unsigned& value) {
  std::size_t index = 0;
  for (; prefix[index] != '\0'; ++index) {
    if (index >= length || name[index] != prefix[index]) return false;
  }
  if (length < index + 2 || name[index] != '0' || name[index + 1] != 'x') return false;
  index += 2;
  const std::size_t digits = length - index;
  if (digits < fewest || digits > most) return false;
  value = 0;
  for (; index < length; ++index) {
    const char digit = name[index];
    unsigned nibble = 0;
    if (digit >= '0' && digit <= '9') {
      nibble = static_cast<unsigned>(digit - '0');
    } else if (digit >= 'a' && digit <= 'f') {
      nibble = static_cast<unsigned>(digit - 'a' + 10);
    } else if (digit >= 'A' && digit <= 'F') {
      nibble = static_cast<unsigned>(digit - 'A' + 10);
    } else {
      return false;
    }
    value = value * 16 + nibble;
  }
  return true;
}

/**
 * The key a `camera-key` name names, or 0 for none it can read: a virtual key,
 * or `kScanKey` and a scan code — `scan:0xNN`, or `scan:0xE0NN` for an extended
 * key such as the right Ctrl, as Windows writes those.
 */
inline unsigned camera_key_named(const char* name, std::size_t length) {
  const auto is = [&](const char* word) {
    std::size_t index = 0;
    for (; index < length && word[index] != '\0'; ++index) {
      if (name[index] != word[index]) return false;
    }
    return index == length && word[index] == '\0';
  };
  if (is("ctrl")) return VK_CONTROL;
  if (is("alt")) return VK_MENU;
  if (is("shift")) return VK_SHIFT;
  unsigned code = 0;
  if (hex_named(name, length, "vk:", 1, 2, code)) {
    return code >= 0x01 && code <= 0xFE ? code : 0;
  }
  if (hex_named(name, length, "scan:", 1, 4, code)) {
    const unsigned high = code >> 8;
    const unsigned low = code & 0xFF;
    if (low != 0 && (high == 0 || high == 0xE0)) return kScanKey | code;
  }
  return 0;
}

/**
 * The virtual key to read for a camera key, under keyboard `layout`: a virtual
 * key as it is, a scan code through the layout (`MAPVK_VSC_TO_VK_EX`, which
 * tells the left keys from the right and takes the 0xE0 of an extended one).
 * 0 — a scan code the layout has no key for — is a key never held.
 */
inline unsigned camera_vk(unsigned key, HKL layout) {
  if ((key & kScanKey) == 0) return key;
  return MapVirtualKeyExW(key & 0xFFFF, MAPVK_VSC_TO_VK_EX, layout);
}

class CommandReader {
 public:
  /** One byte of input: the command it completes, or `none` mid-line. */
  Command feed(char value) {
    if (value != '\n') {
      // Too long for any command: kept back to the line's end, then unknown.
      if (used_ == sizeof(text_)) {
        overflowed_ = true;
      } else {
        text_[used_++] = value;
      }
      return Command::none;
    }
    const Command command = overflowed_ ? Command::unknown : parse();
    used_ = 0;
    overflowed_ = false;
    return command;
  }

  /** The key the last `camera_key` named. */
  unsigned camera_key() const { return camera_key_; }

 private:
  bool line_is(const char* word) const {
    std::size_t length = 0;
    while (word[length] != '\0') ++length;
    if (length != used_) return false;
    for (std::size_t index = 0; index < length; ++index) {
      if (text_[index] != word[index]) return false;
    }
    return true;
  }

  Command parse() {
    if (line_is("show")) return Command::show;
    if (line_is("hide")) return Command::hide;
    if (line_is("touch")) return Command::touch;
    if (line_is("still")) return Command::still;
    constexpr char kCameraKey[] = "camera-key ";
    constexpr std::size_t kCameraKeyLength = sizeof(kCameraKey) - 1;
    if (used_ > kCameraKeyLength) {
      bool prefixed = true;
      for (std::size_t index = 0; index < kCameraKeyLength && prefixed; ++index) {
        prefixed = text_[index] == kCameraKey[index];
      }
      const unsigned key =
        prefixed ? camera_key_named(text_ + kCameraKeyLength, used_ - kCameraKeyLength) : 0;
      if (key != 0) {
        camera_key_ = key;
        return Command::camera_key;
      }
    }
    return Command::unknown;
  }

  // The longest command is `camera-key scan:0xE0NN`, 22 bytes; room for a
  // little more.
  char text_[32]{};
  std::size_t used_ = 0;
  bool overflowed_ = false;
  unsigned camera_key_ = kDefaultCameraKey;
};

}  // namespace wallpaper
