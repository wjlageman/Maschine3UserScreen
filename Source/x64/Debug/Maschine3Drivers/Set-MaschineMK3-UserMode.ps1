#Requires -RunAsAdministrator

param(
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptFilePath = $PSCommandPath
if ([string]::IsNullOrWhiteSpace($ScriptFilePath))
{
    throw 'The script path could not be determined.'
}

$ScriptRootDir = Split-Path -Parent $ScriptFilePath
$PackageRootDir = Split-Path -Parent $ScriptRootDir

$DriverDir = Join-Path $ScriptRootDir 'MaschineMK3DisplayWinUsb'
if (-not (Test-Path $DriverDir))
{
    $DriverDir = Join-Path $PackageRootDir 'MaschineMK3DisplayWinUsb'
}

function Write-Info
{
    param([string]$Text)

    $timestamp = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$timestamp] $Text"
}

function Normalize-ToArray
{
    param([object]$InputObject)

    if ($null -eq $InputObject)
    {
        return @()
    }

    return @($InputObject)
}

function Get-Mk3Mi05Devices
{
    $rawDevices = Get-PnpDevice -PresentOnly |
        Where-Object { $_.InstanceId -like 'USB\VID_17CC&PID_1600&MI_05*' }

    return @(Normalize-ToArray $rawDevices)
}

function Get-SignedDriverInfo
{
    param([string]$InstanceId)

    $drivers = Get-CimInstance Win32_PnPSignedDriver |
        Where-Object { $_.DeviceID -eq $InstanceId }

    $drivers = @(Normalize-ToArray $drivers)

    if ($drivers.Count -eq 0)
    {
        return $null
    }

    return $drivers[0]
}

function Invoke-PnpUtil
{
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Info ("Running: pnputil.exe " + ($Arguments -join ' '))

    $output = & pnputil.exe @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    $lines = @(Normalize-ToArray $output)

    foreach ($line in $lines)
    {
        Write-Host $line
    }

    Write-Info ("pnputil exit code = " + $exitCode)

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output   = ($lines -join "`r`n")
    }
}

$failed = $false
$rebootNeeded = $false
$maschineRestartRecommended = $false

try
{
    Write-Info 'Maschine MK3 screen driver switch: User mode'
    Write-Info ("Script root: " + $ScriptRootDir)
    Write-Info ("Driver folder: " + $DriverDir)
    Write-Info ''

    if (-not (Test-Path $DriverDir))
    {
        throw "Driver folder not found: $DriverDir"
    }

    $infPath = Join-Path $DriverDir 'MaschineMK3DisplayWinUSB.inf'

    Write-Info ("INF path: " + $infPath)

    if (-not (Test-Path $infPath))
    {
        throw "INF not found: $infPath"
    }

    Write-Info 'Looking for Maschine MK3 (MI_05)...'

    $devices = @(Get-Mk3Mi05Devices)

    if ($devices.Count -eq 0)
    {
        throw 'No Maschine MK3 MI_05 device found'
    }

    if ($devices.Count -gt 1)
    {
        throw 'Multiple MI_05 devices found (unexpected)'
    }

    $device = $devices[0]
    $instanceId = [string]$device.InstanceId

    if ([string]::IsNullOrWhiteSpace($instanceId))
    {
        throw 'Detected device has no usable InstanceId'
    }

    Write-Info ("Target device: " + $instanceId)

    $before = Get-SignedDriverInfo -InstanceId $instanceId

    if ($null -ne $before)
    {
        Write-Info ("Current driver: " + $before.DriverProviderName + " (" + $before.InfName + ")")
    }
    else
    {
        Write-Info 'Current driver info could not be read.'
    }

    Write-Info ''
    Write-Info 'Installing WinUSB driver...'

    $result = Invoke-PnpUtil -Arguments @('/add-driver', $infPath, '/install')

    if ($result.ExitCode -ne 0 -and $result.ExitCode -ne 259 -and $result.ExitCode -ne 3010)
    {
        throw 'Driver installation failed'
    }

    if ($result.ExitCode -eq 3010)
    {
        $rebootNeeded = $true
        $maschineRestartRecommended = $true
        Write-Info 'Driver package was added, and Windows reports that a reboot is needed to complete installation.'
    }
    elseif ($result.ExitCode -eq 259)
    {
        Write-Info 'Driver package already exists and is already up-to-date on the device.'
    }
    else
    {
        Write-Info 'Driver package installation completed without reboot request.'
    }

    Start-Sleep -Seconds 1

    $after = Get-SignedDriverInfo -InstanceId $instanceId

    if ($null -ne $after)
    {
        Write-Info ("Driver after install attempt: " + $after.DriverProviderName + " (" + $after.InfName + ")")
    }
    else
    {
        Write-Info 'Driver info after install attempt could not be read yet.'
    }

    Write-Info ''
    Write-Info 'Summary'

    if ($rebootNeeded)
    {
        Write-Info 'The user-mode driver package was added, but Windows still has the device in a pending-reboot state.'
        Write-Info 'What to do next:'
        Write-Info '  1. First switch the Maschine MK3 off and on again.'
        Write-Info '  2. If user mode still does not take over the screens, reboot Windows.'
    }
    elseif ($maschineRestartRecommended)
    {
        Write-Info 'The user-mode driver package was added, but Windows may still need the hardware to reconnect cleanly.'
        Write-Info 'What to do next:'
        Write-Info '  1. First switch the Maschine MK3 off and on again.'
        Write-Info '  2. If user mode still does not take over the screens, reboot Windows.'
    }
    else
    {
        Write-Info 'The user-mode driver package was added.'
        Write-Info 'If user mode does not take over the screens immediately:'
        Write-Info '  1. First switch the Maschine MK3 off and on again.'
        Write-Info '  2. If that does not help, reboot Windows.'
    }

    Write-Info ''
    Write-Info 'Done.'
}
catch
{
    $failed = $true
    Write-Host ''
    Write-Host '*** SCRIPT FAILED ***'
    Write-Host $_.Exception.Message
    exit 1
}
finally
{
    if (-not $NoPause)
    {
        Write-Host ''
        if ($failed)
        {
            Read-Host 'Press Enter to close'
        }
        else
        {
            Read-Host 'Finished. Press Enter'
        }
    }
}