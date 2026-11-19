# Rasterize the transport glyphs at Windows' common taskbar scale factors.
# NativeImage discovers the @Nx representations beside each base PNG.
# -Names draws only those glyphs, so adding one leaves the others' files as
# they are.
param([string[]]$Names = @('previous', 'play', 'pause', 'next', 'surprise'))
Add-Type -AssemblyName System.Drawing

# Surprise me (`LibrarySurpriseButton`'s glyph, in its 24-unit box): the two
# crossing arrows of shuffle, stroked, and the spark at their start, filled.
# A quadratic of the web glyph's spark is drawn as the cubic it equals.
function Draw-Surprise([Drawing.Graphics]$g, [Drawing.Color]$color) {
  $pen = [Drawing.Pen]::new($color, 2.1)
  $pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLine($pen, 3.5, 18.5, 6.1, 18.5)
  $g.DrawBezier($pen, 6.1, 18.5, 10.5, 18.5, 12.5, 8.5, 16.9, 8.5)
  $g.DrawLine($pen, 16.9, 8.5, 20.5, 8.5)
  $g.DrawLines($pen, [Drawing.PointF[]]@([Drawing.PointF]::new(18, 6), [Drawing.PointF]::new(20.5, 8.5), [Drawing.PointF]::new(18, 11)))
  $g.DrawLine($pen, 3.5, 8.5, 6.1, 8.5)
  $g.DrawBezier($pen, 6.1, 8.5, 7.7, 8.5, 8.9, 9.4, 9.9, 10.8)
  $g.DrawBezier($pen, 12.3, 15.6, 13.4, 17.2, 14.8, 18.5, 16.9, 18.5)
  $g.DrawLine($pen, 16.9, 18.5, 20.5, 18.5)
  $g.DrawLines($pen, [Drawing.PointF[]]@([Drawing.PointF]::new(18, 16), [Drawing.PointF]::new(20.5, 18.5), [Drawing.PointF]::new(18, 21)))
  $pen.Dispose()
  # The spark: four quadratic edges through (6,1.8) (8.5,4.3) (6,6.8) (3.5,4.3).
  $corners = @(@(6, 1.8), @(8.5, 4.3), @(6, 6.8), @(3.5, 4.3), @(6, 1.8))
  $pulls = @(@(6.3, 4), @(6.3, 4.6), @(5.7, 4.6), @(5.7, 4))
  $spark = [Drawing.Drawing2D.GraphicsPath]::new()
  for ($i = 0; $i -lt 4; $i++) {
    $a = $corners[$i]; $b = $corners[$i + 1]; $q = $pulls[$i]
    $spark.AddBezier(
      $a[0], $a[1],
      ($a[0] + 2 * ($q[0] - $a[0]) / 3), ($a[1] + 2 * ($q[1] - $a[1]) / 3),
      ($b[0] + 2 * ($q[0] - $b[0]) / 3), ($b[1] + 2 * ($q[1] - $b[1]) / 3),
      $b[0], $b[1])
  }
  $spark.CloseFigure()
  $fill = [Drawing.SolidBrush]::new($color)
  $g.FillPath($fill, $spark)
  $fill.Dispose()
  $spark.Dispose()
}
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../assets/taskbar'))
[IO.Directory]::CreateDirectory($target) | Out-Null
$scales = @(@(16, ''), @(20, '@1.25x'), @(24, '@1.5x'), @(32, '@2x'), @(48, '@3x'))
foreach ($tone in @('light', 'dark')) {
  $color = if ($tone -eq 'light') { [Drawing.Color]::White } else { [Drawing.Color]::FromArgb(32, 32, 32) }
  $brush = [Drawing.SolidBrush]::new($color)
  foreach ($name in $Names) {
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
      if ($name -eq 'surprise') { Draw-Surprise $g $color }
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
