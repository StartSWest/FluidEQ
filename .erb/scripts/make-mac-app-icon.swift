/* FluidEQ — GPL-3.0-or-later */

// Rebuild on macOS: swift .erb/scripts/make-mac-app-icon.swift
// The shared mark fills 92% of its canvas; Mac app icons occupy about 80%.
// A 7/8 drawing scale supplies the transparent surround expected by the Dock
// without changing the artwork or shrinking Windows/Linux's existing icons.
import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let output = root.appendingPathComponent("assets/mac")
let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
let iconset = temporary.appendingPathComponent("FluidEQ.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: temporary) }
guard let source = NSImage(contentsOf: root.appendingPathComponent("assets/icon.icns")) else {
    fatalError("The shared FluidEQ icon could not be read.")
}

func png(_ size: Int) throws -> Data {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: size * 4, bitsPerPixel: 32),
        let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("The Mac icon canvas could not be allocated.")
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    context.cgContext.clear(CGRect(x: 0, y: 0, width: size, height: size))
    let inset = CGFloat(size) / 16
    source.draw(in: NSRect(x: inset, y: inset, width: CGFloat(size) - 2 * inset,
        height: CGFloat(size) - 2 * inset), from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("The Mac icon PNG could not be encoded.")
    }
    return data
}

for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let suffix = scale == 2 ? "@2x" : ""
        try png(points * scale).write(to: iconset.appendingPathComponent("icon_\(points)x\(points)\(suffix).png"), options: .atomic)
    }
}
try png(1024).write(to: output.appendingPathComponent("app-icon.png"), options: .atomic)
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", iconset.path, "-o", temporary.appendingPathComponent("app-icon.icns").path]
try process.run()
process.waitUntilExit()
guard process.terminationStatus == 0 else { fatalError("iconutil failed.") }
let icon = try Data(contentsOf: temporary.appendingPathComponent("app-icon.icns"))
try icon.write(to: output.appendingPathComponent("app-icon.icns"), options: .atomic)
print("Updated the Mac Dock PNG and app-bundle ICNS with the same padded artwork.")
