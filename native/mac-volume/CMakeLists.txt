# FluidEQ — GPL-3.0-or-later
add_executable(fluideq-mac-volume main.cpp output_volume.cpp
  ../mac-engine/src/output_devices.cpp ../dsp-host/src/parent_watch.cpp)
target_include_directories(fluideq-mac-volume PRIVATE
  ../mac-engine/src ../dsp-host/src)
target_link_libraries(fluideq-mac-volume PRIVATE feq_strict
  "-framework CoreAudio" "-framework CoreFoundation")
set_target_properties(fluideq-mac-volume PROPERTIES OUTPUT_NAME "FluidEQ-Volume"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

add_executable(fluideq-mac-volume-test tests/controls.cpp output_volume.cpp)
target_include_directories(fluideq-mac-volume-test PRIVATE . ../mac-engine/src)
target_link_libraries(fluideq-mac-volume-test PRIVATE feq_strict)
add_test(NAME mac-volume-controls COMMAND fluideq-mac-volume-test)
