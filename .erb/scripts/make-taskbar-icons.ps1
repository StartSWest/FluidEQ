# Rasterize the transport glyphs at Windows' common taskbar scale factors.
# NativeImage discovers the @Nx representations beside each base PNG.
Add-Type -AssemblyName System.Drawing
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../assets/taskbar'))
[IO.Directory]::CreateDirectory($target) | Out-Null
$scales = @(@(16, ''), @(20, '@1.25x'), @(24, '@1.5x'), @(32, '@2x'), @(48, '@3x'))
foreach ($tone in @('light', 'dark')) {
  $color = if ($tone -eq 'light') { [Drawing.Color]::White } else { [Drawing.Color]::FromArgb(32, 32, 32) }
  $brush = [Drawing.SolidBrush]::new($color)
  foreach ($name in @('previous', 'play', 'pause', 'next')) {
    foreach ($scale in $scales) {
      $size = [int]$scale[0]
      # Supersampling preserves the small diagonal without snapping it to a stair.
      $canvas = [Drawing.Bitmap]::new($size * 4, $size * 4)
      $g = [Drawing.Graphics]::FromImage($canvas)
      $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.ScaleTransform($size * 4 / 24, $size * 4 / 24)
      $polygon = switch ($name) {
        'previous' { @(17.5, 6.9, 17.5, 17.1, 9.4, 12) }
        'play' { @(8, 5, 8, 19, 19, 12) }
        'next' { @(6.5, 6.9, 6.5, 17.1, 14.6, 12) }
      }
      if ($polygon) {
        $points = for ($i = 0; $i -lt $polygon.Count; $i += 2) {
          [Drawing.PointF]::new($polygon[$i], $polygon[$i + 1])
        }
        $g.FillPolygon($brush, [Drawing.PointF[]]$points)
      }
      if ($name -eq 'previous') { $g.FillRectangle($brush, 6, 7, 2.3, 10) }
      if ($name -eq 'next') { $g.FillRectangle($brush, 15.7, 7, 2.3, 10) }
      if ($name -eq 'pause') {
        $g.FillRectangle($brush, 7.5, 6.5, 3.4, 11)
        $g.FillRectangle($brush, 13.1, 6.5, 3.4, 11)
      }
      $g.Dispose()
      $icon = [Drawing.Bitmap]::new($size, $size)
      $output = [Drawing.Graphics]::FromImage($icon)
      $output.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $output.DrawImage($canvas, 0, 0, $size, $size)
      $icon.Save((Join-Path $target "$name-$tone$($scale[1]).png"), [Drawing.Imaging.ImageFormat]::Png)
      $output.Dispose()
      $icon.Dispose()
      $canvas.Dispose()
    }
  }
  $brush.Dispose()
}
