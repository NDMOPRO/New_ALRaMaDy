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

$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $document = $word.Documents.Open($resolvedInput, $false, $true)
  $document.ExportAsFixedFormat($resolvedOutput, 17)
}
finally {
  if ($document -ne $null) {
    $document.Close([ref]0)
  }
  if ($word -ne $null) {
    $word.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
