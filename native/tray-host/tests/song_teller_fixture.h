// Written by .erb/scripts/generate-sound-hops-fixture.ts from
// src/main/songTellerFixture.ts. Do not edit; regenerate.
#pragma once

#include <vector>

namespace feq::tray::fixture {

struct Output {
  const char* endpoint;
  bool finished;
  const char* id;
  double seconds;
  double level;
  double peak;
};

// Main 0 (an endpoint, empty for none), media 1 (an identity, empty for
// none), health 2 (its outputs), reflush 3.
struct Step {
  int kind;
  const char* text;
  std::vector<Output> outputs;
};

inline const std::vector<Step> kSteps = {
    {0, "{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}", {}},
    {2, "", {{"{0E9D8C7B-6A5F-4E3D-2C1B-0A9F8E7D6C5B}", false, "", 0.0, 0.0, 0.0}}},
    {1, "f282445fe4edd318", {}},
    {1, "f282445fe4edd318", {}},
    {2, "", {{"{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}", true, "f282445fe4edd318", 200.0, -12.345, -1.2}}},
    {2, "", {{"{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}", true, "f282445fe4edd318", 200.0, -12.345, -1.2}}},
    {2, "", {{"{0E9D8C7B-6A5F-4E3D-2C1B-0A9F8E7D6C5B}", true, "f282445fe4edd318", 20.0, -5.0, 0.0}}},
    {2, "", {{"{AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE}", false, "", 0.0, 0.0, 0.0}, {"not-a-guid", false, "", 0.0, 0.0, 0.0}}},
    {1, "", {}},
    {1, "011e51922d539e4b", {}},
    {2, "", {{"{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}", true, "011e51922d539e4b", 100.0, -20.125, -3.0}}},
    {2, "", {{"{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}", true, "f282445fe4edd318", 300.0, -15.0, -0.5}, {"{AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE}", true, "nothexatall!!!!!", 90.0, -9.0, -1.0}}},
    {0, "{0E9D8C7B-6A5F-4E3D-2C1B-0A9F8E7D6C5B}", {}},
    {1, "011e51922d539e4b", {}},
    {3, "", {}},
};

// Each step's files, by name.
struct Write {
  const char* name;
  const char* contents;
};
inline const std::vector<std::vector<Write>> kWrites = {
    {},
    {{"fluideq-programme-0e9d8c7b-6a5f-4e3d-2c1b-0a9f8e7d6c5b.txt", "# FluidEQ Engine programme v1\015\012"}, {"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012"}},
    {{"fluideq-programme-0e9d8c7b-6a5f-4e3d-2c1b-0a9f8e7d6c5b.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012"}, {"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012"}},
    {},
    {{"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012level=-12.35\015\012peak=-1.20\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012level=-12.35\015\012peak=-1.20\015\012"}},
    {},
    {},
    {{"fluideq-programme-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.txt", "# FluidEQ Engine programme v1\015\012song=f282445fe4edd318\015\012"}},
    {{"fluideq-programme-0e9d8c7b-6a5f-4e3d-2c1b-0a9f8e7d6c5b.txt", "# FluidEQ Engine programme v1\015\012"}, {"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012"}, {"fluideq-programme-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.txt", "# FluidEQ Engine programme v1\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012"}},
    {{"fluideq-programme-0e9d8c7b-6a5f-4e3d-2c1b-0a9f8e7d6c5b.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}, {"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}, {"fluideq-programme-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}},
    {{"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012level=-20.13\015\012peak=-3.00\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012level=-20.13\015\012peak=-3.00\015\012"}},
    {},
    {},
    {{"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}},
    {{"fluideq-programme-0e9d8c7b-6a5f-4e3d-2c1b-0a9f8e7d6c5b.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}, {"fluideq-programme-6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012level=-20.13\015\012peak=-3.00\015\012"}, {"fluideq-programme-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}, {"fluideq-programme.txt", "# FluidEQ Engine programme v1\015\012song=011e51922d539e4b\015\012"}},
};

// The levels kept at the end, by key.
struct Kept {
  const char* key;
  double level;
  double peak;
  double seconds;
  double heard_at;
};
inline const std::vector<Kept> kKept = {
    {"6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b:011e51922d539e4b", -20.125, -3.0, 100.0, 2000.0},
    {"6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b:f282445fe4edd318", -12.345, -0.5, 300.0, 3000.0},
};

}  // namespace feq::tray::fixture
