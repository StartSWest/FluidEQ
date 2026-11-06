# The shared core's voice runtime needs explicit dl/pthread linkage before
# glibc 2.34. Apply this to every consumer without changing main's DSP code.
find_package(Threads REQUIRED)
target_link_libraries(fluideq-dsp-core PUBLIC ${CMAKE_DL_LIBS} Threads::Threads)

# MSVC supplies array begin/end transitively; GCC requires <iterator>.
# Include that standard header for this translation unit in the Linux build.
set_property(SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/dsp-core/src/compander.cpp"
  APPEND PROPERTY COMPILE_OPTIONS -include iterator)

# Deferred CMake calls may declare targets but cannot create subdirectories.
# The Linux list uses absolute source paths and is safe to include here.
include("${CMAKE_CURRENT_LIST_DIR}/CMakeLists.txt")
