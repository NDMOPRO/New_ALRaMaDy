param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPdfPath
)

$ErrorActionPreference = "Stop"

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$outputDir = Split-Path -Parent $OutputPdfPath
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPdfPath)

$powerPoint = $null
$presentation = $null

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $powerPoint.Visible = 1
  $presentation = $powerPoint.Presentations.Open($resolvedInput, $true, $false, $false)
  $presentation.SaveAs($resolvedOutput, 32)
}
finally {
  if ($presentation -ne $null) {
    $presentation.Close()
  }
  if ($powerPoint -ne $null) {
    $powerPoint.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
