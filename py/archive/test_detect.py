import re
from urllib.parse import urlparse

def detect_target_cars(name, url):
    url_path = urlparse(url).path if url else ''
    clean_name = re.sub(r'\|\s*passione\s*500\s*$', '', name or '', flags=re.IGNORECASE).strip()
    text = f'{clean_name} {url_path}'.lower()
    cars = []
    if re.search(r'fiat[\s\-]*500', text): cars.append('Fiat 500')
    if re.search(r'\b126\b', text): cars.append('Fiat 126')
    if re.search(r'\b600\b', text): cars.append('Fiat 600')
    return ', '.join(cars) if cars else 'Fiat 500'

cases = [
    # 126専用品
    ('Door Fiat 126 | Passione 500',
     'https://passione500.it/en/fiat-126-en/body-parts-126-en/right-outer-door-panel-fiat-126/',
     'Fiat 126'),
    ('Rear Lamp Fiat 126 | Passione 500',
     'https://passione500.it/en/fiat-126-en/lamps-and-bulbs-126-en/right-hand-rear-lamp-lens-cover-fiat-126-bis/',
     'Fiat 126'),
    ('Mirror Fiat 126 | Passione 500',
     'https://passione500.it/en/fiat-126-en/mirrors-and-rear-view-mirrors-126-en/left-mirror-bolt-on-fiat-126-fsm/',
     'Fiat 126'),
    # 500専用品
    ('Carburettor Weber 26 IMB Fiat 500 | Passione 500',
     'https://passione500.it/en/fiat-500-en/engine-parts-n-en/carburettor-weber-26-imb-fiat-500/',
     'Fiat 500'),
    # 500と126の両方
    ('Bracket Kit Steering Rack Fiat 500 | Passione 500',
     'https://passione500.it/en/fiat-500-en/fiat-500-tt-en/suspension-and-steering-tt-en/steering-tt-en/complete-bracket-for-mounting-steering-rack-fiat-126-on-fiat-500/',
     'Fiat 500, Fiat 126'),
    # 500, 126, 600の3車種
    ('Timing chain Cover Fiat 500 | Passione 500',
     'https://passione500.it/en/fiat-500-en/fiat-500-n-en/engine-parts-n-en/timing-chain-and-valves-n-en/timing-chain-cover-with-complete-oil-pump-fiat-126-modify-600-650-cc-fiat-500-n-d-f-l-r/',
     'Fiat 500, Fiat 126, Fiat 600'),
    # 誤検出チェック: "600" が部品番号に含まれる（仮のケース）
    ('Gasket 0600-A for Fiat 500 | Passione 500',
     'https://passione500.it/en/fiat-500-en/engine-parts-n-en/gasket-0600-a-fiat-500/',
     'Fiat 500'),  # Fiat 600 は含まれてはいけない
]

print('=' * 65)
all_ok = True
for name, url, expected in cases:
    result = detect_target_cars(name, url)
    ok = result == expected
    if not ok:
        all_ok = False
    status = 'OK' if ok else 'NG'
    print(f'[{status}] {name[:50]}')
    if not ok:
        print(f'     期待: {expected}')
        print(f'     結果: {result}')
print('=' * 65)
print('全件OK' if all_ok else '不一致あり → 要修正')
