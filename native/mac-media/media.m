/* FluidEQ — GPL-3.0-or-later */
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <math.h>
#import <signal.h>
#import <unistd.h>
#import "MediaRemote.h"

// macOS 15.4 gates reading to Apple's host binaries. Only this small framework
// runs in the system Perl host; no signing, SIP, or entitlement changes occur.
// Additional signatures are documented by WebKit's pal/spi/mac/MediaRemoteSPI.h.
typedef void *(*OriginFn)(void);
typedef void (*CommandsFn)(void *, dispatch_queue_t, void (^)(CFArrayRef));
typedef uint32_t (*CommandFn)(CFTypeRef);
typedef Boolean (*EnabledFn)(CFTypeRef);
typedef Boolean (*SendFn)(uint32_t, CFDictionaryRef, void *, CFStringRef,
                         uint32_t, dispatch_queue_t,
                         void (^)(uint32_t, CFArrayRef));

static MediaRemote *remote;
static OriginFn origin;
static CommandsFn commands;
static CommandFn commandNumber;
static EnabledFn commandEnabled;
static SendFn sendToApp;
static dispatch_source_t input;
static BOOL stopped, reading, readAgain;
static NSDictionary *current;
static NSMutableDictionary<NSNumber *, NSDictionary *> *players;

static NSString *text(id value) {
    return [value isKindOfClass:NSString.class] ? value : @"";
}
static double number(id value) {
    double result = [value isKindOfClass:NSNumber.class] ? [value doubleValue] : 0;
    return isfinite(result) ? result : 0;
}
static BOOL ownApp(NSString *bundle) {
    return [bundle isEqual:@"com.gigabytz.fluideq"] ||
           [bundle isEqual:@"com.gigabytz.fluideq.dev"];
}
static void emit(id value) {
    if (stopped) return;
    NSData *data = [NSJSONSerialization dataWithJSONObject:value ?: NSNull.null
                        options:NSJSONWritingFragmentsAllowed error:nil];
    if (data && (fwrite(data.bytes, 1, data.length, stdout) != data.length ||
                 fputc('\n', stdout) == EOF || fflush(stdout) == EOF)) {
        stopped = YES;
        CFRunLoopStop(CFRunLoopGetMain());
    }
}
static void refresh(void);
static void finishRead(void) {
    reading = NO;
    if (readAgain && !stopped) {
        readAgain = NO;
        refresh();
    }
}
static void publish(int pid, NSString *parent, NSDictionary *info, BOOL playing, CFArrayRef supported) {
    if (stopped || readAgain) { finishRead(); return; }
    NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    // WebKit registers the media session in its GPU helper. The parent is
    // the app the person opened, and the target its transport commands use.
    if (parent.length) {
        NSRunningApplication *host = [NSRunningApplication runningApplicationsWithBundleIdentifier:parent].firstObject;
        if (host) { app = host; pid = host.processIdentifier; }
    }
    NSString *bundle = app.bundleIdentifier ?: @"";
    NSString *title = text(info[kMRMediaRemoteNowPlayingInfoTitle]);
    int selfPid = [NSProcessInfo.processInfo.environment[@"FLUIDEQ_MEDIA_SELF_PID"] intValue];
    if (!app || !bundle.length || !title.length || ownApp(bundle) || pid == selfPid) {
        current = nil;
        emit(NSNull.null);
        finishRead();
        return;
    }
    NSMutableSet<NSNumber *> *enabled = [NSMutableSet set];
    if (supported && commandNumber && commandEnabled) {
        for (id entry in (__bridge NSArray *)supported) {
            CFTypeRef item = (__bridge CFTypeRef)entry;
            if (commandEnabled(item)) [enabled addObject:@(commandNumber(item))];
        }
    }
    double duration = MAX(0, number(info[kMRMediaRemoteNowPlayingInfoDuration]));
    double elapsed = MAX(0, number(info[kMRMediaRemoteNowPlayingInfoElapsedTime]));
    id timestamp = info[kMRMediaRemoteNowPlayingInfoTimestamp];
    double rate = MAX(0, number(info[kMRMediaRemoteNowPlayingInfoPlaybackRate]));
    if (playing && [timestamp isKindOfClass:NSDate.class]) {
        elapsed += MAX(0, -[timestamp timeIntervalSinceNow]) * rate;
    }
    if (duration > 0) elapsed = MIN(duration, elapsed);
    NSString *name = app.localizedName ?: bundle;
    current = @{
        @"app": name, @"bundleId": bundle, @"pid": @(pid), @"title": title,
        @"artist": text(info[kMRMediaRemoteNowPlayingInfoArtist]),
        @"isPlaying": @(playing), @"positionMs": @(round(elapsed * 1000)),
        @"durationMs": @(round(duration * 1000)), @"coverId": @"",
        @"canNext": @([enabled containsObject:@4]),
        @"canPrevious": @([enabled containsObject:@5]),
        @"canSeek": @([enabled containsObject:@24]),
        @"canToggle": @((BOOL)([enabled containsObject:@2] ||
            ([enabled containsObject:@0] && [enabled containsObject:@1]))),
        @"canPause": @([enabled containsObject:@1]),
        @"commands": enabled.allObjects,
        @"playing": playing ? @[name] : @[]
    };
    players[@(pid)] = current;
    emit(current);
    finishRead();
}
static void refresh(void) {
    if (stopped) return;
    if (reading) { readAgain = YES; return; }
    reading = YES;
    remote.getNowPlayingApplicationPID(dispatch_get_main_queue(), ^(int pid) {
      remote.getNowPlayingClient(dispatch_get_main_queue(), ^(id client) {
        NSString *parent = [client respondsToSelector:@selector(parentApplicationBundleIdentifier)]
            ? text([client parentApplicationBundleIdentifier]) : @"";
        remote.getNowPlayingInfo(dispatch_get_main_queue(), ^(NSDictionary *info) {
            remote.getNowPlayingApplicationIsPlaying(dispatch_get_main_queue(), ^(bool playing) {
                if (commands && origin) {
                    commands(origin(), dispatch_get_main_queue(), ^(CFArrayRef supported) {
                        publish(pid, parent, info, playing, supported);
                    });
                } else publish(pid, parent, info, playing, nil);
            });
        });
      });
    });
}
static void acknowledge(NSNumber *request, BOOL ok) {
    emit(@{@"ack": request, @"ok": @(ok)});
}
static void command(NSDictionary *message) {
    NSNumber *request = [message[@"id"] isKindOfClass:NSNumber.class] ? message[@"id"] : nil;
    NSNumber *pid = [message[@"pid"] isKindOfClass:NSNumber.class] ? message[@"pid"] : nil;
    if (!request || !pid) return;
    NSDictionary *known = players[pid];
    NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid.intValue];
    NSString *bundle = text(known[@"bundleId"]);
    // Commands can only address a player this helper observed, still running
    // under the same PID/bundle. Never launch a player or target FluidEQ itself.
    if (!known || !app || ownApp(bundle) || ![bundle isEqual:app.bundleIdentifier] || !sendToApp) {
        acknowledge(request, NO); return;
    }
    NSString *verb = text(message[@"command"]);
    NSDictionary *ids = @{@"play": @0, @"pause": @1, @"toggle": @2,
                          @"next": @4, @"previous": @5, @"seek": @24};
    NSNumber *code = ids[verb];
    NSArray *enabled = known[@"commands"];
    if ([verb isEqual:@"toggle"] && ![enabled containsObject:@2]) {
        code = [known[@"isPlaying"] boolValue] ? @1 : @0;
    }
    // Stop is pause, followed by rewind only after the pause was accepted.
    if ([verb isEqual:@"stop"]) code = @1;
    if (!code || ![enabled containsObject:code]) { acknowledge(request, NO); return; }
    NSMutableDictionary *options = [@{@"kMRMediaRemoteOptionDisableImplicitAppLaunchBehaviors": @YES} mutableCopy];
    if ([verb isEqual:@"seek"]) {
        options[@"kMRMediaRemoteOptionPlaybackPosition"] = @(MAX(0, number(message[@"positionMs"])) / 1000);
    }
    BOOL accepted = sendToApp(code.unsignedIntValue, (__bridge CFDictionaryRef)options,
        origin ? origin() : nil, (__bridge CFStringRef)bundle, 0, dispatch_get_main_queue(),
        ^(uint32_t error, CFArrayRef statuses) {
            BOOL ok = error == 0;
            for (NSNumber *status in (__bridge NSArray *)statuses) ok = ok && status.intValue == 0;
            if (ok && [verb isEqual:@"stop"] && [enabled containsObject:@24]) {
                NSMutableDictionary *rewind = [message mutableCopy];
                rewind[@"command"] = @"seek"; rewind[@"positionMs"] = @0;
                command(rewind);
            } else acknowledge(request, ok);
        });
    if (!accepted) acknowledge(request, NO);
}

__attribute__((visibility("default"))) void fluideq_media_watch(void) {
    @autoreleasepool {
        signal(SIGPIPE, SIG_IGN);
        remote = [MediaRemote new];
        players = [NSMutableDictionary dictionary];
        void *library = dlopen("/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote", RTLD_LAZY);
        origin = (OriginFn)dlsym(library, "MRMediaRemoteGetLocalOrigin");
        commands = (CommandsFn)dlsym(library, "MRMediaRemoteGetSupportedCommandsForOrigin");
        commandNumber = (CommandFn)dlsym(library, "MRMediaRemoteCommandInfoGetCommand");
        commandEnabled = (EnabledFn)dlsym(library, "MRMediaRemoteCommandInfoGetEnabled");
        sendToApp = (SendFn)dlsym(library, "MRMediaRemoteSendCommandToApp");
        if (!remote.getNowPlayingInfo || !remote.getNowPlayingClient || !remote.getNowPlayingApplicationPID ||
            !remote.getNowPlayingApplicationIsPlaying || !remote.registerForNowPlayingNotifications) {
            emit(@{@"unavailable": @YES}); return;
        }
        NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
        NSMutableArray *observers = [NSMutableArray array];
        for (NSString *name in @[
            kMRMediaRemoteNowPlayingInfoDidChangeNotification,
            kMRMediaRemoteNowPlayingApplicationDidChangeNotification,
            kMRMediaRemoteNowPlayingApplicationIsPlayingDidChangeNotification,
            kMRMediaRemoteNowPlayingPlaybackQueueDidChangeNotification,
            @"kMRMediaRemoteSupportedCommandsDidChangeNotification"
        ]) {
            [observers addObject:[center addObserverForName:name object:nil
                queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
                    (void)note; refresh();
                }]];
        }
        [observers addObject:[NSWorkspace.sharedWorkspace.notificationCenter
            addObserverForName:NSWorkspaceDidTerminateApplicationNotification object:nil
            queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
                NSRunningApplication *app = note.userInfo[NSWorkspaceApplicationKey];
                [players removeObjectForKey:@(app.processIdentifier)]; refresh();
            }]];
        NSMutableData *pending = [NSMutableData data];
        input = dispatch_source_create(DISPATCH_SOURCE_TYPE_READ, STDIN_FILENO, 0, dispatch_get_main_queue());
        dispatch_source_set_event_handler(input, ^{
            char bytes[4096]; ssize_t count = read(STDIN_FILENO, bytes, sizeof(bytes));
            if (count <= 0) { stopped = YES; CFRunLoopStop(CFRunLoopGetMain()); return; }
            [pending appendBytes:bytes length:(NSUInteger)count];
            if (pending.length > 65536) { stopped = YES; CFRunLoopStop(CFRunLoopGetMain()); return; }
            const char *buffer = pending.bytes;
            const char *end;
            while ((end = memchr(buffer, '\n', pending.length))) {
                NSUInteger length = (NSUInteger)(end - buffer);
                NSData *line = [pending subdataWithRange:NSMakeRange(0, length)];
                id value = [NSJSONSerialization JSONObjectWithData:line options:0 error:nil];
                if ([value isKindOfClass:NSDictionary.class]) command(value);
                [pending replaceBytesInRange:NSMakeRange(0, length + 1) withBytes:NULL length:0];
                buffer = pending.bytes;
            }
        });
        dispatch_resume(input);
        remote.registerForNowPlayingNotifications(dispatch_get_main_queue());
        refresh();
        CFRunLoopRun();
        remote.unregisterForNowPlayingNotifications();
        dispatch_source_cancel(input);
        for (id observer in observers) {
            [center removeObserver:observer];
            [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:observer];
        }
        stopped = YES;
    }
}
