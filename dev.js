/**
 * Starts the blockchain node and the Vite dev server together for local use.
 *
 * Keeping both under one command avoids the usual failure mode where the frontend
 * proxies to a node that is not running, or to a stale port. The node port can be
 * overridden with IITKBUCKS_DEV_PORT when 3000 is taken by another project.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.IITKBUCKS_DEV_PORT || '3000';
const root = __dirname;
const web = path.join(root, 'web');
// Invoke Vite's CLI directly. Spawning `npm`/`npm.cmd` without a shell fails on
// Windows with EINVAL, and calling Vite skips an extra process layer.
const viteBin = path.join(web, 'node_modules', 'vite', 'bin', 'vite.js');

// The node reads ./config.json relative to its working directory, so point the port
// at the requested value without touching the committed default.
const configPath = path.join(root, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
config.port = Number(PORT);
config.myurl = `http://localhost:${PORT}`;
fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
console.log(`[dev] node will listen on ${PORT}`);

const children = [];

function run(name, cmd, args, cwd, env) {
  // shell:false keeps the interpreter path intact. With shell:true on Windows the
  // path is split on spaces ("C:\Program Files\nodejs\node.exe"), which breaks
  // whenever node is installed under a path containing a space.
  const child = spawn(cmd, args, {
    cwd,
    shell: false,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const tag = `[${name}]`;
  child.stdout.on('data', (d) => process.stdout.write(prefix(tag, d)));
  child.stderr.on('data', (d) => process.stderr.write(prefix(tag, d)));
  child.on('exit', (code) => {
    console.log(`${tag} exited with code ${code}`);
    shutdown();
  });
  children.push(child);
  return child;
}

function prefix(tag, buf) {
  return String(buf)
    .split(/\r?\n/)
    .filter((l) => l.length)
    .map((l) => `${tag} ${l}\n`)
    .join('');
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('node', process.execPath, ['main.js'], root, {});
run('web', process.execPath, [viteBin, '--port', '5173'], web, { VITE_DEV_NODE_PORT: PORT });

console.log('\n[dev] node  -> http://localhost:' + PORT);
console.log('[dev] wallet-> http://localhost:5173\n');
