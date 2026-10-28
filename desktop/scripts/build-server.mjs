// Bundles the Python server, strategy library, embedding model and built web app into
// backend/dist/kindling-server, so the installed app needs no Python or internet.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const backend = join(root, 'backend')
const web = join(root, 'web')
const python = join(backend, '.venv', 'Scripts', 'python.exe')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: cmd === 'npm' })

if (!existsSync(python)) throw new Error('Run start.bat once first to set up backend/.venv')
run(python, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '-r', 'requirements.txt', 'pyinstaller==6.16.0'], backend)
if (!existsSync(join(backend, '.models'))) run(python, ['-m', 'app.prefetch'], backend)
run('npm', ['run', 'build'], web)
run(python, [
  '-m', 'PyInstaller', 'server.py', '--name', 'kindling-server', '--onedir', '--noconfirm', '--clean',
  '--add-data', 'app/data;app/data',
  '--add-data', `${join(web, 'dist')};web_dist`,
  '--collect-all', 'fastembed',
  '--collect-all', 'onnxruntime',
  '--collect-all', 'tokenizers',
  '--collect-submodules', 'uvicorn',
], backend)

// onnxruntime needs MSVC runtime 14.40+, but PyInstaller copies Python's older msvcp140.dll,
// which crashes the model on load. Ship this machine's newer (redistributable) runtime instead.
const internal = join(backend, 'dist', 'kindling-server', '_internal')
for (const dll of ['msvcp140.dll', 'msvcp140_1.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']) {
  const system = join(process.env.SystemRoot || 'C:\Windows', 'System32', dll)
  if (existsSync(system)) copyFileSync(system, join(internal, dll))
}

// The Hugging Face cache stores model files as symlinks into a shared blob store, which would
// break on another laptop. Copy just the model snapshot, as real files.
const copyReal = (from, to) => {
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true })
    for (const name of readdirSync(from)) copyReal(join(from, name), join(to, name))
  } else {
    copyFileSync(realpathSync(from), to)
  }
}
const models = join(backend, '.models')
for (const repo of readdirSync(models).filter((d) => d.startsWith('models--'))) {
  for (const part of ['refs', 'snapshots', 'files_metadata.json']) {
    const from = join(models, repo, part)
    if (existsSync(from)) copyReal(from, join(internal, 'models', repo, part))
  }
}
