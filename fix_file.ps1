$filePath = "c:\CProjects\ITRoboticsCRM\ITRobotCRM\src\app\api\telegram\lesson\[id]\route.ts"
$content = Get-Content $filePath

$newContent = @()
foreach ($line in $content) {
    $line = $line -replace 'topic = \$\{queryParams\.length \+ 1\}', 'topic = $$`${queryParams.length + 1}'
    $line = $line -replace 'topic_set_by = \$\{queryParams\.length \+ 1\}', 'topic_set_by = $$`${queryParams.length + 1}'
    $line = $line -replace 'notes = \$\{queryParams\.length \+ 1\}', 'notes = $$`${queryParams.length + 1}'
    $line = $line -replace 'notes_set_by = \$\{queryParams\.length \+ 1\}', 'notes_set_by = $$`${queryParams.length + 1}'
    $newContent += $line
}

Set-Content -Path $filePath -Value $newContent -NoNewline
Write-Host "Done"