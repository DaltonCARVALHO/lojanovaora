const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// ======================================================
// NOVAORA - GOOGLE SHEETS
// ======================================================

// PLANILHA 1 - aba principal
const SHEET_URL_1 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=0&single=true&output=csv";

// PLANILHA 2 - aba de produtos
const SHEET_URL_2 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=26648085&single=true&output=csv";

// ======================================================
// CONFIGURAÇÃO EXPRESS
// ======================================================

app.use(express.json());
app.use(express.static("public"));

// ======================================================
// CSV - LEITOR MAIS SEGURO
// ======================================================

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

function limparTexto(valor) {
  if (valor === undefined || valor === null) {
    return "";
  }

  return String(valor)
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
}

function normalizarCabecalho(valor) {
  return limparTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ======================================================
// CONVERTER CSV PARA LINHAS
// ======================================================

function csvParaLinhas(csv) {
  const linhas = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);

  return linhas.map(linha => parseCSVLine(linha));
}

// ======================================================
// ENCONTRAR A LINHA DE PRODUTOS
// ======================================================

function encontrarCabecalhoProdutos(linhas) {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].map(normalizarCabecalho);

    const temIdentificacao =
      linha.includes("identificacao") ||
      linha.includes("id");

    const temFornecedor =
      linha.includes("fornecedor");

    const temCusto =
      linha.some(campo =>
        campo.includes("custo produto")
      );

    if (
      temIdentificacao &&
      (temFornecedor || temCusto)
    ) {
      return {
        indice: i,
        cabecalho: linha
      };
    }
  }

  return null;
}

// ======================================================
// PEGAR VALOR DE UMA COLUNA
// ======================================================

function encontrarValor(row, headers, nomesPossiveis) {
  for (const nome of nomesPossiveis) {
    const indice = headers.indexOf(
      normalizarCabecalho(nome)
    );

    if (indice !== -1) {
      return limparTexto(row[indice]);
    }
  }

  return "";
}

// ======================================================
// CONVERTER PRODUTOS
// ======================================================

function extrairProdutos(linhas) {
  const estrutura =
    encontrarCabecalhoProdutos(linhas);

  if (!estrutura) {
    console.log(
      "Não foi encontrada a tabela de produtos."
    );

    return [];
  }

  const headers = estrutura.cabecalho;
  const inicio = estrutura.indice + 1;

  const produtos = [];

  for (let i = inicio; i < linhas.length; i++) {
    const row = linhas[i];

    if (!row || row.length === 0) {
      continue;
    }

    const id = encontrarValor(
      row,
      headers,
      [
        "identificação",
        "identificacao",
        "id",
        "produto id"
      ]
    );

    const fornecedor = encontrarValor(
      row,
      headers,
      [
        "fornecedor"
      ]
    );

    const custo = encontrarValor(
      row,
      headers,
      [
        "custo produto (€)",
        "custo produto",
        "custo",
        "preço custo",
        "preco custo"
      ]
    );

    const preco = encontrarValor(
      row,
      headers,
      [
        "preço venda (€)",
        "preco venda",
        "preço",
        "preco",
        "preço venda"
      ]
    );

    const stock = encontrarValor(
      row,
      headers,
      [
        "stock fornecedor",
        "stock"
      ]
    );

    const descricao = encontrarValor(
      row,
      headers,
      [
        "descrição",
        "descricao",
        "detalhes",
        "descrição produto"
      ]
    );

    const imagem = encontrarValor(
      row,
      headers,
      [
        "link imagem",
        "imagem",
        "url imagem",
        "imagem url",
        "foto",
        "url da imagem"
      ]
    );

    const nome = encontrarValor(
      row,
      headers,
      [
        "nome produto",
        "nome do produto",
        "produto",
        "nome",
        "título",
        "titulo"
      ]
    );

    const link = encontrarValor(
      row,
      headers,
      [
        "link compra",
        "link produto",
        "url produto",
        "link",
        "url"
      ]
    );

    // Ignorar linhas que não são produtos
    if (
      !id &&
      !nome &&
      !fornecedor &&
      !custo &&
      !preco
    ) {
      continue;
    }

    // Ignorar cabeçalhos repetidos
    if (
      normalizarCabecalho(id) === "id" ||
      normalizarCabecalho(nome) === "nome"
    ) {
      continue;
    }

    produtos.push({
      id: id || `PROD-${produtos.length + 1}`,
      nome: nome || "Produto",
      preco: preco || "0",
      imagem: imagem || "",
      stock: stock || "0",
      descricao: descricao || "",
      fornecedor: fornecedor || "",
      custo: custo || "0",
      link: link || ""
    });
  }

  return produtos;
}

// ======================================================
// BUSCAR UMA PLANILHA
// ======================================================

async function buscarPlanilha(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Google Sheets respondeu com ${response.status}`
      );
    }

    const csv = await response.text();

    return csvParaLinhas(csv);

  } catch (error) {

    console.error(
      "Erro ao buscar Google Sheets:",
      error.message
    );

    return [];
  }
}

// ======================================================
// API - PRODUTOS
// ======================================================

app.get("/api/products", async (req, res) => {

  try {

    console.log(
      "======================================"
    );

    console.log(
      "NOVAORA - carregando produtos..."
    );

    // Buscar as duas abas
    const linhas1 =
      await buscarPlanilha(SHEET_URL_1);

    const linhas2 =
      await buscarPlanilha(SHEET_URL_2);

    console.log(
      `Planilha 1: ${linhas1.length} linhas`
    );

    console.log(
      `Planilha 2: ${linhas2.length} linhas`
    );

    // Extrair produtos
    const produtos1 =
      extrairProdutos(linhas1);

    const produtos2 =
      extrairProdutos(linhas2);

    // Juntar os produtos
    const todosProdutos = [
      ...produtos1,
      ...produtos2
    ];

    // Remover duplicados pelo ID
    const mapa = new Map();

    for (const produto of todosProdutos) {

      if (!mapa.has(produto.id)) {
        mapa.set(
          produto.id,
          produto
        );
      }
    }

    const produtos =
      Array.from(mapa.values());

    console.log(
      `Produtos encontrados: ${produtos.length}`
    );

    console.log(
      "======================================"
    );

    res.json(produtos);

  } catch (error) {

    console.error(
      "Erro na API:",
      error
    );

    res.status(500).json({
      error:
        "Erro ao carregar produtos da Google Sheets.",
      detalhes:
        error.message
    });
  }
});

// ======================================================
// API - CONFIGURAÇÕES DA LOJA
// ======================================================

app.get("/api/config", async (req, res) => {

  try {

    const linhas =
      await buscarPlanilha(SHEET_URL_1);

    const configuracao = {};

    for (const linha of linhas) {

      if (linha.length < 2) {
        continue;
      }

      const chave =
        limparTexto(linha[0]);

      const valor =
        limparTexto(linha[1]);

      if (chave) {
        configuracao[chave] = valor;
      }
    }

    res.json(configuracao);

  } catch (error) {

    console.error(
      "Erro ao carregar configurações:",
      error
    );

    res.status(500).json({
      error:
        "Erro ao carregar configurações."
    });
  }
});

// ======================================================
// PÁGINA PRINCIPAL
// ======================================================

app.get("/", (req, res) => {

  res.sendFile(
    __dirname + "/public/index.html"
  );

});

// ======================================================
// OUTRAS ROTAS
// EXPRESS 5 - SEM app.get("*")
// ======================================================

app.use((req, res, next) => {

  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {

    return res.sendFile(
      __dirname + "/public/index.html"
    );
  }

  next();

});

// ======================================================
// TRATAMENTO DE ERROS
// ======================================================

app.use((err, req, res, next) => {

  console.error(
    "Erro interno:",
    err
  );

  res.status(500).json({
    error:
      "Erro interno no servidor NovaOra."
  });

});

// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `======================================`
  );

  console.log(
    `NOVAORA funcionando na porta ${PORT}`
  );

  console.log(
    `======================================`
  );

});
