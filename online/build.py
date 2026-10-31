"""Build the current online pages from readable feature scripts. Standard library only."""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'src'


def build(check=False):
    for page in ('index', 'gerber'):
        template = (SOURCE / f'{page}.template.html').read_text(encoding='utf-8')

        def script(match):
            path = (SOURCE / match[1]).resolve()
            if not path.is_relative_to(SOURCE.resolve()) or not path.is_file():
                raise ValueError(f'Invalid script source: {match[1]}')
            return path.read_text(encoding='utf-8')

        html, count = re.subn(r'/\* SOURCE:([a-z0-9/.-]+) \*/', script, template)
        if count == 0 or '/* SOURCE:' in html:
            raise ValueError(f'Unresolved source markers in {page}')
        target = ROOT / f'{page}.html'
        content = html.encode('utf-8')
        if check:
            if not target.is_file() or target.read_bytes() != content:
                raise SystemExit(f'STALE: {target.name}; run python online/build.py')
        else:
            target.write_bytes(content)
        print(f'{"CHECK" if check else "BUILT"}: {page}.html ({count} scripts)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
