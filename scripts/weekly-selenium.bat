@echo off
:: weekly-selenium.bat
:: Selenium 5ショップを順次並列クロール
:: Windowsタスクスケジューラで毎週土曜 02:00 に実行

set PYDIR=C:\Users\akayu\Documents\registro500-giappone\py
set LOGDIR=C:\Users\akayu\Desktop
set LOGFILE=%LOGDIR%\weekly-selenium-%date:~0,4%%date:~5,2%%date:~8,2%.log

echo [%date% %time%] Selenium週次クロール開始 > %LOGFILE%

cd /d %PYDIR%

echo [%date% %time%] Passione 500 開始... >> %LOGFILE%
python run_parallel.py passione >> %LOGFILE% 2>&1
echo [%date% %time%] Passione 500 完了 >> %LOGFILE%

echo [%date% %time%] FD Ricambi 開始... >> %LOGFILE%
python run_parallel.py fd >> %LOGFILE% 2>&1
echo [%date% %time%] FD Ricambi 完了 >> %LOGFILE%

echo [%date% %time%] EuroItalia500 開始... >> %LOGFILE%
python run_parallel.py euro >> %LOGFILE% 2>&1
echo [%date% %time%] EuroItalia500 完了 >> %LOGFILE%

echo [%date% %time%] D'Angelo Motori 開始... >> %LOGFILE%
python run_parallel.py dangelo >> %LOGFILE% 2>&1
echo [%date% %time%] D'Angelo 完了 >> %LOGFILE%

echo [%date% %time%] Axel Gerstl 開始... >> %LOGFILE%
python run_parallel.py axel >> %LOGFILE% 2>&1
echo [%date% %time%] Axel 完了 >> %LOGFILE%

echo [%date% %time%] 全Seleniumクロール完了 >> %LOGFILE%
