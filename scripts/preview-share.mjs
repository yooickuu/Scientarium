import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = Number(process.env.PREVIEW_PORT || 3107);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('PREVIEW_PORT must be between 1024 and 65535');
const binary = process.env.CLOUDFLARED_BIN || (existsSync('.tools/cloudflared') ? path.resolve('.tools/cloudflared') : 'cloudflared');
const binaryCheck = spawnSync(binary, ['--version'], { encoding: 'utf8' });
if (binaryCheck.status !== 0) throw new Error('Install cloudflared from https://developers.cloudflare.com/tunnel/downloads/ or set CLOUDFLARED_BIN');

const children = new Set();
const temp = mkdtempSync(path.join(tmpdir(), 'scientarium-preview-'));
let stopping = false;
let readyTimer;
let web;
let publicOrigin;
function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(readyTimer);
  for (const child of children) child.kill('SIGTERM');
  const force = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    rmSync(temp, { recursive: true, force: true });
    process.exit(code);
  }, 2500);
  force.unref();
  process.exitCode = code;
  console.log('\nВременный просмотр остановлен.');
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
process.once('exit', () => rmSync(temp, { recursive: true, force: true }));
process.once('uncaughtException', (error) => { console.error(error.message); stop(1); });
process.once('unhandledRejection', (error) => { console.error(error?.message || error); stop(1); });

// Never accidentally tunnel a different process already using the preview port.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', () => reject(new Error(`Port ${port} is busy. Set another PREVIEW_PORT.`)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});

if (!process.argv.includes('--skip-build')) {
  console.log('Собираю оптимизированную версию сайта...');
  const build = launch(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack']);
  build.stdout.pipe(process.stdout); build.stderr.pipe(process.stderr);
  const code = await new Promise((resolve, reject) => { build.once('exit', resolve); build.once('error', reject); });
  if (code !== 0 || stopping) { stop(1); } 
} else if (!existsSync('.next/BUILD_ID')) {
  throw new Error('Run npm run build before --skip-build');
}

if (!stopping) {
  // Explicit empty configuration avoids inheriting any other Cloudflare tunnel.
  const config = path.join(temp, 'cloudflared.yml');
  writeFileSync(config, '{}\n', { mode: 0o600 });
  console.log('Открываю временную HTTPS-ссылку. Любой, у кого есть ссылка, сможет открыть сайт.');
  console.log('Админка требует обычного входа. Рабочая локальная база сохраняется.');
  const tunnel = launch(binary, ['tunnel', '--config', config, '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`]);
  let tunnelOutput = '';
  const watchTunnel = (chunk) => {
    const text = chunk.toString();
    tunnelOutput = (tunnelOutput + text).slice(-20000);
    const match = tunnelOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
    if (match && !web && !stopping) startWeb(match[0]);
  };
  tunnel.stdout.on('data', watchTunnel); tunnel.stderr.on('data', watchTunnel);
  tunnel.once('error', (error) => { console.error(error.message); stop(1); });
  tunnel.once('exit', (code) => {
    if (!stopping) { console.error(`Туннель остановился (${code}).\n${tunnelOutput}`); stop(1); }
  });
  readyTimer = setTimeout(() => { console.error('Не удалось запустить просмотр за 90 секунд.\n' + tunnelOutput); stop(1); }, 90_000);

  function startWeb(origin) {
    publicOrigin = origin;
    web = launch(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      env: { ...process.env, NODE_ENV: 'production', APP_ORIGIN: origin },
    });
    let output = '';
    let checking = false;
    const watchWeb = (chunk) => {
      output = (output + chunk.toString()).slice(-10000);
      if (/Ready in/.test(output) && !checking) { checking = true; checkReady(); }
    };
    web.stdout.on('data', watchWeb); web.stderr.on('data', watchWeb);
    web.once('error', (error) => { console.error(error.message); stop(1); });
    web.once('exit', (code) => {
      if (!stopping) { console.error(`Сервер остановился (${code}).\n${output}`); stop(1); }
    });
  }

  async function checkReady() {
    const response = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Preview API failed: ' + response.status);
    clearTimeout(readyTimer);
    // Warm common pages and local logos before the first phone visit.
    await Promise.allSettled(['/', '/admin', '/profile', ...[48, 96, 640].map(w => `/_next/image?url=%2Fscientarium-owl.png&w=${w}&q=75`)].map(url => fetch(`http://127.0.0.1:${port}${url}`, { headers: { accept: 'image/webp' }, signal: AbortSignal.timeout(15_000) })));
    try {
      if (existsSync('private')) {
        writeFileSync('private/preview-link.txt', `${publicOrigin}\n\nОбновлённая версия Scientarium готова к просмотру. Ноутбук должен быть включён и не спать. Остановка: Ctrl+C.\n`);
      }
    } catch {}
    console.log(`\nССЫЛКА ДЛЯ ТЕЛЕФОНА И ЗАКАЗЧИКА:\n${publicOrigin}\n`);
    console.log('HTTPS, готовая сборка, без компиляции страниц при открытии.');
    console.log('Ноутбук должен быть включён. Не закрывайте терминал. Остановка: Ctrl+C.');
    console.log('При следующем запуске будет новая ссылка. После изменения кода перезапустите npm run preview:share.');
  }
}
