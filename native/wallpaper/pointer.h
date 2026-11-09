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
  /** Ctrl was down at the moment of the report: the camera's key. */
  bool ctrl = false;
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
                            sample.ctrl ? 1 : 0, held_, *extra)
            : std::snprintf(text, sizeof(text), "pointer:%s %ld %ld %d %u\n", kind, x, y,
                            sample.ctrl ? 1 : 0, held_);
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

/**
 * The commands main writes on the helper's input, one a line. `show`/`hide`
 * say whether the background is on the desktop; `touch`/`still` whether the
 * mouse is passed on. Anything else is refused, and so is a line longer than
 * the longest command.
 */
enum class Command { none, show, hide, touch, still, invalid };

class CommandReader {
 public:
  /** One byte of input: the command it completes, or `none` mid-line. */
  Command feed(char value) {
    if (value != '\n') {
      if (used_ == sizeof(text_)) return Command::invalid;
      text_[used_++] = value;
      return Command::none;
    }
    const Command command = parse();
    used_ = 0;
    return command;
  }

 private:
  Command parse() const {
    const struct { const char* word; Command command; } known[]{
      {"show", Command::show}, {"hide", Command::hide},
      {"touch", Command::touch}, {"still", Command::still}};
    for (const auto& entry : known) {
      std::size_t length = 0;
      while (entry.word[length] != '\0') ++length;
      if (length != used_) continue;
      bool same = true;
      for (std::size_t index = 0; index < length && same; ++index) {
        same = text_[index] == entry.word[index];
      }
      if (same) return entry.command;
    }
    return Command::invalid;
  }

  char text_[5]{};
  std::size_t used_ = 0;
};

}  // namespace wallpaper
