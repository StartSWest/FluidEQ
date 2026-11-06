# Load Linux integration after main has declared its common targets. Keep the
# measured shared CMake/DSP sources byte-identical across platform branches.
include_guard(GLOBAL)
get_filename_component(FEQ_LINUX_NATIVE_ROOT "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)
if(CMAKE_SOURCE_DIR STREQUAL FEQ_LINUX_NATIVE_ROOT)
  # Freeze the path now: DEFER evaluates ordinary arguments at directory exit.
  cmake_language(EVAL CODE
    "cmake_language(DEFER CALL include \"${CMAKE_CURRENT_LIST_DIR}/integrate.cmake\")")
endif()
