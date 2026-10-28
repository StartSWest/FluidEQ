/* FluidEQ — GPL-3.0-or-later */
#pragma once
#import <CoreAudio/CATapDescription.h>

namespace feq::maclan {

// A second tap can still see sources silenced by the engine's tap. Monitoring
// them beside its final copy double-counts the music and invents overloads.
inline CATapDescription* monitor_source(NSArray<NSNumber*>* engines,
                                       NSString* output) {
  return engines.count > 0
      ? [[CATapDescription alloc] initWithProcesses:engines
           andDeviceUID:output withStream:0]
      : [[CATapDescription alloc] initExcludingProcesses:@[]
           andDeviceUID:output withStream:0];
}

inline void update_monitor_source(CATapDescription* description,
                                   NSArray<NSNumber*>* engines) {
  description.processes = engines;
  description.exclusive = engines.count == 0;
}

}  // namespace feq::maclan
