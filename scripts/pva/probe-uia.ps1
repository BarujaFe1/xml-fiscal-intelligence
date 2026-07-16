# scripts/pva/probe-uia.ps1
# Launch SpedEFD.exe and dump the UI Automation tree to assess drivability.
$ErrorActionPreference = "Continue"

$exe = "C:\Arquivos de Programas RFB\Programas SPED\Fiscal\SpedEFD.exe"
Write-Host "launching $exe ..."
$launcher = Start-Process -FilePath $exe -PassThru
Write-Host "launcher pid=$($launcher.Id)"
Start-Sleep -Seconds 12

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$winCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Window)

$wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $winCond)
Write-Host "=== windows ($(($wins | Measure-Object).Count)) ==="
$target = $null
foreach ($w in $wins) {
  $name = $w.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::NameProperty)
  $wpid = $w.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ProcessIdProperty)
  if ($name -match "Sped Fiscal") { $target = $w; Write-Host "TARGET pid=$wpid name='$name'" }
}

if (-not $target) { Write-Host "No Sped Fiscal window found."; exit 1 }

# enumerate descendants via a non-null condition (process id of the window)
$descCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $wpid)
$desc = $target.FindAll([System.Windows.Automation.TreeScope]::Descendants, $descCond)
Write-Host "=== descendants of target: $($desc.Count) ==="
$i = 0
foreach ($c in $desc) {
  $cn = $c.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::NameProperty)
  $ct = $c.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ControlTypeProperty)
  $aid = $c.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AutomationIdProperty)
  $au = $c.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AutomationIdProperty)
  Write-Host "   - [$ct] name='$cn' id='$aid'"
  $i++
  if ($i -ge 60) { Write-Host "   ... (truncated at 60)"; break }
}

Write-Host "=== killing launcher $($launcher.Id) and target $wpid ==="
Stop-Process -Id $launcher.Id -ErrorAction SilentlyContinue
Stop-Process -Id $wpid -ErrorAction SilentlyContinue
