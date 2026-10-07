"""List the Japanese strings of the paint notebook that the dictionaries do not cover yet.

    python paint-notebook/i18n/extract_i18n.py [lang]      # default lang = en; writes i18n/todo_<lang>.json

Same extractor as engine-simulator/i18n/extract_i18n.py, pointed at the paint notebook.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'engine-simulator' / 'i18n'))
import extract_i18n as ex  # noqa: E402

ex.SRC = ROOT / 'paint-notebook'
ex.I18N = ex.SRC / 'i18n'
ex.PAGES = ['index', '126', 'drive', 'gallery']
ex.MODULES = ['car.js', 'car126.js', 'post.js']

if __name__ == '__main__':
    ex.main()
