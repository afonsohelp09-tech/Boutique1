# Regénère les PNG à partir de LOGO/aza vision logos3.jpeg
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$src = Join-Path $root 'LOGO\aza vision logos3.jpeg'
if (-not (Test-Path -LiteralPath $src)) { throw "Fichier introuvable: $src" }
$targets = @(
  (Join-Path $PSScriptRoot '.'),
  (Join-Path $root '02-admin-erp\icons')
)
Add-Type -AssemblyName System.Drawing
function Save-Resize([string]$in, [string]$out, [int]$maxW, [int]$maxH) {
  $img = [System.Drawing.Image]::FromFile($in)
  $ratio = [Math]::Min($maxW / $img.Width, $maxH / $img.Height)
  if ($ratio -gt 1) { $ratio = 1 }
  $nw = [int]($img.Width * $ratio)
  $nh = [int]($img.Height * $ratio)
  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
foreach ($dir in $targets) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Copy-Item -LiteralPath $src -Destination (Join-Path $dir 'logo-source.jpeg') -Force
  Save-Resize $src (Join-Path $dir 'logo-nav.png') 400 110
  Save-Resize $src (Join-Path $dir 'logo.png') 300 80
  Save-Resize $src (Join-Path $dir 'favicon-32.png') 32 32
  Save-Resize $src (Join-Path $dir 'favicon-16.png') 16 16
  Save-Resize $src (Join-Path $dir 'favicon-48.png') 48 48
  Save-Resize $src (Join-Path $dir 'icon-192.png') 192 192
  Save-Resize $src (Join-Path $dir 'icon-512.png') 512 512
  Save-Resize $src (Join-Path $dir 'apple-touch-icon.png') 180 180
  Write-Host "OK -> $dir"
}
