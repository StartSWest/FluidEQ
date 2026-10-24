/* FluidEQ — GPL-3.0-or-later */
#include "audio_backend.h"
#include "parent_watch.h"
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <numbers>
#include <string>
#include <unistd.h>

// A positive control for the no-feedback check: the SAME very quiet tone
// comes from another Core Audio process, which the LAN tap must hear.
struct Source {
  double phase = 0;
  double amplitude = 0.002;
  uint32_t rate = 48000;
  static void render(void* context, float* const* output, uint32_t frames) {
    auto& self = *static_cast<Source*>(context);
    for (uint32_t f = 0; f < frames; ++f) {
      const float value = static_cast<float>(self.amplitude * std::sin(self.phase));
      output[0][f] = value;
      output[1][f] = -value;
      self.phase += 2 * std::numbers::pi * 9173 / self.rate;
      if (self.phase >= 2 * std::numbers::pi) self.phase -= 2 * std::numbers::pi;
    }
  }
};
int main(int argc, char** argv) {
  feq_watch_parent(static_cast<uint32_t>(getppid()), nullptr);
  Source source;
  if (argc == 2) {
    char* end = nullptr;
    source.amplitude = std::strtod(argv[1], &end);
    if (end == argv[1] || *end != '\0' || !(source.amplitude > 0 && source.amplitude <= 0.02)) return 2;
  } else if (argc != 1) return 2;
  auto backend = create_audio_backend({Source::render, nullptr, nullptr, &source});
  std::cout << "ready" << std::endl;
  for (std::string line; std::getline(std::cin, line);) {
    if (line == "quit") break;
    if (line == "stop") { backend->close(); std::cout << "stopped" << std::endl; continue; }
    if (line != "start") return 2;
    std::string error;
    FeqBackendFormat format;
    if (!backend->open(format, error)) { std::cerr << error << std::endl; return 1; }
    source.rate = format.sample_rate;
    if (!backend->start(error)) { std::cerr << error << std::endl; return 1; }
    std::cout << "playing " << source.rate << std::endl;
  }
  backend->close();
  return 0;
}
