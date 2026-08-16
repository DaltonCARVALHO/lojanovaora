const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

// ======================================================
// NOVAORA — GOOGLE SHEETS
// ======================================================
const SHEET_URL_1 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=0&single=true&output=csv";

const SHEET_URL_2 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=26648085&single=true&output=csv";

app.use(express.json());
app.use(express.static("public"));

// ======================================================
// TEXTO / CABEÇALHOS
// ======================================================
function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizar(valor) {
  return limparTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ======================================================
// CSV ROBUSTO — aceita vírgulas, aspas e campos com vírgula
// ======================================================
function parseCSV(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (ch === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (ch === "," && !quoted) {
      row.push(limparTexto(cell));
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(limparTexto(cell));
      cell = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell !== "" || row.length) {
    row.push(limparTexto(cell));
    if (row.some(v => v !== "")) rows.push(row);
  }

  return rows;
}

// ======================================================
// ALIASES DA SUA PLANILHA
// ======================================================
const ALIASES = {
  id: ["id", "identificacao", "identificação", "produto id", "sku"],
  nome: [
    "nome",
    "nome produto",
    "nome do produto",
    "produto",
    "nome da loja",
    "titulo",
    "título",
    "nome comercial",
    "produto nome"
  ],
  preco: [
    "preco venda",
    "preço venda",
    "preco venda €",
    "preço venda €",
    "preco",
    "preço",
    "preco de venda",
    "preço de venda",
    "venda"
  ],
  imagem: [
    "link imagem",
    "imagem",
    "url imagem",
    "imagem url",
    "link da imagem",
    "url da imagem",
    "foto",
    "foto url",
    "imagem produto"
  ],
  descricao: [
    "descricao",
    "descrição",
    "descricao produto",
    "descrição produto",
    "detalhes",
    "detalhes produto"
  ],
  stock: ["stock fornecedor", "stock", "estoque fornecedor", "estoque"],
  fornecedor: ["fornecedor", "nome fornecedor"],
  custo: [
    "custo produto",
    "custo produto €",
    "custo",
    "preco custo",
    "preço custo"
  ],
  link: [
    "link",
    "url",
    "link produto",
    "url produto",
    "link compra",
    "link de compra",
    "pagina produto"
  ]
};

function indicePorAliases(headers, aliases) {
  const normalizados = headers.map(normalizar);

  for (const alias of aliases) {
    const alvo = normalizar(alias);
    const index = normalizados.indexOf(alvo);
    if (index !== -1) return index;
  }

  // Também aceita cabeçalhos maiores que contenham o campo.
  for (const alias of aliases) {
    const alvo = normalizar(alias);
    const index = normalizados.findIndex(h => h.includes(alvo));
    if (index !== -1) return index;
  }

  return -1;
}

function valor(row, headers, aliases) {
  const index = indicePorAliases(headers, aliases);
  return index === -1 ? "" : limparTexto(row[index]);
}

// ======================================================
// DETETAR A LINHA REAL DOS CAMPOS
//
// Algumas versões da sua planilha têm uma linha superior
// com grupos (Identificação, Custos, etc.) e outra linha
// com os nomes reais dos campos. Aqui usamos a linha que
// melhor representa os campos de produto.
// ======================================================
function encontrarCabecalho(linhas) {
  let melhor = null;
  let melhorPontuacao = -1;

  const camposImportantes = [
    ...ALIASES.id,
    ...ALIASES.nome,
    ...ALIASES.preco,
    ...ALIASES.imagem,
    ...ALIASES.descricao,
    ...ALIASES.stock,
    ...ALIASES.fornecedor,
    ...ALIASES.custo
  ].map(normalizar);

  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const headers = linhas[i].map(normalizar);
    let pontuacao = 0;

    for (const header of headers) {
      if (!header) continue;
      if (camposImportantes.includes(header)) pontuacao += 2;
      else if (camposImportantes.some(c => header.includes(c))) pontuacao += 1;
    }

    if (indicePorAliases(linhas[i], ALIASES.id) !== -1) pontuacao += 4;
    if (indicePorAliases(linhas[i], ALIASES.preco) !== -1) pontuacao += 3;
    if (indicePorAliases(linhas[i], ALIASES.imagem) !== -1) pontuacao += 3;

    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhor = { index: i, headers: linhas[i].map(limparTexto) };
    }
  }

  return melhorPontuacao >= 4 ? melhor : null;
}

// ======================================================
// NORMALIZAR IMAGEM
// Aceita links do Google Drive no formato /file/d/ID/view
// ======================================================
function normalizarImagem(url) {
  const texto = limparTexto(url);
  if (!texto) return "";

  const match = texto.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (match) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }

  return texto;
}

// ======================================================
// PREÇO — mantém o valor como texto para não quebrar €
// ======================================================
function precoPublico(valorPreco) {
  const valorLimpo = limparTexto(valorPreco);
  if (!valorLimpo) return "";

  // Evita publicar valores inválidos como 0,00 quando a célula
  // está vazia ou contém texto de cabeçalho.
  const numero = Number(
    valorLimpo
      .replace(/€/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(numero) || numero <= 0) return "";

  return `${numero.toFixed(2).replace(".", ",")} €`;
}

// ======================================================
// PRODUTOS
// ======================================================
function extrairProdutos(linhas) {
  const estrutura = encontrarCabecalho(linhas);

  if (!estrutura) {
    console.log("[NOVAORA] Cabeçalho de produtos não encontrado.");
    return [];
  }

  const { index: headerIndex, headers } = estrutura;
  console.log(`[NOVAORA] Cabeçalho encontrado na linha ${headerIndex + 1}:`, headers);

  const produtos = [];

  for (let i = headerIndex + 1; i < linhas.length; i++) {
    const row = linhas[i];
    if (!row || !row.some(v => limparTexto(v))) continue;

    const id = valor(row, headers, ALIASES.id);
    const nome = valor(row, headers, ALIASES.nome);
    const preco = valor(row, headers, ALIASES.preco);
    const imagem = normalizarImagem(valor(row, headers, ALIASES.imagem));
    const descricao = valor(row, headers, ALIASES.descricao);
    const stock = valor(row, headers, ALIASES.stock);
    const fornecedor = valor(row, headers, ALIASES.fornecedor);
    const custo = valor(row, headers, ALIASES.custo);
    const link = valor(row, headers, ALIASES.link);

    // Ignora linhas que são cabeçalhos ou configurações.
    if (normalizar(id) === "id") continue;
    if (!id && !nome && !preco) continue;

    // O cliente precisa de um nome real. Se a planilha não tiver
    // uma coluna de nome, usamos o ID apenas como fallback.
    const nomePublico = nome || (id ? `Produto ${id}` : "Produto");
    const precoPublicoValor = precoPublico(preco);

    // Não publica produtos sem preço válido.
    if (!precoPublicoValor) continue;

    produtos.push({
      id: id || `PROD-${String(produtos.length + 1).padStart(3, "0")}`,
      nome: nomePublico,
      preco: precoPublicoValor,
      imagem,
      descricao: descricao || "Produto selecionado pela NovaOra.",

      // Campos internos — NÃO serão enviados ao cliente.
      _interno: {
        stock,
        fornecedor,
        custo,
        link
      }
    });
  }

  return produtos;
}

// ======================================================
// REMOVER CAMPOS INTERNOS ANTES DA RESPOSTA
// ======================================================
function prepararParaCliente(produtos) {
  return produtos.map(({ _interno, ...publico }) => publico);
}

// ======================================================
// GOOGLE SHEETS
// ======================================================
async function buscarPlanilha(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NovaOra/1.0" }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets respondeu com HTTP ${response.status}`);
    }

    return parseCSV(await response.text());
  } catch (error) {
    console.error("[NOVAORA] Erro Google Sheets:", error.message);
    return [];
  }
}

// ======================================================
// API PRODUTOS
// ======================================================
app.get("/api/products", async (req, res) => {
  try {
    const [linhas1, linhas2] = await Promise.all([
      buscarPlanilha(SHEET_URL_1),
      buscarPlanilha(SHEET_URL_2)
    ]);

    console.log(`[NOVAORA] Planilha 1: ${linhas1.length} linhas`);
    console.log(`[NOVAORA] Planilha 2: ${linhas2.length} linhas`);

    const produtos = [
      ...extrairProdutos(linhas1),
      ...extrairProdutos(linhas2)
    ];

    // Remove duplicados por ID.
    const mapa = new Map();
    for (const produto of produtos) {
      if (!mapa.has(produto.id)) mapa.set(produto.id, produto);
    }

    const resultado = prepararParaCliente(Array.from(mapa.values()));

    console.log(`[NOVAORA] Produtos publicados: ${resultado.length}`);

    res.json(resultado);
  } catch (error) {
    console.error("[NOVAORA] Erro /api/products:", error);
    res.status(500).json({
      error: "Erro ao carregar produtos da Google Sheets."
    });
  }
});

// ======================================================
// API CONFIGURAÇÕES
// ======================================================
app.get("/api/config", async (req, res) => {
  try {
    const linhas = await buscarPlanilha(SHEET_URL_1);
    const configuracao = {};

    for (const linha of linhas) {
      if (linha.length < 2) continue;
      const chave = limparTexto(linha[0]);
      const valorConfig = limparTexto(linha[1]);
      if (chave) configuracao[chave] = valorConfig;
    }

    res.json(configuracao);
  } catch (error) {
    console.error("[NOVAORA] Erro /api/config:", error);
    res.status(500).json({ error: "Erro ao carregar configurações." });
  }
});

// ======================================================
// ROTAS
// ======================================================
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(__dirname + "/public/index.html");
  }
  next();
});

app.use((err, req, res, next) => {
  console.error("[NOVAORA] Erro interno:", err);
  res.status(500).json({ error: "Erro interno no servidor NovaOra." });
});

// ======================================================
// ARRANQUE
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log(`NOVAORA funcionando na porta ${PORT}`);
  console.log("======================================");
});
