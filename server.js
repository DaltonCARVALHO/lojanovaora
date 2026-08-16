const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const SHEET_ID = '1w4WGdP-9dezy2ekPlcv7G4C8H2_GUSbcuFlWacvSBXM';
const SHEET_NAME = 'PRODUTOS';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
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

async function products() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tqx=out:json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
  const text = await response.text();
  const jsonText = text.replace(/^.*?\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonText);
  const cols = (data.table.cols || []).map(c => normalize(c.label || ''));

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

  const value = (row, i) => i >= 0 && row.c && row.c[i] ? String(row.c[i].f ?? row.c[i].v ?? '') : '';

  return (data.table.rows || []).map(r => ({
    id: value(r, idI),
    name: value(r, nameI),
    price: value(r, priceI),
    image: value(r, imageI),
    category: value(r, categoryI),
    link: value(r, linkI),
    description: value(r, descriptionI)
  })).filter(p => p.name || p.price || p.image || p.link);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/products') {
      return send(res, 200, JSON.stringify(await products()));
    }
    if (url.pathname === '/health') {
      return send(res, 200, JSON.stringify({ok:true, store:'NOVAORA', sheet:SHEET_ID, tab:SHEET_NAME}));
    }
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
