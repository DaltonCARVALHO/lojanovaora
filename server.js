const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGQ9SLlcsoIBHN4my5lYcFnpM1vgh4PHTfXIrZ6joyi6vXuB-_fYVlwRDJvRdWEjnYbDlpbaa4PJt0/pub?gid=26648085&single=true&output=csv';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type});
  res.end(body);
}

function normalize(value) {
  return String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); if (row.some(v => String(v).trim() !== '')) rows.push(row); }
  return rows;
}

async function products() {
  const response = await fetch(CSV_URL, { headers: { 'User-Agent': 'NOVAORA/1.0' } });
  if (!response.ok) throw new Error(`Google Sheets CSV HTTP ${response.status}`);
  const text = await response.text();
  const rows = parseCSV(text);
  if (!rows.length) return [];

  const cols = rows[0].map(normalize);
  const find = names => {
    const wanted = names.map(normalize);
    return cols.findIndex(c => wanted.some(n => c === n || c.includes(n) || n.includes(c)));
  };

  const idI = find(['id']);
  const nameI = find(['nome do produto','nome','produto','name','title']);
  const priceI = find(['preco venda','preco','price','valor']);
  const imageI = find(['imagem','image','foto','url imagem','image url']);
  const categoryI = find(['categoria','category','cat']);
  const linkI = find(['link','url produto','product url','affiliate link']);
  const descriptionI = find(['descricao','description']);
  const bannerI = find(['banner']);
  const value = (r, i) => i >= 0 ? String(r[i] || '').trim() : '';

  return rows.slice(1).map(r => ({
    id: value(r, idI),
    name: value(r, nameI),
    price: value(r, priceI),
    image: value(r, imageI),
    category: value(r, categoryI),
    link: value(r, linkI),
    description: value(r, descriptionI),
    banner: value(r, bannerI)
  })).filter(p => p.name || p.price || p.image || p.link || p.banner);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/products') return send(res, 200, JSON.stringify(await products()));
    if (url.pathname === '/health') return send(res, 200, JSON.stringify({ok:true, store:'NOVAORA', source:'Google Sheets CSV', sheet:'PRODUTOS'}));
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.normalize(file).replace(/^([.][.][\\/])+/, '');
    const full = path.join(process.cwd(), file);
    if (!full.startsWith(process.cwd())) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      send(res, 200, data, mime[path.extname(full).toLowerCase()] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, JSON.stringify({error:'Erro no servidor NOVAORA'}));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`NOVAORA running on port ${PORT}`));
