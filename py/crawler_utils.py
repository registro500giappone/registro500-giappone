"""
crawler_utils.py
全クローラー共通のユーティリティ（2026/02/21）
- ChromeDriverキャッシュパッチ（並列起動時のファイルロック競合回避）
- setup_driver(): page_load_strategy='eager' + 最適化設定
- Supabase接続
"""
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client

# --- ChromeDriverキャッシュパッチ（並列起動の競合回避）---
CHROMEDRIVER_PATH = r"C:\Users\akayu\.wdm\drivers\chromedriver\win64\144.0.7559.133\chromedriver.exe"
try:
    import webdriver_manager.chrome as _wdm_chrome
    _wdm_chrome.ChromeDriverManager.install = lambda self: CHROMEDRIVER_PATH
except Exception as e:
    print(f"[WARN] ChromeDriverパッチ失敗（手動パスで続行）: {e}")

BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"


def get_supabase():
    """Supabaseクライアントを返す"""
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def setup_driver():
    """
    最適化版 Selenium WebDriver（2026/02/21）
    変更点:
      - page_load_strategy='eager'（DOMのみ待機→詰まり防止）
      - page_load_timeout=20秒（30秒から短縮）
      - implicitly_wait=3秒（5秒から短縮）
    """
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-extensions')
    # ★ 詰まり対策: DOMが構築されたら即返す
    options.page_load_strategy = 'eager'
    prefs = {
        'profile.managed_default_content_settings.images': 2,
        'profile.default_content_setting_values.notifications': 2
    }
    options.add_experimental_option('prefs', prefs)
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--window-size=1280,1024')
    options.add_argument("--log-level=3")
    options.add_argument('--lang=en')
    options.add_argument(f'--user-agent={BOT_USER_AGENT}')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(20)
    driver.implicitly_wait(3)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument',
        {'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'})
    return driver
