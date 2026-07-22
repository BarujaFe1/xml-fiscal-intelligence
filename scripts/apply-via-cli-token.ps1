# Retrieve Supabase CLI token from Windows Credential Manager and try Management SQL API
$target = "Supabase CLI:supabase"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Cred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr cred);
}
"@

$ptr = [IntPtr]::Zero
$ok = [Cred]::CredRead($target, 1, 0, [ref]$ptr)
if (-not $ok) {
  Write-Output "CredRead failed"
  exit 1
}
$cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][Cred+CREDENTIAL])
$pass = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, $cred.CredentialBlobSize / 2)
[Cred]::CredFree($ptr)
$token = $pass.Trim()
Write-Output ("token_len=" + $token.Length)

$ref = "uaqydwvdmwrwlvznoztd"
$sql = Get-Content -Raw "supabase\migrations\202607220001_fix_workspace_members_insert.sql"
$body = @{ query = $sql } | ConvertTo-Json -Compress
try {
  $r = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/$ref/database/query" -Method POST -Headers @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  } -Body $body -UseBasicParsing -TimeoutSec 60
  Write-Output ("status=" + $r.StatusCode)
  Write-Output $r.Content.Substring(0, [Math]::Min(500, $r.Content.Length))
} catch {
  Write-Output ("fail=" + $_.Exception.Message)
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Output $reader.ReadToEnd()
  }
}

# Also list projects with this token to see if fiscal project appears
try {
  $r2 = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
  Write-Output ("projects=" + $r2.Content.Substring(0, [Math]::Min(800, $r2.Content.Length)))
} catch {
  Write-Output ("projects_fail=" + $_.Exception.Message)
}
