/* FluidEQ — GPL-3.0-or-later */
#include <X11/Xatom.h>
#include <X11/Xlib.h>
#include <X11/extensions/shape.h>
#include <cerrno>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <poll.h>
#include <stdexcept>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

namespace {
void require(bool condition, const char* message) {
  if (!condition) throw std::runtime_error(message);
}
int rectangles(Display* display, Window window) {
  int count = 0, ordering = 0;
  auto* shape = XShapeGetRectangles(display, window, ShapeInput, &count, &ordering);
  if (shape) XFree(shape);
  return count;
}
struct Guard {
  pid_t pid = -1;
  int input = -1, output = -1;
  Guard(const char* executable, Display* display, Window window, pid_t owner) {
    int in[2]{}, out[2]{};
    require(pipe(in) == 0 && pipe(out) == 0, "pipe");
    const auto xid = std::to_string(window), parent = std::to_string(owner);
    pid = fork();
    require(pid >= 0, "fork");
    if (pid == 0) {
      close(ConnectionNumber(display));
      dup2(in[0], STDIN_FILENO);
      dup2(out[1], STDOUT_FILENO);
      close(in[0]); close(in[1]); close(out[0]); close(out[1]);
      execl(executable, executable, xid.c_str(), parent.c_str(), nullptr);
      _exit(127);
    }
    close(in[0]); close(out[1]);
    input = in[1]; output = out[0];
  }
  ~Guard() {
    if (input >= 0) close(input);
    if (output >= 0) close(output);
    if (pid > 0) { kill(pid, SIGTERM); waitpid(pid, nullptr, 0); }
  }
  bool ready() const {
    std::string line;
    char byte = 0;
    while (true) {
      const auto count = read(output, &byte, 1);
      if (count < 0 && errno == EINTR) continue;
      if (count != 1) return false;
      line += byte;
      if (byte == '\n' || line.size() > 6) return line == "ready\n";
    }
  }
  int finish() {
    close(input); input = -1;
    int status = 0;
    require(waitpid(pid, &status, 0) == pid, "waitpid");
    pid = -1;
    return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
  }
};
void wait_empty(Display* display, Window window, int output) {
  while (true) {
    while (XPending(display)) {
      XEvent event{};
      XNextEvent(display, &event);
    }
    if (rectangles(display, window) == 0) return;
    pollfd descriptors[] = {{ConnectionNumber(display), POLLIN, 0}, {output, POLLIN, 0}};
    const int ready = poll(descriptors, 2, -1);
    if (ready < 0 && errno == EINTR) continue;
    require(ready > 0 && !descriptors[1].revents, "input helper ended before repairing the region");
    require(!(descriptors[0].revents & (POLLHUP | POLLERR | POLLNVAL)), "X connection lost");
  }
}
}  // namespace

int main(int argc, char** argv) {
  const char* isolated = std::getenv("FLUIDEQ_WALLPAPER_TEST_DISPLAY");
  const char* actual = std::getenv("DISPLAY");
  if (argc != 2 || !isolated || !actual || std::strcmp(isolated, actual) != 0) {
    std::fprintf(stderr, "Run only with a private DISPLAY and matching FLUIDEQ_WALLPAPER_TEST_DISPLAY.\n");
    return 77;
  }
  Display* display = XOpenDisplay(nullptr);
  if (!display) return 2;
  const auto root = DefaultRootWindow(display);
  const auto main = XCreateSimpleWindow(display, root, 0, 0, 80, 80, 0, 0, 0);
  const auto wallpaper = XCreateSimpleWindow(display, root, 0, 0, 64, 64, 0, 0, 0);
  int result = 0;
  try {
    const auto owner = static_cast<unsigned long>(getpid());
    const auto desktop = XInternAtom(display, "_NET_WM_WINDOW_TYPE_DESKTOP", False);
    XChangeProperty(display, wallpaper, XInternAtom(display, "_NET_WM_PID", False),
                    XA_CARDINAL, 32, PropModeReplace, reinterpret_cast<const unsigned char*>(&owner), 1);
    XChangeProperty(display, wallpaper, XInternAtom(display, "_NET_WM_WINDOW_TYPE", False),
                    XA_ATOM, 32, PropModeReplace, reinterpret_cast<const unsigned char*>(&desktop), 1);
    XChangeProperty(display, wallpaper, XInternAtom(display, "_NET_WM_NAME", False),
                    XInternAtom(display, "UTF8_STRING", False), 8, PropModeReplace,
                    reinterpret_cast<const unsigned char*>("FluidEQ Desktop"), 15);
    XShapeSelectInput(display, wallpaper, ShapeNotifyMask);
    XSync(display, False);
    const int main_shape = rectangles(display, main);
    require(main_shape > 0 && rectangles(display, wallpaper) > 0, "positive input control");
    {
      Guard wrong(argv[1], display, main, getpid());
      require(!wrong.ready() && wrong.finish() == 2, "app window must be refused");
      Guard owner_mismatch(argv[1], display, wallpaper, getpid() + 1);
      require(!owner_mismatch.ready() && owner_mismatch.finish() == 2, "wrong owner must be refused");
      require(rectangles(display, main) == main_shape, "app input changed");
      require(rectangles(display, wallpaper) > 0, "refused source input changed");
    }
    Guard guard(argv[1], display, wallpaper, getpid());
    require(guard.ready(), "guard readiness");
    require(rectangles(display, wallpaper) == 0, "source can intercept clicks before mapping");
    XMapWindow(display, wallpaper);
    XMoveResizeWindow(display, wallpaper, 0, 0, 128, 96);
    // The same native overwrite Chromium performs after frame-hint updates.
    XRectangle full{0, 0, 128, 96};
    XShapeCombineRectangles(display, wallpaper, ShapeInput, 0, 0, &full, 1, ShapeSet, Unsorted);
    XFlush(display);
    wait_empty(display, wallpaper, guard.output);
    require(rectangles(display, main) == main_shape, "guard touched app input");
    require(guard.finish() == 0, "stdin EOF shutdown");
    require(rectangles(display, wallpaper) == 0, "shutdown restored a blocking source");
    std::puts("PASS: native wallpaper input stays empty before map, after overwrite and after EOF; app and wrong-owner windows are untouched.");
  } catch (const std::exception& error) {
    std::fprintf(stderr, "%s\n", error.what());
    result = 1;
  }
  XDestroyWindow(display, wallpaper);
  XDestroyWindow(display, main);
  XCloseDisplay(display);
  return result;
}
