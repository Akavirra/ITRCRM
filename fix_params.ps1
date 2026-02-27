# Fix PostgreSQL parameter placeholders in telegram lesson route
$filePath = "c:\CProjects\ITRoboticsCRM\ITRobotCRM\src\app\api\telegram\lesson\[id]\route.ts"
$content = Get-Content -Path $filePath -Raw -Encoding UTF8

# Replace topic = ${queryParams.length + 1} with topic = ${"$"}{queryParams.length + 1}
$content = $content -replace 'topic = \$\{queryParams\.length \+ 1\}', 'topic = $$`${queryParams.length + 1}'
$content = $content -replace 'topic_set_by = \$\{queryParams\.length \+ 1\}', 'topic_set_by = $$`${queryParams.length + 1}'
$content = $content -replace 'notes = \$\{queryParams\.length \+ 1\}', 'notes = $$`${queryParams.length + 1}'
$content = $content -replace 'notes_set_by = \$\{queryParams\.length \+ 1\}', 'notes_set_by = $$`${queryParams.length + 1}'

Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
Write-Host "Fixed parameter placeholders"
