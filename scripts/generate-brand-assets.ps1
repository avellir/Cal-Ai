# Deterministic prototype artwork. Run from the repository root on Windows.
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '../assets/images'

function New-BrandImage([string]$Name, [int]$Size, [bool]$Background, [bool]$Mono) {
  $bitmap = [Drawing.Bitmap]::new($Size, $Size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.Color]::Transparent)
  if ($Background) { $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#10251C')) }
  $graphics.ScaleTransform($Size / 1024.0, $Size / 1024.0)
  $ink = if ($Background -or $Mono) { [Drawing.Color]::White } else { [Drawing.ColorTranslator]::FromHtml('#248A3D') }
  $pen = [Drawing.Pen]::new($ink, 30)
  $leafBrush = [Drawing.SolidBrush]::new($(if ($Mono) { [Drawing.Color]::White } else { [Drawing.ColorTranslator]::FromHtml('#34C759') }))
  $leaf = [Drawing.Drawing2D.GraphicsPath]::new()
  try {
    $graphics.DrawEllipse($pen, 290, 330, 400, 400)
    $pen.Width = 12
    $graphics.DrawArc($pen, 350, 390, 280, 280, 30, 280)
    $leaf.AddBezier(500, 470, 490, 340, 595, 275, 730, 275)
    $leaf.AddBezier(730, 275, 735, 400, 625, 500, 500, 470)
    $leaf.CloseFigure()
    $graphics.FillPath($leafBrush, $leaf)
    $bitmap.Save((Join-Path $assetRoot $Name), [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $leaf.Dispose(); $leafBrush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
  }
}

New-BrandImage 'icon.png' 1024 $true $false
New-BrandImage 'splash-icon.png' 1024 $false $false
New-BrandImage 'android-icon-foreground.png' 1024 $false $false
New-BrandImage 'android-icon-monochrome.png' 1024 $false $true
New-BrandImage 'favicon.png' 64 $true $false
