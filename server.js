const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = '1w4WGdP-9dezy2ekPlcv7G4C8H2_GUSbcuFlWacvSBXM';

app.use(express.static('.'));

app.get('/api/products', async (_req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
    const text = await response.text();
    const jsonText = text.replace(/^.*?\(/, '').replace(/\);?\s*$/, '');
    const data = JSON.parse(jsonText);
    const cols = (data.table.cols || []).map(c => c.label || '');
    const rows = data.table.rows || [];
    const norm = s => String(s || '').toLowerCase().trim();
    const findCol = names => cols.findIndex(c => names.includes(norm(c)));
    const nameI = findCol(['nome','produto','name','title']);
    const priceI = findCol(['preço','preco','price','valor']);
    const imageI = findCol(['imagem','image','foto','url imagem','image url']);
    const categoryI = findCol(['categoria','category','cat']);
    const linkI = findCol(['link','url','url produto','product url','affiliate link']);
    const value = (row, i) => i >= 0 && row.c && row.c[i] ? (row.c[i].f || row.c[i].v || '') : '';
    const products = rows.map(r => ({
      name: value(r, nameI),
      price: value(r, priceI),
      image: value(r, imageI),
      category: value(r, categoryI),
      link: value(r, linkI)
    })).filter(p => p.name || p.price || p.image || p.link);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível ler a planilha Google Sheets.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, store: 'NOVAORA', sheet: SHEET_ID }));

app.listen(PORT, () => console.log(`NOVAORA running on port ${PORT}`));
