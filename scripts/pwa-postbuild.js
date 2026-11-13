// Po `expo export --platform web` (2026-11-13, wersja na komputer): wstrzyknięcie
// PWA do dist/index.html (manifest, ikony, kolor motywu, rejestracja service
// workera) + 404.html = kopia index.html, żeby odświeżenie podstrony (np.
// /sapp2/tasks) na GitHub Pages ładowało appkę zamiast błędu 404.
const fs = require('fs');
const path = require('path');

const BASE = '/sapp2';
const dist = path.join(__dirname, '..', 'dist');
const file = path.join(dist, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const head = `
    <link rel="manifest" href="${BASE}/manifest.json" />
    <link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png" />
    <meta name="theme-color" content="#000000" />
    <script>if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('${BASE}/sw.js', { scope: '${BASE}/' }).catch(function () {}); });</script>
`;
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}</head>`);
html = html.replace(/<title>[^<]*<\/title>/, '<title>sapp2</title>');
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(dist, '404.html'), html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('PWA: manifest + service worker wstrzyknięte, 404.html gotowy');
