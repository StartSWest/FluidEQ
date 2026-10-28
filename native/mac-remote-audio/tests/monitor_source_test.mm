/* FluidEQ — GPL-3.0-or-later */
#include "../monitor_source.h"
#include <cstdio>

int main() {
  @autoreleasepool {
    NSString* const output = @"test-output";
    CATapDescription* const processed = feq::maclan::monitor_source(@[@138], output);
    CATapDescription* const direct = feq::maclan::monitor_source(@[], output);
    // The failing monitor was exclusive with no exclusions: this positive
    // control names that raw mix and proves the engine selection differs.
    if (!direct.exclusive || direct.processes.count != 0) return 1;
    if (processed.exclusive || ![processed.processes isEqualToArray:@[@138]]) return 2;
    if (![processed.deviceUID isEqualToString:output] || processed.mixdown) return 3;
    // The same live tap follows the engine resting, resuming and restarting
    // under another process object, without needing to reopen the analyser.
    NSUUID* const identity = processed.UUID;
    feq::maclan::update_monitor_source(processed, @[]);
    if (!processed.exclusive || processed.processes.count != 0) return 4;
    feq::maclan::update_monitor_source(processed, @[@246]);
    if (processed.exclusive || ![processed.processes isEqualToArray:@[@246]]) return 5;
    if (![processed.UUID isEqual:identity] || ![processed.deviceUID isEqualToString:output]) return 6;
    std::puts("Monitor reads the engine alone while processing and the direct mix otherwise.");
  }
  return 0;
}
