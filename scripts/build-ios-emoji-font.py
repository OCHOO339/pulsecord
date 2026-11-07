"""Build the bundled Chromium emoji font from the pinned upstream TTF.

Requires fonttools[woff], brotli and uharfbuzz. Only maintainers regenerating the asset
need Python; normal PulseCord builds use the checked-in WOFF2 directly.
"""
import sys
import json
import re
import hashlib
from pathlib import Path
import uharfbuzz as hb
from fontTools.ttLib import TTFont, woff2
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

source = Path(sys.argv[1]).read_bytes()
if hashlib.sha256(source).hexdigest() != 'e37c7af6265ac4a0af6d57bc65e86109a776d9966e8343334557f63da482516f':
    raise ValueError('Unexpected source font; use the pinned asset documented in packages/iosEmojis/README.md')
font = TTFont(sys.argv[1])
# Chromium strips Apple's AAT tables. Derive equivalent OpenType ligatures
# using the original font as a shaping oracle, including flags and ZWJ families.
oracle = hb.Font(hb.Face(source))
cmap = font.getBestCmap()
glyphs = font.getGlyphOrder()
metadata = Path('packages/iosEmojis/data.ts').read_text(encoding='utf8')
entries = json.loads(re.search(r'export const emojis = (.*);', metadata).group(1))
rules = {}
for entry in entries:
    for text in entry['unicode']:
        buffer = hb.Buffer()
        buffer.add_str(text)
        buffer.guess_segment_properties()
        hb.shape(oracle, buffer)
        ids = [info.codepoint for info in buffer.glyph_infos]
        if len(ids) != 1 or ids[0] == 0 or len(text) < 2:
            continue
        if not all(ord(char) in cmap for char in text):
            continue
        sequence = tuple(cmap[ord(char)] for char in text)
        rules[sequence] = glyphs[ids[0]]
features = 'lookup IOS {\n' + '\n'.join(
    'sub ' + ' '.join(sequence) + ' by ' + target + ';'
    for sequence, target in sorted(rules.items(), key=lambda item: -len(item[0]))
) + '\n} IOS;\nfeature rlig { lookup IOS; } rlig;'
addOpenTypeFeaturesFromString(font, features)
for table in ['morx', 'feat', 'trak', 'bgcl', 'DSIG', 'meta']:
    if table in font:
        del font[table]
# Text emoji are small; keep one 32px bitmap strike rather than eight strikes.
index = next(i for i, strike in enumerate(font['CBLC'].strikes)
             if strike.bitmapSizeTable.ppemX == 32)
font['CBDT'].strikeData = [font['CBDT'].strikeData[index]]
font['CBLC'].strikes = [font['CBLC'].strikes[index]]
compress = woff2.brotli.compress
def fast_compress(data, **options):
    options['quality'] = 5
    return compress(data, **options)
woff2.brotli.compress = fast_compress
font.flavor = 'woff2'
font.save(sys.argv[2])
print(f'Built Chromium font with {len(rules)} emoji sequence substitutions.')
