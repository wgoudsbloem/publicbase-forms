import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const certDir = path.join(__dirname, '.cert');
const keyPath = path.join(certDir, 'localhost.key');
const certPath = path.join(certDir, 'localhost.crt');

const port = Number(process.env.PORT) || 5177;
const host = process.env.HOST || '0.0.0.0';

const ensureCert = () => {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return;
  fs.mkdirSync(certDir, { recursive: true });
  const cmd = [
    'openssl req -x509 -newkey rsa:2048 -nodes',
    `-keyout "${keyPath}"`,
    `-out "${certPath}"`,
    '-days 365',
    '-subj "/CN=forms.publicbase.com"'
  ].join(' ');
  execSync(cmd, { stdio: 'ignore' });
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const safePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(rootDir, normalized);
};

const serveFile = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
};

const server = (req, res) => {
  const filePath = safePath(req.url || '/');
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr) => {
        if (indexErr) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        serveFile(res, indexPath);
      });
      return;
    }
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    serveFile(res, filePath);
  });
};

ensureCert();
const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

https.createServer(options, server).listen(port, host, () => {
  const address = host === '0.0.0.0' ? 'forms.publicbase.com' : host;
  // eslint-disable-next-line no-console
  console.log(`HTTPS dev server running at https://${address}:${port}`);
});
