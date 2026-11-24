const { app, BrowserWindow, Menu, protocol, session, dialog } = require('electron');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'cc-desktop-smoke-' + process.pid));
app.setName('Computation Constellations');
protocol.registerSchemesAsPrivileged([{ scheme: 'constellation', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const root = path.join(__dirname, '..');
const resources = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ...['app', 'model', 'io'].map(name => [`/src/${name}.js`, [`src/${name}.js`, 'text/javascript']]),
]);
const trusted = value => { try { const u = new URL(value); return u.protocol === 'constellation:' && u.host === 'app'; } catch { return false; } };
let win;
async function createWindow() {
  win = new BrowserWindow({ width: 1600, height: 1050, minWidth: 900, minHeight: 650,
    title: 'Computation Constellations · 17 stars', show: !smoke,
    backgroundColor: '#f5f4f0', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('will-prevent-unload', async event => {
    const result = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Keep editing', 'Discard unsaved changes'], defaultId: 0, cancelId: 0, message: 'Some changes have not been saved. Close anyway?' });
    if (result.response === 1) win.destroy();
  });
  await win.loadURL('constellation://app/?master=1');
  if (smoke) {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const model = await import('/src/model.js'); const io = await import('/src/io.js');
        const doc = model.masterSeed();
        if (document.querySelectorAll('[data-node]').length !== 17) throw Error('17-star screen did not render');
        if (!document.querySelector('h1').textContent.includes('17 stars')) throw Error('Wrong default workspace');
        if (model.validate(doc).errors.length) throw Error('Invalid master');
        const reopened = io.fromDrawio(io.toDrawio(doc));
        if (reopened.catalog.stars.length !== 17) throw Error('Round trip failed');
        const vsdx = io.toVisio(doc), vssx = io.toVisioStencil(doc);
        if (vsdx[0] !== 80 || vssx[0] !== 80) throw Error('Visio package generation failed');
        localStorage.setItem('desktop-smoke', 'persistent');
        if (localStorage.getItem('desktop-smoke') !== 'persistent') throw Error('Storage failed');
        return {stars: 17, cases: doc.cases.length, roundTrip: true, secureContext: isSecureContext, nodeExposed: typeof require !== 'undefined'};
      })()`);
      if (!result.secureContext || result.nodeExposed) throw Error('Renderer isolation failed');
      await win.webContents.reload();
      await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      const persisted = await win.webContents.executeJavaScript(`localStorage.getItem('desktop-smoke')`);
      if (persisted !== 'persistent') throw Error('Reload persistence failed');
      console.log('DESKTOP_SMOKE_PASS ' + JSON.stringify(result));
      app.exit(0);
    } catch (error) { console.error('DESKTOP_SMOKE_FAIL', error); app.exit(1); }
  }
}
app.whenReady().then(async () => {
  protocol.handle('constellation', async request => {
    const u = new URL(request.url), asset = resources.get(u.pathname);
    if (!trusted(request.url) || !asset || request.method !== 'GET') return new Response('Not found', { status: 404 });
    return new Response(await readFile(path.join(root, asset[0])), { headers: {
      'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    } });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'Export constellation', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'close' }, ...(process.platform === 'darwin' ? [] : [{ role: 'quit' }])] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'About this standalone edition', click: () => dialog.showMessageBox(win, { message: 'Computation Constellations · 17 stars', detail: 'Offline diagram authoring. No represented system is executed.\n\nImport an editable .drawio export to transfer your browser diagrams. Local drafts are kept in this app’s own profile. Export backups before moving machines.\n\nThis development release is not publisher-signed. Human finalization remains blocked without trusted identity.', buttons: ['OK'] }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  await createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
