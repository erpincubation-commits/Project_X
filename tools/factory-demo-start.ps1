# Starts only the local synthetic demo. It never reads or changes the root .env database.
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $demoRoot
$pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$pgReady = Join-Path $pgBin 'pg_isready.exe'
$psql = Join-Path $pgBin 'psql.exe'
$dataDir = Join-Path $demoRoot '.local\p2p-test-cluster-user'
if (!(Test-Path -LiteralPath $pgCtl) -or !(Test-Path -LiteralPath $dataDir)) { throw 'The isolated PostgreSQL 18 demo cluster is not installed in this workspace.' }
& $pgReady -h 127.0.0.1 -p 55439 -U p2p_test -d postgres | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDir -l (Join-Path $demoRoot '.local\factory-demo-postgres.log') -o '-p 55439 -h 127.0.0.1' -w start
  if ($LASTEXITCODE -ne 0) { throw 'The isolated demo PostgreSQL cluster could not start.' }
}
$actual = & $psql -h 127.0.0.1 -p 55439 -U p2p_test -d postgres -tAc 'SHOW data_directory'
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($actual.Trim()).TrimEnd('\') -ine [IO.Path]::GetFullPath($dataDir).TrimEnd('\')) { throw 'Port 55439 is not the expected isolated demo cluster.' }
$connection=New-Object Net.Sockets.TcpClient
try { $connection.Connect('127.0.0.1',3314); throw 'Port 3314 is already in use. The demo will not reuse that server.' }
catch [Net.Sockets.SocketException] { }
finally { $connection.Dispose() }
$demoProcess=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'tools/factory-demo-server.cjs' -WorkingDirectory $demoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $demoRoot '.local\factory-demo-server.out.log') -RedirectStandardError (Join-Path $demoRoot '.local\factory-demo-server.err.log') -PassThru
for($attempt=0;$attempt -lt 40;$attempt++) {
  Start-Sleep -Milliseconds 250
  $demoProcess.Refresh();if($demoProcess.HasExited){throw 'The demo server stopped. Check .local\factory-demo-server.err.log.'}
  try { $health=Invoke-RestMethod 'http://127.0.0.1:3314/api/v1/health' -TimeoutSec 1 } catch { continue }
  if($health.status -eq 'ready') {
    $listener=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3314 -State Listen -ErrorAction Stop
    if($listener.OwningProcess -ne $demoProcess.Id){throw 'Port 3314 belongs to another process; the demo will not connect to it.'}
    Write-Output 'Factory demo server ready at http://127.0.0.1:3314';exit 0
  }
}
throw 'The demo server did not become ready. Check .local\factory-demo-server.err.log.'
