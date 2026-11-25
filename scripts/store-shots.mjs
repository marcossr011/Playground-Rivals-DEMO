import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

// Genera capturas de tienda contra el servidor de desarrollo (npm run dev).
// Requiere Chrome o Edge instalados. Salida: store/screenshots/.

const APP_URL = process.env.SHOTS_URL ?? 'http://localhost:5173';
const PORT = 9333;
const root = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.join(root, '..', 'store', 'screenshots');

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error('No encuentro Chrome ni Edge. Define CHROME_PATH.');
  process.exit(1);
}

const profileDir = path.join(os.tmpdir(), `recreo-shots-${process.pid}`);
mkdirSync(profileDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank'
  ],
  { stdio: 'ignore' }
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function targetWebSocket() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome aún arrancando.
    }
    await wait(250);
  }
  throw new Error('Chrome no expone DevTools.');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }
}

async function settle(cdp) {
  await cdp.evaluate('document.fonts.ready.then(() => true)').catch(() => {});
  await wait(450);
}

async function scrollTop(cdp) {
  await cdp.evaluate(
    '(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; window.scrollTo(0, 0); return true; })()'
  );
  await wait(350);
}

async function screenshot(cdp, file) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  console.log('·', path.relative(path.join(root, '..'), file));
}

async function ensureOnboarded(cdp) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const state = await cdp.evaluate(
      `(() => {
        const button = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Entrar al recreo');
        if (button) { button.click(); return 'clicked'; }
        return document.querySelector('.topbar') ? 'done' : 'wait';
      })()`
    );
    if (state === 'done') {
      await wait(500);
      return;
    }
    await wait(400);
  }
  throw new Error('La app no terminó el onboarding.');
}

async function ensureRoom(cdp) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await cdp.evaluate(
      `(() => {
        if (location.pathname.startsWith('/calle/')) return 'done';
        const button = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Crear sala para amigos'));
        if (button) { button.click(); return 'clicked'; }
        return 'wait';
      })()`
    );
    if (state === 'done') {
      await wait(2200);
      return;
    }
    await wait(500);
  }
  throw new Error('No se pudo crear la sala de calle.');
}

const profiles = [
  { dir: 'iphone-6.7', width: 430, height: 932, scale: 3 },
  { dir: 'android-phone', width: 360, height: 640, scale: 3 }
];

async function run() {
  const cdp = new Cdp(await targetWebSocket());
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const profile of profiles) {
    mkdirSync(path.join(outRoot, profile.dir), { recursive: true });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: profile.width,
      height: profile.height,
      deviceScaleFactor: profile.scale,
      mobile: false,
      screenWidth: profile.width,
      screenHeight: profile.height
    });

    await cdp.send('Page.navigate', { url: `${APP_URL}/` });
    await wait(1500);
    await ensureOnboarded(cdp);
    await settle(cdp);
    await scrollTop(cdp);
    await settle(cdp);
    await scrollTop(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '01-inicio.png'));

    await cdp.send('Page.navigate', { url: `${APP_URL}/explorar` });
    await wait(1400);
    await settle(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '02-explorar.png'));

    await cdp.send('Page.navigate', { url: `${APP_URL}/juego/2048-4-2048` });
    await wait(1700);
    await settle(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '03-juego-2048.png'));

    await cdp.send('Page.navigate', { url: `${APP_URL}/vida-real/pilla-pilla` });
    await wait(1400);
    await ensureRoom(cdp);
    await scrollTop(cdp);
    await settle(cdp);
    await scrollTop(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '04-sala-calle.png'));

    await cdp.evaluate(
      `(() => { const map = document.querySelector('.outdoor-room-map'); if (map) map.scrollIntoView({ block: 'center' }); return true; })()`
    );
    await wait(900);
    await settle(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '05-mapa-zona.png'));

    await cdp.send('Page.navigate', { url: `${APP_URL}/perfil` });
    await wait(1400);
    await settle(cdp);
    await scrollTop(cdp);
    await screenshot(cdp, path.join(outRoot, profile.dir, '06-perfil.png'));
  }

  cdp.ws.close();
}

run()
  .catch((error) => {
    console.error('Fallo generando capturas:', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
    setTimeout(() => {
      try {
        rmSync(profileDir, { recursive: true, force: true });
      } catch {
        // Perfil temporal bloqueado; Windows lo libera al cerrar Chrome.
      }
    }, 800);
  });
