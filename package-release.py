from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
release = root / 'release'
release.mkdir(exist_ok=True)
files = [root / p for p in ['README.md', 'DEPLOYMENT.md', 'TEST-REPORT.md', '.gitignore', 'netlify.toml', 'package.json', 'verify.mjs', 'verify-deployment.mjs', 'package-release.py', '啟動工作台.cmd']]
files += [p for folder in ['dist', '.github', 'server', 'netlify', 'tests'] for p in (root / folder).rglob('*') if p.is_file()]
with ZipFile(release / 'relay-github-netlify-source.zip', 'w', ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path.relative_to(root).as_posix())
with ZipFile(release / 'relay-netlify-static.zip', 'w', ZIP_DEFLATED) as archive:
    for path in (root / 'dist').rglob('*'):
        if path.is_file():
            archive.write(path, path.relative_to(root / 'dist').as_posix())
for name in ['relay-github-netlify-source.zip', 'relay-netlify-static.zip']:
    with ZipFile(release / name) as archive:
        assert archive.testzip() is None
        assert not any(p.startswith(('.env', '.openai/', 'release/')) for p in archive.namelist())
        if 'source' in name:
            assert 'netlify/functions/relay-api.mjs' in archive.namelist()
            assert 'server/api.mjs' in archive.namelist()
        print(name, len(archive.namelist()), 'verified files')
