$inf2cat = Get-ChildItem "C:\Program Files (x86)\Windows Kits" -Filter Inf2Cat.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 5 FullName
$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits" -Filter signtool.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 5 FullName

"Inf2Cat:"
$inf2cat

""
"SignTool:"
$signtool

Read-Host "Press Enter to close"
Start-Sleep -Seconds 30
