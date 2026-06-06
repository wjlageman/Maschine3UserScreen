#Requires -RunAsAdministrator

param(
    [string]$CertName = 'Maschine3Display Test',
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

$DriverDir = Join-Path $ScriptRootDir 'WinUsb'
if (-not (Test-Path $DriverDir))
{
    $DriverDir = Join-Path $PackageRootDir 'WinUsb'
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

function Find-ToolPath
{
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $roots = @(
        'C:\Program Files (x86)\Windows Kits',
        'C:\Program Files\Windows Kits'
    )

    foreach ($root in $roots)
    {
        if (-not (Test-Path $root))
        {
            continue
        }

        $found = Get-ChildItem -Path $root -Filter $FileName -File -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1

        if ($null -ne $found)
        {
            return $found.FullName
        }
    }

    return $null
}

function Invoke-External
{
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Info ("Running: " + $ExePath + ' ' + ($Arguments -join ' '))

    $output = & $ExePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    $lines = @(Normalize-ToArray $output)

    foreach ($line in $lines)
    {
        Write-Host $line
    }

    if ($exitCode -ne 0)
    {
        throw ("Command failed with exit code " + $exitCode + ": " + $ExePath)
    }
}

function Get-OrCreate-TestCertificate
{
    param([string]$SubjectName)

    $subject = 'CN=' + $SubjectName

    $existing = Get-ChildItem Cert:\LocalMachine\My |
        Where-Object { $_.Subject -eq $subject } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1

    if ($null -ne $existing)
    {
        Write-Info ("Using existing certificate: " + $existing.Thumbprint)
        return $existing
    }

    Write-Info ("Creating new test certificate: " + $subject)

    return New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $subject `
        -CertStoreLocation 'Cert:\LocalMachine\My' `
        -HashAlgorithm 'SHA256' `
        -KeyAlgorithm 'RSA' `
        -KeyLength 2048 `
        -NotAfter (Get-Date).AddYears(3)
}

function Ensure-Certificate-Trusted
{
    param(
        $Certificate,
        [string]$CerPath
    )

    Export-Certificate -Cert $Certificate -FilePath $CerPath -Force | Out-Null

    $root = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine')
    $root.Open('ReadWrite')
    if (-not ($root.Certificates | Where-Object { $_.Thumbprint -eq $Certificate.Thumbprint }))
    {
        $root.Add($Certificate)
        Write-Info 'Added to Root store'
    }
    $root.Close()

    $pub = New-Object System.Security.Cryptography.X509Certificates.X509Store('TrustedPublisher', 'LocalMachine')
    $pub.Open('ReadWrite')
    if (-not ($pub.Certificates | Where-Object { $_.Thumbprint -eq $Certificate.Thumbprint }))
    {
        $pub.Add($Certificate)
        Write-Info 'Added to TrustedPublisher store'
    }
    $pub.Close()
}

$failed = $false

try
{
    Write-Info 'Maschine MK3 driver package build/sign'
    Write-Info ("Driver folder: " + $DriverDir)

    if (-not (Test-Path $DriverDir))
    {
        throw "Driver folder not found: $DriverDir"
    }

    $infPath = Join-Path $DriverDir 'MaschineMK3DisplayWinUSB.inf'
    $catPath = Join-Path $DriverDir 'MaschineMK3DisplayWinUSB.cat'
    $cerPath = Join-Path $DriverDir 'Maschine3DisplayTest.cer'

    if (-not (Test-Path $infPath))
    {
        throw ("INF not found: " + $infPath)
    }

    $inf2cat = Find-ToolPath 'Inf2Cat.exe'
    $signtool = Find-ToolPath 'signtool.exe'

    if (-not $inf2cat)
    {
        throw 'Inf2Cat not found'
    }

    if (-not $signtool)
    {
        throw 'SignTool not found'
    }

    Write-Info ("Inf2Cat: " + $inf2cat)
    Write-Info ("SignTool: " + $signtool)

    $cert = Get-OrCreate-TestCertificate $CertName
    Write-Info ("Cert thumbprint: " + $cert.Thumbprint)

    Ensure-Certificate-Trusted $cert $cerPath

    if (Test-Path $catPath)
    {
        Remove-Item $catPath -Force
    }

    # 🔑 BELANGRIJK: alleen MaschineMK3DisplayWinUsb folder gebruiken
    Invoke-External $inf2cat @(
        "/driver:$DriverDir",
        "/os:10_X64"
    )

    if (-not (Test-Path $catPath))
    {
        throw "CAT not generated"
    }

    Invoke-External $signtool @(
        "sign",
        "/fd", "SHA256",
        "/s", "My",
        "/sm",
        "/sha1", $cert.Thumbprint,
        $catPath
    )

    Write-Info "SUCCESS"
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
            Read-Host 'Done. Press Enter'
        }
    }
}