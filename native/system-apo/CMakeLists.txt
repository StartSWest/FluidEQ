#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

# The system-wide engine: an audio effect Windows loads into audiodg.exe for
# every output it is attached to, plus the helper that attaches it. Windows
# only, and deliberately split from the DSP host: the host is a process FluidEQ
# owns, the effect is code running inside somebody else's.

add_library(fluideq-engine-config STATIC src/config.cpp src/config_grammar.cpp)
target_include_directories(fluideq-engine-config PUBLIC include)
target_link_libraries(fluideq-engine-config PRIVATE feq_strict)

add_executable(fluideq-engine-config-test tests/config_test.cpp)
target_link_libraries(fluideq-engine-config-test PRIVATE fluideq-engine-config feq_strict)
add_test(NAME engine-config COMMAND fluideq-engine-config-test)

# The kernel side of the engine: reading an impulse response off disk and
# designing a graphic-EQ FIR from a resolved `Chain`. `graph.cpp` (Task 3)
# joins this library once the processing graph exists; listing it here before
# then would point CMake at a file that does not exist yet.
add_library(fluideq-engine-dsp STATIC src/wav.cpp src/graphic_eq.cpp)
# PUBLIC on both: `graphic_eq.h`'s `design_graphic_kernel` takes a
# `GraphicPoint`, and Task 3's `graph.h` will take a `Chain` — both defined in
# fluideq-engine-config's public header, so anything that links this library
# needs that include path too. `feq_fft_in_place`'s header (from
# fluideq-dsp-core) is used from graphic_eq.cpp today and graph.cpp next, for
# the same reason.
target_link_libraries(fluideq-engine-dsp
  PUBLIC fluideq-dsp-core fluideq-engine-config)
target_link_libraries(fluideq-engine-dsp PRIVATE feq_strict)

add_executable(fluideq-engine-wav-test tests/wav_test.cpp)
target_link_libraries(fluideq-engine-wav-test PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-wav COMMAND fluideq-engine-wav-test)

add_executable(fluideq-engine-graphic-eq-test tests/graphic_eq_test.cpp)
target_link_libraries(fluideq-engine-graphic-eq-test
  PRIVATE fluideq-engine-dsp feq_strict)
add_test(NAME engine-graphic-eq COMMAND fluideq-engine-graphic-eq-test)
