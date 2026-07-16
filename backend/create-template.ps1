$adminLogin = Invoke-RestMethod -Uri "http://localhost:3000/auth/admin/login" -Method POST -ContentType "application/json" -Body '{"email":"admin_test@azrebate.com","password":"Test@1234"}'
$adminToken = $adminLogin.accessToken

$body = @{
    name = "Template Test Phase3"
    description = "test"
    items = @(
        @{ assetId = "83f157cb-d1ad-4f96-8aa4-834ceecc56a1"; rebateUnit = 5; markupPips = 5 }
    )
} | ConvertTo-Json -Depth 5

$template = Invoke-RestMethod -Uri "http://localhost:3000/admin/templates" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $adminToken" } -Body $body

Write-Host "TEMPLATE_ID=$($template.id)"
