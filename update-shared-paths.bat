@echo off
echo Updating all HTML files to use /shared/ paths for scripts and styles...

REM Use PowerShell to do find and replace across all HTML files
powershell -Command "$files = Get-ChildItem -Path 'public' -Include '*.html' -Recurse; foreach ($file in $files) { $content = Get-Content $file.FullName -Raw; $content = $content -replace 'src=\"/modern-navbar\.js\"', 'src=\"/shared/modern-navbar.js\"'; $content = $content -replace 'src=\"/user-selector\.js\"', 'src=\"/shared/user-selector.js\"'; $content = $content -replace 'src=\"/user-login\.js\"', 'src=\"/shared/user-login.js\"'; $content = $content -replace 'src=\"/user-passwords\.js\"', 'src=\"/shared/user-passwords.js\"'; $content = $content -replace 'src=\"/voice-widget\.js\"', 'src=\"/shared/voice-widget.js\"'; $content = $content -replace 'src=\"/dark-mode\.js\"', 'src=\"/shared/dark-mode.js\"'; $content = $content -replace 'src=\"/quick-actions\.js\"', 'src=\"/shared/quick-actions.js\"'; $content = $content -replace 'src=\"/scripts\.js\"', 'src=\"/shared/scripts.js\"'; $content = $content -replace 'src=\"/search-history\.js\"', 'src=\"/shared/search-history.js\"'; $content = $content -replace 'src=\"/lineage\.js\"', 'src=\"/shared/lineage.js\"'; $content = $content -replace 'src=\"/calculations\.js\"', 'src=\"/shared/calculations.js\"'; $content = $content -replace 'href=\"/styles\.css\"', 'href=\"/shared/styles.css\"'; Set-Content $file.FullName $content; Write-Host \"Updated: $($file.Name)\"; }"

echo.
echo All paths updated to use /shared/ folder!
pause

