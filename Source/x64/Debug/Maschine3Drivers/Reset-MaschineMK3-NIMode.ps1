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

function Write-Info
{
    param([string]$Text)

    $timestamp = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$timestamp] $Text"
}

function Get-ScriptRootDir
{
    return $ScriptRootDir
}

function Get-PackageRoot
{
    return $PackageRootDir
}

function Get-StateDir
{
    $root = Get-PackageRoot
    $stateDir = Join-Path $root 'state'

    if (-not (Test-Path $stateDir))
    {
        New-Item -ItemType Directory -Path $stateDir | Out-Null
    }

    return $stateDir
}

function Get-OptionalStateFilePath
{
    return Join-Path (Get-StateDir) 'maschine3display-driver-state.json'
}

function Get-LogFilePath
{
    $stateDir = Get-StateDir
    $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    return Join-Path $stateDir ("Reset-MaschineMK3-NIMode_" + $stamp + ".log")
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

    if ($lines.Count -gt 0)
    {
        foreach ($line in $lines)
        {
            Write-Host $line
        }
    }

    Write-Info ("pnputil exit code = " + $exitCode)

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output   = ($lines -join "`r`n")
    }
}

function Is-UserModeProvider
{
    param([string]$ProviderName)

    if ([string]::IsNullOrWhiteSpace($ProviderName))
    {
        return $false
    }

    $p = $ProviderName.ToLowerInvariant()

    if ($p -like '*native instruments*')
    {
        return $false
    }

    return $true
}

function Is-NativeInstrumentsProvider
{
    param([string]$ProviderName)

    if ([string]::IsNullOrWhiteSpace($ProviderName))
    {
        return $false
    }

    $p = $ProviderName.ToLowerInvariant()
    return $p -like '*native instruments*'
}

function Verify-NativeInstrumentsRoute
{
    param([string]$InstanceId)

    Start-Sleep -Seconds 2

    $driver = Get-SignedDriverInfo -InstanceId $InstanceId

    if ($null -eq $driver)
    {
        Write-Info 'Driver verification: signed driver info could not be read.'
        return $false
    }

    Write-Info ("Driver verification provider: " + $driver.DriverProviderName)
    Write-Info ("Driver verification INF: " + $driver.InfName)

    return Is-NativeInstrumentsProvider -ProviderName ([string]$driver.DriverProviderName)
}

function Get-ResetTargetInfName
{
    param(
        $CurrentDriver,
        $SavedState
    )

    if ($null -ne $SavedState -and -not [string]::IsNullOrWhiteSpace($SavedState.WinUsbInfName))
    {
        Write-Info ("Using WinUSB INF from saved state: " + $SavedState.WinUsbInfName)
        return $SavedState.WinUsbInfName
    }

    if ($null -eq $CurrentDriver)
    {
        return $null
    }

    $provider = ''
    if ($null -ne $CurrentDriver.DriverProviderName)
    {
        $provider = [string]$CurrentDriver.DriverProviderName
    }

    $infName = ''
    if ($null -ne $CurrentDriver.InfName)
    {
        $infName = [string]$CurrentDriver.InfName
    }

    if ([string]::IsNullOrWhiteSpace($infName))
    {
        return $null
    }

    if (Is-UserModeProvider -ProviderName $provider)
    {
        Write-Info ("Using current active INF as reset target: " + $infName)
        return $infName
    }

    return $null
}

$logPath = Get-LogFilePath
$transcriptStarted = $false
$failed = $false
$rebootNeeded = $false
$replugRecommended = $false

try
{
    Start-Transcript -Path $logPath -Force | Out-Null
    $transcriptStarted = $true

    Write-Info 'Maschine MK3 screen driver switch: Reset to NI mode'
    Write-Info ("Script root: " + (Get-ScriptRootDir))
    Write-Info ("Package root: " + (Get-PackageRoot))
    Write-Info ("Log file: " + $logPath)
    Write-Info ''

    $statePath = Get-OptionalStateFilePath
    Write-Info ("Optional state file: " + $statePath)

    $savedState = $null

    if (Test-Path $statePath)
    {
        Write-Info 'Loading saved state...'
        $savedState = Get-Content -Path $statePath -Raw | ConvertFrom-Json
    }
    else
    {
        Write-Info 'No saved state file found. Continuing without it.'
    }

    Write-Info 'Looking for connected Maschine MK3 MI_05 devices...'
    $devices = @(Get-Mk3Mi05Devices)
    $deviceCount = $devices.Count
    Write-Info ("Found MI_05 device count: " + $deviceCount)

    if ($deviceCount -eq 0)
    {
        throw 'No connected Maschine MK3 MI_05 interface was found.'
    }

    if ($deviceCount -gt 1)
    {
        Write-Info 'More than one MI_05 device was found. Refusing to guess.'
        foreach ($d in $devices)
        {
            if ($null -ne $d -and $null -ne $d.InstanceId)
            {
                Write-Info ("  " + $d.InstanceId)
            }
            else
            {
                Write-Info '  (device without InstanceId)'
            }
        }

        throw 'Resolve multiple MI_05 device instances first.'
    }

    $device = $devices[0]
    $instanceId = [string]$device.InstanceId

    if ([string]::IsNullOrWhiteSpace($instanceId))
    {
        throw 'The detected MI_05 device has no usable InstanceId.'
    }

    Write-Info ("Target instance: " + $instanceId)

    $current = Get-SignedDriverInfo -InstanceId $instanceId

    if ($null -ne $current)
    {
        Write-Info ("Current driver provider: " + $current.DriverProviderName)
        Write-Info ("Current INF: " + $current.InfName)
        Write-Info ("Current version: " + $current.DriverVersion)
    }
    else
    {
        Write-Info 'Current signed driver info could not be read.'
    }

    $targetInfName = Get-ResetTargetInfName -CurrentDriver $current -SavedState $savedState

    if ([string]::IsNullOrWhiteSpace($targetInfName))
    {
        if ($null -eq $current)
        {
            throw 'No current driver info is available, and there is no saved state file to tell the script what to remove.'
        }

        Write-Info 'No removable user-mode package was identified.'
        Write-Info 'This usually means the device is already using the Native Instruments route.'
        Write-Info 'Nothing to reset.'
        Write-Info ''
        Write-Info 'Done.'
        exit 0
    }

    Write-Info ''
    Write-Info ('Removing driver package: ' + $targetInfName)

    $delete = Invoke-PnpUtil -Arguments @('/delete-driver', $targetInfName, '/uninstall', '/force')

    if ($delete.ExitCode -ne 0)
    {
        throw 'PnPUtil could not remove the target driver package.'
    }

    Write-Info 'Scanning for hardware changes...'
    $scan = Invoke-PnpUtil -Arguments @('/scan-devices')

    if ($scan.ExitCode -ne 0)
    {
        Write-Info 'Device rescan did not report success. Continuing anyway.'
    }

    Start-Sleep -Seconds 1

    Write-Info ('Trying restart for instance: ' + $instanceId)
    $restart = Invoke-PnpUtil -Arguments @('/restart-device', $instanceId)

    if ($restart.ExitCode -eq 0)
    {
        Write-Info 'Device restart requested.'
    }
    elseif ($restart.ExitCode -eq 3010)
    {
        $rebootNeeded = $true
        $replugRecommended = $true

        Write-Info 'Windows reports that configuration is pending reboot.'
        Write-Info 'Skipping disable/enable because Windows already marked the device as pending reboot.'
    }
    else
    {
        Write-Info 'PnP restart was not accepted. Trying disable/enable sequence.'

        $disable = Invoke-PnpUtil -Arguments @('/disable-device', $instanceId)
        Start-Sleep -Milliseconds 500
        $enable = Invoke-PnpUtil -Arguments @('/enable-device', $instanceId)

        if ($disable.ExitCode -ne 0 -or $enable.ExitCode -ne 0)
        {
            $replugRecommended = $true
            Write-Info 'Disable/enable did not complete cleanly. A manual replug may still be needed.'
        }
        else
        {
            Write-Info 'Disable/enable sequence completed.'
        }
    }

    Write-Info ''
    Write-Info 'Verifying Native Instruments route...'

    if (-not (Verify-NativeInstrumentsRoute -InstanceId $instanceId))
    {
        Write-Info 'Native Instruments route was not active after restart/disable-enable.'
        Write-Info 'Trying device remove + hardware rescan...'

        $remove = Invoke-PnpUtil -Arguments @('/remove-device', $instanceId)

        if ($remove.ExitCode -ne 0 -and $remove.ExitCode -ne 3010)
        {
            throw 'Device remove failed; Windows did not return the screen interface to the Native Instruments route.'
        }

        $scan2 = Invoke-PnpUtil -Arguments @('/scan-devices')

        if ($scan2.ExitCode -ne 0)
        {
            throw 'Hardware rescan failed after device remove.'
        }

        if (-not (Verify-NativeInstrumentsRoute -InstanceId $instanceId))
        {
            throw 'Native Instruments route is still not active after removing the user-mode driver package. Unplug/replug the Maschine MK3 or reboot Windows.'
        }
    }

    Write-Info ''
    Write-Info 'Summary'

    if ($rebootNeeded)
    {
        Write-Info 'The user-mode driver package was removed and Native Instruments route verified, but Windows also reported a pending reboot.'
    }
    elseif ($replugRecommended)
    {
        Write-Info 'The user-mode driver package was removed and Native Instruments route verified after extra recovery steps.'
    }
    else
    {
        Write-Info 'The user-mode driver package was removed.'
        Write-Info 'Native Instruments route is active again.'
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

    if ($_.ScriptStackTrace)
    {
        Write-Host ''
        Write-Host 'Stack trace:'
        Write-Host $_.ScriptStackTrace
    }

    Write-Host ''
    Write-Host ('See log file: ' + $logPath)
    exit 1
}
finally
{
    if ($transcriptStarted)
    {
        try
        {
            Stop-Transcript | Out-Null
        }
        catch
        {
        }
    }

    if (-not $NoPause)
    {
        Write-Host ''
        if ($failed)
        {
            Read-Host 'Press Enter to close this window'
        }
        else
        {
            Read-Host 'Finished. Press Enter to close this window'
        }
    }
}