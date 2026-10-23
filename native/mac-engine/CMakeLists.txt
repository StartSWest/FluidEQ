#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

# The macOS engine: the FluidEQ Engine's own graph (`native/system-apo`'s DSP
# core, the code the Windows effect runs), applied to every app's sound.
#
# macOS has no audio effect slot to load into, so the engine is a process of
# FluidEQ's own: a Core Audio process tap takes what every other process plays
# and silences it at the source, and a private aggregate device plays the
# processed copy to the output. FluidEQ's Library player is one of those
# processes, which is how it gets the EQ — exactly as on Windows, where the
# effect processes the player's output like any other stream.
#
# macOS only, as the effect it mirrors is Windows only. Objective-C++ for the
# one file that needs it: `AudioHardwareCreateProcessTap` takes a
# `CATapDescription`, which is an Objective-C class.

enable_language(OBJCXX)

# The Windows effect's own version (`engine.rc`), which the app gates every
# engine feature on — the Room, Game mode, the curve comparison. Read from
# that file rather than written here a second time: this engine is built from
# the same tree, so it has every feature that number names, and a release that
# raises it raises it for both engines.
set(FEQ_ENGINE_RC "${CMAKE_CURRENT_SOURCE_DIR}/../system-apo/src/engine.rc")
file(STRINGS "${FEQ_ENGINE_RC}" FEQ_ENGINE_FILEVERSION REGEX "^FILEVERSION ")
string(REGEX MATCHALL "[0-9]+" FEQ_ENGINE_VERSION_PARTS
  "${FEQ_ENGINE_FILEVERSION}")
list(JOIN FEQ_ENGINE_VERSION_PARTS "." FEQ_ENGINE_VERSION)
if(NOT FEQ_ENGINE_VERSION MATCHES "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$")
  message(FATAL_ERROR
    "The engine's version could not be read from ${FEQ_ENGINE_RC}")
endif()
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
  "${FEQ_ENGINE_RC}")

# The display frame — the DSP page's meters, the automatic preamp's readout —
# is built by the Windows effect's own `analysis_snapshot.cpp`, compiled here
# unchanged, so a meter main adds to the frame reaches a Mac without a line
# written for the Mac. That file includes "analysis_link.h", the effect's
# class and Windows' header, and a quoted include is looked for beside the
# including file before anywhere else. So it is compiled from a copy placed
# beside a header of this program's that declares the same class for a Mac
# (`mac_analysis_link.h`); `configure_file` copies it again whenever the
# original changes, and `file(CONFIGURE)` writes the header only when it
# differs, so neither rebuilds anything that has not changed.
set(FEQ_FROM_EFFECT "${CMAKE_CURRENT_BINARY_DIR}/from-effect")
configure_file(../system-apo/src/analysis_snapshot.cpp
  "${FEQ_FROM_EFFECT}/analysis_snapshot.cpp" COPYONLY)
file(CONFIGURE OUTPUT "${FEQ_FROM_EFFECT}/analysis_link.h" CONTENT
  "// Written by native/mac-engine/CMakeLists.txt: the effect's analysis\n// class, as the Mac engine declares it.\n#include \"mac_analysis_link.h\"\n")

add_library(fluideq-mac-graph STATIC
  src/engine.cpp
  src/config_file.cpp
  src/mac_analysis_link.cpp
  src/status_report.cpp
  # The status text both engines print, so the app reads them alike. The
  # effect's writer beside it is Windows' own and stays there.
  ../system-apo/src/status_json.cpp
  "${FEQ_FROM_EFFECT}/analysis_snapshot.cpp")
target_include_directories(fluideq-mac-graph PUBLIC
  src
  ../system-apo/src
  ../system-apo/src/platform/posix)
target_link_libraries(fluideq-mac-graph PUBLIC
  fluideq-engine-dsp fluideq-engine-config PRIVATE feq_strict)

add_executable(fluideq-mac-engine
  src/main.cpp src/audio_permission.cpp src/controller.cpp
  src/dir_watch.cpp src/output_devices.cpp src/system_tap.mm)
target_link_libraries(fluideq-mac-engine PRIVATE
  fluideq-mac-graph feq_strict
  "-framework CoreAudio"
  "-framework CoreFoundation"
  "-framework Foundation")
set_source_files_properties(src/system_tap.mm PROPERTIES
  COMPILE_OPTIONS "-fobjc-arc")
target_compile_definitions(fluideq-mac-engine PRIVATE
  FEQ_BUILD_REVISION="${FEQ_BUILD_REVISION}"
  FEQ_ENGINE_VERSION="${FEQ_ENGINE_VERSION}")
# `FluidEQ-Engine`, like the Windows effect's file: it is the name somebody
# reads in Activity Monitor while working out what is holding their sound.
set_target_properties(fluideq-mac-engine PROPERTIES
  OUTPUT_NAME "FluidEQ-Engine"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")

# Exercise the real file reader and graph without opening a device or taking
# the system's sound. Shared-engine tests cannot catch a Mac-only filename.
add_executable(fluideq-mac-engine-config-test tests/engine_config_test.cpp)
target_include_directories(fluideq-mac-engine-config-test PRIVATE
  ../system-apo/tests)
target_link_libraries(fluideq-mac-engine-config-test PRIVATE
  fluideq-mac-graph feq_strict)
add_test(NAME mac-engine-config COMMAND fluideq-mac-engine-config-test)
