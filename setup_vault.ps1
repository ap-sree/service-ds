param (
    [string]$VaultToken = "root",
    [string]$VaultAddress = "http://aps-hsv.c6h5awbhfpc5avhn.southindia.azurecontainer.io:8200"
)

$Headers = @{
    "X-Vault-Token" = $VaultToken
    "Content-Type"  = "application/json"
}

function Invoke-VaultRequest {
    param (
        [string]$Method,
        [string]$Path,
        [hashtable]$Body = $null
    )
    $Url = "$VaultAddress$Path"
    try {
        if ($Body) {
            $JsonBody = $Body | ConvertTo-Json -Depth 10
            return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body $JsonBody -ErrorAction Stop
        } else {
            return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ErrorAction Stop
        }
    } catch {
        Write-Error "Failed to call Vault API ($Path): $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $Reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
            $Content = $Reader.ReadToEnd()
            Write-Error "Response: $Content"
        }
        # Continue mostly, or exit? Let's verify status.
        # Some errors like 'already enabled' are fine.
    }
}

Write-Host "Setting up Vault via API at $VaultAddress..."

# 1. Enable KV v2 secrets engine at 'kv'
# Check if enabled first or just try to enable
Write-Host "Enabling KV v2 engine..."
try {
    Invoke-VaultRequest -Method POST -Path "/v1/sys/mounts/kv" -Body @{
        type = "kv"
        options = @{ version = "2" }
    }
} catch {
    Write-Warning "Could not enable KV mount. It might already be mounted."
}

# 2. Write secrets for the application
Write-Host "Writing secrets to kv/data/application..."
$Secrets = @{
    data = @{
        db_url      = "jdbc:sqlserver://sreemat.database.windows.net:1433;database=free-sql-db-6922974;encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30"
        db_username = "svc_dashboard_user"
        db_password = "apldj29ja9h@iqwjakjsda"
    }
}
Invoke-VaultRequest -Method POST -Path "/v1/kv/data/application" -Body $Secrets | Out-Null

# 3. Enable AppRole authentication
Write-Host "Enabling AppRole auth..."
try {
    Invoke-VaultRequest -Method POST -Path "/v1/sys/auth/approle" -Body @{ type = "approle" }
} catch {
    Write-Warning "Could not enable AppRole. It might already be enabled."
}

# 4. Create a policy
Write-Host "Creating 'dashboard-policy'..."
$PolicyRules = 'path "kv/data/application" { capabilities = ["read"] }'
Invoke-VaultRequest -Method PUT -Path "/v1/sys/policies/acl/dashboard-policy" -Body @{ policy = $PolicyRules } | Out-Null

# 5. Create an AppRole linked to the policy
Write-Host "Creating AppRole 'dashboard-role'..."
Invoke-VaultRequest -Method POST -Path "/v1/auth/approle/role/dashboard-role" -Body @{
    token_policies = "dashboard-policy"
    token_ttl      = "1d"
    token_max_ttl  = "4d"
} | Out-Null

# 6. Fetch Role ID
Write-Host "Fetching Role ID..."
$RoleInfo = Invoke-VaultRequest -Method GET -Path "/v1/auth/approle/role/dashboard-role/role-id"
$RoleId = $RoleInfo.data.role_id

# 7. Generate Secret ID
Write-Host "Generating Secret ID..."
$SecretInfo = Invoke-VaultRequest -Method POST -Path "/v1/auth/approle/role/dashboard-role/secret-id"
$SecretId = $SecretInfo.data.secret_id

Write-Host "`n---------------------------------------------------"
Write-Host "Vault Setup Complete."
Write-Host "Role ID:   $RoleId"
Write-Host "Secret ID: $SecretId"
Write-Host "---------------------------------------------------"
Write-Host "Please set the following environment variables:"
Write-Host "VAULT_ROLE_ID=$RoleId"
Write-Host "VAULT_SECRET_ID=$SecretId"
Write-Host "---------------------------------------------------"
