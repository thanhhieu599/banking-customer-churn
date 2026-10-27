# Ghép src/ thành index.html một file (để publish/mở trực tiếp).
import pathlib
d = pathlib.Path(__file__).parent
page = (d/'src/page.html').read_text()
page = page.replace('/*CSS*/', (d/'src/styles.css').read_text())
page = page.replace('/*PARSER*/', (d/'src/parser.js').read_text())
page = page.replace('/*APP*/', (d/'src/app.js').read_text() + (d/'src/dashboard.js').read_text())
(d/'index.html').write_text(page)
print('index.html', len(page))
