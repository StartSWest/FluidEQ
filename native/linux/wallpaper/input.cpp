/* FluidEQ — GPL-3.0-or-later */
#include <X11/Xatom.h>
#include <X11/Xlib.h>
#include <X11/extensions/shape.h>
#include <cerrno>
#include <climits>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <poll.h>
#include <unistd.h>

namespace {
bool x_failed = false;
int on_x_error(Display*, XErrorEvent*) {
  x_failed = true;
  return 0;
}

unsigned long number(const char* value) {
  if (!value || *value < '1' || *value > '9') return 0;
  char* end = nullptr;
  errno = 0;
  const auto result = std::strtoul(value, &end, 10);
  return errno || !end || *end || result > UINT_MAX ? 0 : result;
}

bool property(Display* display, Window window, const char* name,
              Atom type, unsigned long wanted) {
  Atom actual = None;
  int format = 0;
  unsigned long count = 0, remaining = 0;
  unsigned char* bytes = nullptr;
  const int status = XGetWindowProperty(
      display, window, XInternAtom(display, name, False), 0, 16, False,
      type, &actual, &format, &count, &remaining, &bytes);
  bool found = false;
  if (status == Success && actual == type && format == 32 && !remaining) {
    const auto* values = reinterpret_cast<const unsigned long*>(bytes);
    for (unsigned long i = 0; i < count; ++i) found |= values[i] == wanted;
  }
  if (bytes) XFree(bytes);
  return found;
}

bool is_wallpaper(Display* display, Window window, unsigned long owner) {
  Atom actual = None;
  int format = 0;
  unsigned long count = 0, remaining = 0;
  unsigned char* name = nullptr;
  const Atom utf8 = XInternAtom(display, "UTF8_STRING", False);
  const int status = XGetWindowProperty(
      display, window, XInternAtom(display, "_NET_WM_NAME", False),
      0, 16, False, utf8, &actual, &format, &count, &remaining, &name);
  const bool named = status == Success && actual == utf8 && format == 8 &&
                     remaining == 0 && count == 15 && name &&
                     std::memcmp(name, "FluidEQ Desktop", 15) == 0;
  if (name) XFree(name);
  return named &&
         property(display, window, "_NET_WM_PID", XA_CARDINAL, owner) &&
         property(display, window, "_NET_WM_WINDOW_TYPE", XA_ATOM,
                  XInternAtom(display, "_NET_WM_WINDOW_TYPE_DESKTOP", False));
}

bool no_input(Display* display, Window window) {
  int count = 0, ordering = 0;
  auto* rectangles = XShapeGetRectangles(display, window, ShapeInput,
                                        &count, &ordering);
  if (rectangles) XFree(rectangles);
  if (x_failed) return false;
  if (count != 0) {
    // Chromium rewrites ShapeInput when frame hints, bounds or scale change.
    // An invisible, mapped source must never intercept another window's input.
    // Use an actually empty region, including the top-left pixel, and observe
    // native shape changes rather than guessing when a configure has settled.
    XShapeCombineRectangles(display, window, ShapeInput, 0, 0, nullptr, 0,
                            ShapeSet, Unsorted);
    XSync(display, False);
  }
  return !x_failed;
}
}  // namespace

int main(int argc, char** argv) {
  const unsigned long window = argc == 3 ? number(argv[1]) : 0;
  const unsigned long owner = argc == 3 ? number(argv[2]) : 0;
  if (!window || !owner) return 2;
  Display* display = XOpenDisplay(nullptr);
  if (!display) return 2;
  XSetErrorHandler(on_x_error);
  int shape_event = 0, shape_error = 0;
  if (!XShapeQueryExtension(display, &shape_event, &shape_error) ||
      !is_wallpaper(display, window, owner) || x_failed) {
    XCloseDisplay(display);
    return 2;
  }
  XSelectInput(display, window, StructureNotifyMask);
  XShapeSelectInput(display, window, ShapeNotifyMask);
  if (!no_input(display, window)) {
    XCloseDisplay(display);
    return 2;
  }
  std::puts("ready");
  std::fflush(stdout);
  pollfd descriptors[] = {{ConnectionNumber(display), POLLIN, 0},
                          {STDIN_FILENO, POLLIN, 0}};
  int result = 0;
  bool finished = false;
  while (!finished) {
    while (XPending(display)) {
      XEvent event{};
      XNextEvent(display, &event);
      if (event.type == DestroyNotify) {
        finished = true;
        break;
      }
      if (event.type == ConfigureNotify || event.type == MapNotify ||
          event.type == shape_event + ShapeNotify) {
        if (!no_input(display, window)) {
          result = 2;
          finished = true;
          break;
        }
      }
    }
    if (finished) break;
    // EOF from the GJS host releases this exact window's guard. No heartbeat,
    // and no change to input on shutdown: the source stays harmless until its
    // owner destroys it. The X connection owns only our event subscriptions.
    const int ready = poll(descriptors, 2, -1);
    if (ready < 0) {
      if (errno == EINTR) continue;
      result = 2;
      break;
    }
    if (descriptors[0].revents & (POLLERR | POLLHUP | POLLNVAL)) {
      result = 2;
      break;
    }
    if (descriptors[1].revents & (POLLIN | POLLHUP | POLLERR | POLLNVAL)) {
      char byte = 0;
      const auto bytes = read(STDIN_FILENO, &byte, 1);
      if (bytes < 0 && errno == EINTR) continue;
      break;
    }
  }
  XCloseDisplay(display);
  return result;
}
