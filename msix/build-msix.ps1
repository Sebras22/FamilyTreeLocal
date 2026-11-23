param(
    [string]$IdentityName = "Arbora.Local",
    [string]$Publisher = "CN=Arbora",
    [string]$PublisherDisplayName = "Arbora",
    [switch]$SkipBuild,
    [switch]$Sign
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauri = Join-Path $root "src-tauri"
$staging = Join-Path $PSScriptRoot "staging"
$out = Join-Path $PSScriptRoot "out"

$config = Get-Content (Join-Path $tauri "tauri.conf.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$version = "$($config.version).0"
if ($version -notmatch '^\d+\.\d+\.\d+\.0$') {
    throw "La version '$($config.version)' doit avoir trois nombres (ex. 0.1.0) : la quatrième partie doit rester 0 pour le Store."
}

$makeappx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\makeappx.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $makeappx) { throw "makeappx.exe est introuvable : installez le SDK Windows 10/11." }
$signtool = Join-Path $makeappx.DirectoryName "signtool.exe"

if (-not $SkipBuild) {
    Push-Location $root
    try {
        npm run tauri:build -- --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "La compilation de l'application a échoué." }
    } finally {
        Pop-Location
    }
}

$exe = Join-Path $tauri "target\release\arbora.exe"
if (-not (Test-Path $exe)) { throw "arbora.exe est introuvable : $exe" }

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $staging "Assets") -Force | Out-Null
New-Item -ItemType Directory -Path $out -Force | Out-Null

Copy-Item $exe $staging
foreach ($name in "Square44x44Logo", "Square150x150Logo", "StoreLogo") {
    Copy-Item (Join-Path $tauri "icons\$name.png") (Join-Path $staging "Assets\$name.png")
}

$manifest = Get-Content (Join-Path $PSScriptRoot "AppxManifest.xml") -Raw -Encoding UTF8
$escape = { param($v) [System.Security.SecurityElement]::Escape($v) }
$manifest = $manifest.Replace("{{IDENTITY_NAME}}", (& $escape $IdentityName)).
    Replace("{{PUBLISHER}}", (& $escape $Publisher)).
    Replace("{{PUBLISHER_DISPLAY_NAME}}", (& $escape $PublisherDisplayName)).
    Replace("{{VERSION}}", $version)
[System.IO.File]::WriteAllText((Join-Path $staging "AppxManifest.xml"), $manifest, (New-Object System.Text.UTF8Encoding($false)))

$package = Join-Path $out "Arbora_${version}_x64.msix"
& $makeappx.FullName pack /d $staging /p $package /o
if ($LASTEXITCODE -ne 0) { throw "makeappx a échoué." }

if ($Sign) {
    $cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher -KeyUsage DigitalSignature `
        -FriendlyName "Arbora (test local)" -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
    $cer = Join-Path $out "Arbora-test.cer"
    Export-Certificate -Cert $cert -FilePath $cer | Out-Null
    & $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $package
    if ($LASTEXITCODE -ne 0) { throw "signtool a échoué." }
    Write-Host "Paquet signé pour un test local. Certificat à approuver (administrateur) : $cer"
}

Write-Host "Paquet créé : $package"
