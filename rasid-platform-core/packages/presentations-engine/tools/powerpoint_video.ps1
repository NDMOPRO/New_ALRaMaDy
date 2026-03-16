param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputVideoPath
)

$ErrorActionPreference = "Stop"

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$outputDir = Split-Path -Parent $OutputVideoPath
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputVideoPath)

$powerPoint = $null
$presentation = $null

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $powerPoint.Visible = 1
  $presentation = $powerPoint.Presentations.Open($resolvedInput, $true, $false, $false)
  $presentation.CreateVideo($resolvedOutput, $true, 1, 720, 24, 80)
  while ($presentation.CreateVideoStatus -ne 3) {
    Start-Sleep -Seconds 2
    if (Test-Path -LiteralPath $resolvedOutput) {
      $file = Get-Item -LiteralPath $resolvedOutput
      if ($file.Length -gt 0 -and $presentation.CreateVideoStatus -eq 3) { break }
    }
  }
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
