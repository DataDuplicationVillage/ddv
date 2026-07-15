$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonExe)) {
  Write-Error "Python virtual environment not found at $pythonExe"
}

& $pythonExe manage.py test tracker.tests -v 2
exit $LASTEXITCODE
