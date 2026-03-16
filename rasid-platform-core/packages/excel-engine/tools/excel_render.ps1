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

$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($resolvedInput, $null, $true)
  $workbook.ExportAsFixedFormat(0, $resolvedOutput)
}
finally {
  if ($workbook -ne $null) {
    $workbook.Close($false)
  }
  if ($excel -ne $null) {
    $excel.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
