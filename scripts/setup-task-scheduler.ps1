# setup-task-scheduler.ps1
# Windowsタスクスケジューラに週次Seleniumクロールを登録するスクリプト
# 管理者権限で実行: PowerShell を右クリック → 管理者として実行

$TaskName = "Registro500-Weekly-Selenium"
$BatFile  = "C:\Users\akayu\Documents\registro500-giappone\scripts\weekly-selenium.bat"

# 既存タスクがあれば削除
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# トリガー: 毎週土曜 02:00
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At "02:00"

# アクション: バッチファイル実行
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatFile`""

# 設定: PCスリープ解除あり・バッテリー動作OK
$Settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -StartWhenAvailable

# 登録
Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $Trigger `
    -Action $Action `
    -Settings $Settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ タスク登録完了: $TaskName"
Write-Host "   実行スケジュール: 毎週土曜 02:00"
Write-Host "   ログ保存先: C:\Users\akayu\Desktop\weekly-selenium-YYYYMMDD.log"
