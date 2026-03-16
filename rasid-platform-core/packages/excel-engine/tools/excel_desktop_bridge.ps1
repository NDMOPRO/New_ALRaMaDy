param(
  [Parameter(Mandatory = $true)][string]$Mode,
  [string]$SourcePath,
  [string]$TargetPath,
  [string]$WorkbookPath,
  [string]$OutputPath,
  [string]$SpecPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Close-WorkbookQuietly {
  param($Workbook)
  if ($null -ne $Workbook) {
    try { $Workbook.Close($false) | Out-Null } catch {}
  }
}

function Quit-ExcelQuietly {
  param($ExcelApp)
  if ($null -ne $ExcelApp) {
    try { $ExcelApp.Quit() | Out-Null } catch {}
  }
}

function Get-ColumnLetter {
  param([int]$ColumnNumber)
  $dividend = $ColumnNumber
  $columnName = ""
  while ($dividend -gt 0) {
    $modulo = ($dividend - 1) % 26
    $columnName = [char](65 + $modulo) + $columnName
    $dividend = [math]::Floor(($dividend - $modulo) / 26)
  }
  return $columnName
}

function Write-SheetRows {
  param(
    $Worksheet,
    $Rows
  )
  for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
    $rowValues = @($Rows[$rowIndex])
    for ($columnIndex = 0; $columnIndex -lt $rowValues.Count; $columnIndex++) {
      $value = $rowValues[$columnIndex]
      $cell = $Worksheet.Cells.Item($rowIndex + 1, $columnIndex + 1)
      if ($null -eq $value) {
        $cell.Value2 = $null
      } elseif ($value -is [System.Management.Automation.PSCustomObject] -or $value -is [hashtable]) {
        $cellType = if ($value.PSObject.Properties.Name -contains 'cell_type') { [string]$value.cell_type } else { "" }
        if ($cellType -eq 'formula') {
          $formula = [string]$value.formula
          $cell.Formula = if ($formula.StartsWith('=')) { $formula } else { "=$formula" }
          if ($value.PSObject.Properties.Name -contains 'number_format' -and $null -ne $value.number_format -and "$($value.number_format)".Length -gt 0) {
            $cell.NumberFormat = [string]$value.number_format
          }
        } elseif ($cellType -eq 'date') {
          $parsedDate = [datetime]$value.value
          $cell.Value2 = $parsedDate
          $cell.NumberFormat = if ($value.PSObject.Properties.Name -contains 'number_format' -and $null -ne $value.number_format -and "$($value.number_format)".Length -gt 0) { [string]$value.number_format } else { 'yyyy-mm-dd' }
        } else {
          $cell.Value2 = if ($value.PSObject.Properties.Name -contains 'value') { $value.value } else { [string]$value }
        }
      } elseif ($value -is [bool]) {
        $cell.Value2 = [bool]$value
      } elseif ($value -is [byte] -or $value -is [int16] -or $value -is [int32] -or $value -is [int64]) {
        $cell.Value2 = [double]$value
      } elseif ($value -is [single] -or $value -is [double] -or $value -is [decimal]) {
        $cell.Value2 = [double]$value
      } elseif ($value -is [string] -and $value -match '^\d{4}-\d{2}-\d{2}$') {
        $parsedDate = [datetime]::ParseExact($value, 'yyyy-MM-dd', $null)
        $cell.Value2 = $parsedDate
        $cell.NumberFormat = 'yyyy-mm-dd'
      } else {
        $cell.Value2 = [string]$value
      }
    }
  }
}

function Apply-WorksheetFormattingFromSpec {
  param(
    $Worksheet,
    $SheetSpec
  )
  if ($SheetSpec.PSObject.Properties.Name -contains 'visibility') {
    if ($SheetSpec.visibility -eq 'hidden') { $Worksheet.Visible = 0 }
    elseif ($SheetSpec.visibility -eq 'veryHidden') { $Worksheet.Visible = 2 }
    else { $Worksheet.Visible = -1 }
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'widths' -and $SheetSpec.widths) {
    foreach ($widthEntry in $SheetSpec.widths) {
      $Worksheet.Columns.Item([int]$widthEntry.column).ColumnWidth = [double]$widthEntry.width
    }
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'row_heights' -and $SheetSpec.row_heights) {
    foreach ($heightEntry in $SheetSpec.row_heights) {
      $Worksheet.Rows.Item([int]$heightEntry.row).RowHeight = [double]$heightEntry.height
    }
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'freeze_pane' -and $SheetSpec.freeze_pane) {
    $splitCell = "{0}{1}" -f (Get-ColumnLetter([int]$SheetSpec.freeze_pane.column)), ([int]$SheetSpec.freeze_pane.row)
    $Worksheet.Activate() | Out-Null
    $Worksheet.Range($splitCell).Select() | Out-Null
    $Worksheet.Application.ActiveWindow.FreezePanes = $false
    $Worksheet.Application.ActiveWindow.SplitColumn = [int]$SheetSpec.freeze_pane.column - 1
    $Worksheet.Application.ActiveWindow.SplitRow = [int]$SheetSpec.freeze_pane.row - 1
    $Worksheet.Application.ActiveWindow.FreezePanes = $true
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'auto_filter_range' -and $SheetSpec.auto_filter_range) {
    $Worksheet.Range($SheetSpec.auto_filter_range).AutoFilter() | Out-Null
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'rtl' -and $SheetSpec.rtl) {
    $Worksheet.DisplayRightToLeft = $true
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'hidden_columns' -and $SheetSpec.hidden_columns) {
    foreach ($columnIndex in @($SheetSpec.hidden_columns)) {
      $Worksheet.Columns.Item([int]$columnIndex).Hidden = $true
    }
  }
  if ($SheetSpec.PSObject.Properties.Name -contains 'merged_ranges' -and $SheetSpec.merged_ranges) {
    foreach ($mergedRange in @($SheetSpec.merged_ranges)) {
      $Worksheet.Range([string]$mergedRange).Merge() | Out-Null
    }
  }
}

function Add-NamedStylesAndTheme {
  param(
    $Workbook,
    $Spec
  )
  $themePath = $Spec.formatting.theme_path
  if (-not [string]::IsNullOrWhiteSpace($themePath) -and (Test-Path $themePath)) {
    $Workbook.ApplyTheme($themePath)
  }
  foreach ($styleSpec in $Spec.formatting.named_styles) {
    $style = $null
    try {
      $style = $Workbook.Styles.Item($styleSpec.name)
    } catch {
      $style = $Workbook.Styles.Add($styleSpec.name)
    }
    if ($styleSpec.font_name) { $style.Font.Name = $styleSpec.font_name }
    if ($null -ne $styleSpec.bold) { $style.Font.Bold = [bool]$styleSpec.bold }
    if ($styleSpec.font_size) { $style.Font.Size = [double]$styleSpec.font_size }
    if ($styleSpec.number_format) {
      $style.IncludeNumber = $true
      $style.NumberFormat = $styleSpec.number_format
    }
    if ($styleSpec.horizontal_alignment) { $style.HorizontalAlignment = [int]$styleSpec.horizontal_alignment }
    if ($styleSpec.vertical_alignment) { $style.VerticalAlignment = [int]$styleSpec.vertical_alignment }
    if ($styleSpec.wrap_text) { $style.WrapText = [bool]$styleSpec.wrap_text }
    if ($styleSpec.font_theme_color) {
      $style.Font.ThemeColor = [int]$styleSpec.font_theme_color
    }
    if ($styleSpec.interior_theme_color) {
      $style.Interior.ThemeColor = [int]$styleSpec.interior_theme_color
      if ($null -ne $styleSpec.interior_tint) { $style.Interior.TintAndShade = [double]$styleSpec.interior_tint }
    }
    if ($styleSpec.border_weight) {
      foreach ($borderIndex in 7, 8, 9, 10) {
        $style.Borders.Item($borderIndex).Weight = [int]$styleSpec.border_weight
      }
    }
  }
  foreach ($application in $Spec.formatting.applications) {
    $worksheet = $Workbook.Worksheets.Item([string]$application.worksheet)
    $worksheet.Range([string]$application.range).Style = [string]$application.style_name
  }
  foreach ($rule in $Spec.formatting.conditional_formatting_rules) {
    $worksheet = $Workbook.Worksheets.Item([string]$rule.worksheet)
    $range = $worksheet.Range([string]$rule.range)
    $formatCondition = $range.FormatConditions.Add(
      [int]$rule.type,
      [int]$rule.operator,
      $rule.formula1,
      $rule.formula2
    )
    if ($rule.font_color) { $formatCondition.Font.Color = [int]$rule.font_color }
    if ($rule.interior_color) { $formatCondition.Interior.Color = [int]$rule.interior_color }
  }
}

function Add-DefinedNamesFromSpec {
  param(
    $Workbook,
    $Spec
  )
  if (-not ($Spec.PSObject.Properties.Name -contains 'defined_names') -or -not $Spec.defined_names) {
    return
  }
  foreach ($nameSpec in $Spec.defined_names) {
    $name = [string]$nameSpec.name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $ranges = @(@($nameSpec.ranges) | ForEach-Object {
      $rangeValue = [string]$_
      if ($rangeValue.StartsWith('=')) { $rangeValue } else { "=$rangeValue" }
    })
    if ($ranges.Count -eq 0) { continue }
    $refersTo = $ranges -join ','
    try {
      if ($null -ne $nameSpec.local_sheet_id -and "$($nameSpec.local_sheet_id)".Length -gt 0) {
        $worksheet = $Workbook.Worksheets.Item([int]$nameSpec.local_sheet_id + 1)
        $worksheet.Names.Add($name, $refersTo) | Out-Null
      } else {
        $Workbook.Names.Add($name, $refersTo) | Out-Null
      }
    } catch {}
  }
}

function Add-ChartCoverage {
  param(
    $Workbook,
    $Spec
  )
  $chartSheet = $Workbook.Worksheets.Item([string]$Spec.chart_coverage.target_sheet)
  $chartOutputs = @()
  foreach ($chartSpec in $Spec.chart_coverage.charts) {
    $chartObject = $chartSheet.ChartObjects().Add(
      [double]$chartSpec.left,
      [double]$chartSpec.top,
      [double]$chartSpec.width,
      [double]$chartSpec.height
    )
    $chart = $chartObject.Chart
    $candidateCodes = @()
    if ($chartSpec.PSObject.Properties.Name -contains 'chart_type_codes' -and $chartSpec.chart_type_codes) {
      $candidateCodes = @($chartSpec.chart_type_codes)
    } else {
      $candidateCodes = @($chartSpec.chart_type_code)
    }
    $selectedCode = $null
    $chartError = $null
    foreach ($candidateCode in $candidateCodes) {
      try {
        $chart.ChartType = [int]$candidateCode
        $chart.SetSourceData($Workbook.Worksheets.Item([string]$chartSpec.source_sheet).Range([string]$chartSpec.source_range))
        $selectedCode = [int]$candidateCode
        break
      } catch {
        $chartError = $_.Exception.Message
        try {
          $chart.SetSourceData($Workbook.Worksheets.Item([string]$chartSpec.source_sheet).Range([string]$chartSpec.source_range))
          $chart.ChartType = [int]$candidateCode
          $selectedCode = [int]$candidateCode
          break
        } catch {
          $chartError = $_.Exception.Message
        }
      }
    }
    if ($null -ne $selectedCode) {
      $chart.HasTitle = $true
      $chart.ChartTitle.Text = [string]$chartSpec.title
    }
    $chartOutputs += [pscustomobject]@{
      title = [string]$chartSpec.title
      family = [string]$chartSpec.family
      chart_type_code = $selectedCode
      authored = $null -ne $selectedCode
      error_message = $chartError
      source_sheet = [string]$chartSpec.source_sheet
      source_range = [string]$chartSpec.source_range
    }
  }
  return $chartOutputs
}

function Add-PivotProof {
  param(
    $Workbook,
    $Spec
  )
  $pivotSpec = $Spec.pivot
  $sourceWorksheet = $Workbook.Worksheets.Item([string]$pivotSpec.source_sheet)
  $pivotWorksheet = $Workbook.Worksheets.Item([string]$pivotSpec.target_sheet)
  $sourceRange = $sourceWorksheet.Range([string]$pivotSpec.source_range)
  $pivotCache = $Workbook.PivotCaches().Create(1, $sourceRange)
  $null = $pivotCache.CreatePivotTable($pivotWorksheet.Range([string]$pivotSpec.target_cell), [string]$pivotSpec.pivot_table_name)
  $pivotTable = $pivotWorksheet.PivotTables([string]$pivotSpec.pivot_table_name)
  $pivotTable.ManualUpdate = $true
  $pivotTable.PivotFields([string]$pivotSpec.row_field).Orientation = 1
  $pivotTable.PivotFields([string]$pivotSpec.row_field).Position = 1
  $pivotTable.PivotFields([string]$pivotSpec.column_field).Orientation = 2
  $pivotTable.PivotFields([string]$pivotSpec.column_field).Position = 1
  $pivotTable.PivotFields([string]$pivotSpec.page_field).Orientation = 3
  $pivotTable.PivotFields([string]$pivotSpec.page_field).Position = 1
  $null = $pivotTable.AddDataField($pivotTable.PivotFields([string]$pivotSpec.data_field), [string]$pivotSpec.data_caption, -4157)
  $null = $pivotTable.CalculatedFields().Add([string]$pivotSpec.calculated_field_name, [string]$pivotSpec.calculated_formula, $true)
  $pivotTable.ManualUpdate = $false
  $pivotCache.Refresh() | Out-Null
  $Workbook.RefreshAll()
  Start-Sleep -Seconds 1
  $Workbook.Application.CalculateFullRebuild()
  return [pscustomobject]@{
    pivot_table_name = $pivotSpec.pivot_table_name
    source_sheet = $pivotSpec.source_sheet
    target_sheet = $pivotSpec.target_sheet
    source_range = $pivotSpec.source_range
  }
}

function Add-SlicerProof {
  param(
    $Workbook,
    $Spec
  )
  $slicerOutputs = @()
  if (-not ($Spec.PSObject.Properties.Name -contains 'slicers') -or -not $Spec.slicers) {
    return $slicerOutputs
  }
  foreach ($slicerSpec in $Spec.slicers) {
    try {
      $targetWorksheet = $Workbook.Worksheets.Item([string]$slicerSpec.target_sheet)
      $pivotTable = $targetWorksheet.PivotTables([string]$slicerSpec.pivot_table_name)
      $pivotField = $pivotTable.PivotFields([string]$slicerSpec.field)
      $slicerCache = $null
      try {
        $slicerCache = $Workbook.SlicerCaches().Add2($pivotTable, $pivotField)
      } catch {
        $slicerCache = $Workbook.SlicerCaches().Add($pivotTable, $pivotField)
      }
      $slicer = $slicerCache.Slicers.Add($targetWorksheet)
      if ($slicerSpec.PSObject.Properties.Name -contains 'name' -and $slicerSpec.name) { $slicer.Name = [string]$slicerSpec.name }
      if ($slicerSpec.PSObject.Properties.Name -contains 'caption' -and $slicerSpec.caption) { $slicer.Caption = [string]$slicerSpec.caption }
      if ($slicerSpec.PSObject.Properties.Name -contains 'left') { $slicer.Left = [double]$slicerSpec.left }
      if ($slicerSpec.PSObject.Properties.Name -contains 'top') { $slicer.Top = [double]$slicerSpec.top }
      if ($slicerSpec.PSObject.Properties.Name -contains 'width') { $slicer.Width = [double]$slicerSpec.width }
      if ($slicerSpec.PSObject.Properties.Name -contains 'height') { $slicer.Height = [double]$slicerSpec.height }
      if ($slicerSpec.PSObject.Properties.Name -contains 'named_range' -and $slicerSpec.named_range) {
        try {
          $Workbook.Names.Add([string]$slicerSpec.named_range, "='$($targetWorksheet.Name)'!`$A`$1") | Out-Null
        } catch {}
      }
      $slicerOutputs += [pscustomobject]@{
        field = [string]$slicerSpec.field
        authored = $true
      }
    } catch {
      $slicerOutputs += [pscustomobject]@{
        field = [string]$slicerSpec.field
        authored = $false
        error_message = $_.Exception.Message
      }
    }
  }
  return $slicerOutputs
}

function Inspect-AuthorProofBundle {
  param(
    $Workbook,
    $Spec,
    $AuthoredCharts,
    $AuthoredSlicers
  )
  $styleNames = @($Workbook.Styles | ForEach-Object { $_.NameLocal })
  $formattingWorkbook = $Workbook.Worksheets.Item([string]$Spec.formatting.reload_checks.workbook_sheet)
  $formattingArabic = $Workbook.Worksheets.Item([string]$Spec.formatting.reload_checks.arabic_sheet)
  $formattingSummary = $Workbook.Worksheets.Item([string]$Spec.formatting.reload_checks.summary_sheet)
  $chartSheet = $Workbook.Worksheets.Item([string]$Spec.chart_coverage.target_sheet)
  $chartObjects = @()
  foreach ($chartObject in $chartSheet.ChartObjects()) {
    $chartTitle = $null
    try { $chartTitle = $chartObject.Chart.ChartTitle.Text } catch { $chartTitle = $null }
    $chartObjects += [pscustomobject]@{
      title = $chartTitle
      chart_type_code = $chartObject.Chart.ChartType
      name = $chartObject.Name
    }
  }
  $pivotWorksheet = $Workbook.Worksheets.Item([string]$Spec.pivot.target_sheet)
  $pivotTable = $pivotWorksheet.PivotTables([string]$Spec.pivot.pivot_table_name)
  $rowFields = @()
  $columnFields = @()
  $pageFields = @()
  foreach ($pivotField in $pivotTable.PivotFields()) {
    $fieldInfo = [pscustomobject]@{
      name = $pivotField.Name
      orientation = $pivotField.Orientation
      position = $pivotField.Position
    }
    if ($pivotField.Orientation -eq 1) { $rowFields += $fieldInfo }
    elseif ($pivotField.Orientation -eq 2) { $columnFields += $fieldInfo }
    elseif ($pivotField.Orientation -eq 3) { $pageFields += $fieldInfo }
  }
  $calculatedFields = @()
  foreach ($calcField in $pivotTable.CalculatedFields()) {
    $calculatedFields += [pscustomobject]@{
      name = $calcField.Name
      formula = $calcField.Formula
    }
  }
  $themeAccent1 = $null
  $themeMajorLatin = $null
  try { $themeAccent1 = $Workbook.Theme.ThemeColorScheme(5).RGB } catch {}
  try { $themeMajorLatin = $Workbook.Theme.ThemeFontScheme.MajorFont(1).Name } catch {}
  return [pscustomobject]@{
    mode = "author-proof-bundle"
    workbook_path = $Workbook.FullName
    formatting = [pscustomobject]@{
      theme_path = $Spec.formatting.theme_path
      theme_reload = [pscustomobject]@{
        accent1_rgb = $themeAccent1
        major_latin_font = $themeMajorLatin
      }
      named_styles_created = $Spec.formatting.named_styles | ForEach-Object { $_.name }
      named_styles_reloaded = $Spec.formatting.named_styles | ForEach-Object {
        [pscustomobject]@{
          name = $_.name
          exists = ($styleNames -contains $_.name)
        }
      }
      applied_cells = @(
        [pscustomobject]@{
          ref = "$($Spec.formatting.reload_checks.workbook_sheet)!$($Spec.formatting.reload_checks.workbook_cell)"
          style = $( try { $formattingWorkbook.Range($Spec.formatting.reload_checks.workbook_cell).Style.NameLocal } catch { [string]$formattingWorkbook.Range($Spec.formatting.reload_checks.workbook_cell).Style } )
          number_format = $formattingWorkbook.Range($Spec.formatting.reload_checks.workbook_cell).NumberFormat
        },
        [pscustomobject]@{
          ref = "$($Spec.formatting.reload_checks.arabic_sheet)!$($Spec.formatting.reload_checks.arabic_cell)"
          style = $( try { $formattingArabic.Range($Spec.formatting.reload_checks.arabic_cell).Style.NameLocal } catch { [string]$formattingArabic.Range($Spec.formatting.reload_checks.arabic_cell).Style } )
          font_name = $formattingArabic.Range($Spec.formatting.reload_checks.arabic_cell).Font.Name
          rtl = $formattingArabic.DisplayRightToLeft
        }
      )
      conditional_formatting_counts = @(
        [pscustomobject]@{
          worksheet = $Spec.formatting.reload_checks.workbook_sheet
          count = $formattingWorkbook.Range($Spec.formatting.reload_checks.workbook_conditional_range).FormatConditions.Count
        },
        [pscustomobject]@{
          worksheet = $Spec.formatting.reload_checks.summary_sheet
          count = $formattingSummary.Range($Spec.formatting.reload_checks.summary_conditional_range).FormatConditions.Count
        }
      )
      freeze_panes = [pscustomobject]@{
        workbook_sheet = $( $formattingWorkbook.Activate() | Out-Null; $Workbook.Application.ActiveWindow.FreezePanes )
        arabic_sheet = $( $formattingArabic.Activate() | Out-Null; $Workbook.Application.ActiveWindow.FreezePanes )
      }
      auto_filters = @(
        [pscustomobject]@{
          worksheet = $Spec.formatting.reload_checks.workbook_sheet
          range = $formattingWorkbook.AutoFilter.Range.Address()
        },
        [pscustomobject]@{
          worksheet = $Spec.formatting.reload_checks.summary_sheet
          range = $formattingSummary.AutoFilter.Range.Address()
        }
      )
      widths = $Spec.sheets | ForEach-Object {
        $worksheet = $Workbook.Worksheets.Item($_.name)
        [pscustomobject]@{
          worksheet = $_.name
          columns = $_.widths | ForEach-Object {
            [pscustomobject]@{
              column = $_.column
              width = $worksheet.Columns.Item([int]$_.column).ColumnWidth
            }
          }
        }
      }
    }
    chart_coverage = [pscustomobject]@{
      authored = $AuthoredCharts
      reloaded = $chartObjects
    }
    slicers = $AuthoredSlicers
    pivot = [pscustomobject]@{
      inspection_status = "opened"
      pivot_table_name = $pivotTable.Name
      row_fields = $rowFields
      column_fields = $columnFields
      page_fields = $pageFields
      calculated_fields = $calculatedFields
      table_range = $pivotTable.TableRange2.Address()
      refresh_date = $pivotTable.PivotCache().RefreshDate
      refresh_name = $pivotTable.PivotCache().RefreshName
    }
    inspected_at = (Get-Date).ToString("o")
  }
}

$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false

  if ($Mode -eq "export-xls") {
    if ([string]::IsNullOrWhiteSpace($SourcePath) -or [string]::IsNullOrWhiteSpace($TargetPath)) {
      throw "SourcePath and TargetPath are required for export-xls."
    }
    $workbook = $excel.Workbooks.Open($SourcePath, 0, $false)
    $xlExcel8 = 56
    $workbook.SaveAs($TargetPath, $xlExcel8)
    $result = [pscustomobject]@{
      mode = $Mode
      source_path = $SourcePath
      target_path = $TargetPath
      file_format = $xlExcel8
      excel_version = $excel.Version
      workbook_name = $workbook.Name
      exported_at = (Get-Date).ToString("o")
    }
    if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
      $result | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputPath -Encoding UTF8
    } else {
      $result | ConvertTo-Json -Depth 12
    }
    exit 0
  }

  if ($Mode -eq "inspect-pivot") {
    if ([string]::IsNullOrWhiteSpace($WorkbookPath) -or [string]::IsNullOrWhiteSpace($OutputPath)) {
      throw "WorkbookPath and OutputPath are required for inspect-pivot."
    }
    $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $false)
    $excel.CalculateFullRebuild()
    $workbook.RefreshAll()
    Start-Sleep -Seconds 2
    $excel.CalculateFullRebuild()

    $pivotTables = @()
    foreach ($worksheet in $workbook.Worksheets) {
      foreach ($pivotTable in $worksheet.PivotTables()) {
        $rowFields = @()
        $columnFields = @()
        $pageFields = @()
        $dataFields = @()
        foreach ($pivotField in $pivotTable.PivotFields()) {
          $fieldInfo = [pscustomobject]@{
            name = $pivotField.Name
            orientation = $pivotField.Orientation
            position = $pivotField.Position
          }
          if ($pivotField.Orientation -eq 1) { $rowFields += $fieldInfo }
          elseif ($pivotField.Orientation -eq 2) { $columnFields += $fieldInfo }
          elseif ($pivotField.Orientation -eq 3) { $pageFields += $fieldInfo }
          elseif ($pivotField.Orientation -eq 4) { $dataFields += $fieldInfo }
        }
        $dataBodyRange = $null
        if ($null -ne $pivotTable.DataBodyRange) {
          $dataBodyRange = $pivotTable.DataBodyRange.Address($false, $false)
        }
        $refreshDate = $null
        try {
          $refreshDate = $pivotTable.PivotCache().RefreshDate
        } catch {
          $refreshDate = $null
        }
        $pivotTables += [pscustomobject]@{
          worksheet_name = $worksheet.Name
          pivot_name = $pivotTable.Name
          table_range = $pivotTable.TableRange2.Address($false, $false)
          row_fields = $rowFields
          column_fields = $columnFields
          page_fields = $pageFields
          data_fields = $dataFields
          data_body_range = $dataBodyRange
          row_axis_layout = $pivotTable.RowAxisLayout
          has_auto_format = $pivotTable.HasAutoFormat
          calculated_members_in_filters = $pivotTable.ShowValuesRow
          refresh_date = $refreshDate
        }
      }
    }

    $slicerCacheCount = 0
    try {
      $slicerCacheCount = $workbook.SlicerCaches.Count
    } catch {
      $slicerCacheCount = 0
    }
    $result = [pscustomobject]@{
      mode = $Mode
      workbook_path = $WorkbookPath
      excel_version = $excel.Version
      slicer_cache_count = $slicerCacheCount
      pivot_table_count = $pivotTables.Count
      pivot_tables = $pivotTables
      inspected_at = (Get-Date).ToString("o")
    }
    $workbook.Save()
    $result | ConvertTo-Json -Depth 16 | Set-Content -Path $OutputPath -Encoding UTF8
    exit 0
  }

  if ($Mode -eq "author-proof-bundle") {
    if ([string]::IsNullOrWhiteSpace($SpecPath) -or [string]::IsNullOrWhiteSpace($WorkbookPath) -or [string]::IsNullOrWhiteSpace($OutputPath)) {
      throw "SpecPath, WorkbookPath, and OutputPath are required for author-proof-bundle."
    }
    $stage = "load_spec"
    try {
      $spec = Get-Content -Path $SpecPath -Raw | ConvertFrom-Json
      $stage = "create_workbook"
      $workbook = $excel.Workbooks.Add()
      while ($workbook.Worksheets.Count -gt 1) {
        $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete()
      }
      $stage = "populate_sheets"
      foreach ($sheetSpec in $spec.sheets) {
        $worksheet = $null
        if ($workbook.Worksheets.Count -eq 1 -and $workbook.Worksheets.Item(1).UsedRange.Count -eq 1 -and -not $workbook.Worksheets.Item(1).Cells.Item(1,1).Value2) {
          $worksheet = $workbook.Worksheets.Item(1)
          $worksheet.Name = [string]$sheetSpec.name
        } else {
          $worksheet = $workbook.Worksheets.Add()
          $worksheet.Name = [string]$sheetSpec.name
        }
        Write-SheetRows -Worksheet $worksheet -Rows $sheetSpec.rows
        Apply-WorksheetFormattingFromSpec -Worksheet $worksheet -SheetSpec $sheetSpec
      }
      $stage = "defined_names"
      Add-DefinedNamesFromSpec -Workbook $workbook -Spec $spec
      $stage = "formatting"
      Add-NamedStylesAndTheme -Workbook $workbook -Spec $spec
      $stage = "charts"
      $authoredCharts = Add-ChartCoverage -Workbook $workbook -Spec $spec
      $stage = "pivot"
      $null = Add-PivotProof -Workbook $workbook -Spec $spec
      $stage = "slicers"
      $authoredSlicers = Add-SlicerProof -Workbook $workbook -Spec $spec
      $stage = "save"
      $workbook.SaveAs($WorkbookPath, 51)
      $workbook.Close($false) | Out-Null
      $stage = "reload"
      $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)
      $stage = "inspect"
      $result = Inspect-AuthorProofBundle -Workbook $workbook -Spec $spec -AuthoredCharts $authoredCharts -AuthoredSlicers $authoredSlicers
      $workbook.Close($false) | Out-Null
      $result | ConvertTo-Json -Depth 32 | Set-Content -Path $OutputPath -Encoding UTF8
      exit 0
    } catch {
      $failure = [pscustomobject]@{
        mode = "author-proof-bundle"
        stage = $stage
        error_message = $_.Exception.Message
      }
      $failure | ConvertTo-Json -Depth 16 | Set-Content -Path $OutputPath -Encoding UTF8
      throw
    }
  }

  throw "Unsupported mode: $Mode"
}
finally {
  Close-WorkbookQuietly -Workbook $workbook
  Quit-ExcelQuietly -ExcelApp $excel
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
