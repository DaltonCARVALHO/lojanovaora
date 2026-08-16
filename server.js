const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// ==========================================
// GOOGLE SHEETS - DUAS ABAS
// ==========================================

const SHEET_CSV_URL_1 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=0&single=true&output=csv";

const SHEET_CSV_URL_2 =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5j9tTX3G9UUPhz4tvAU53oegJuoPE4GOk25fc2d-7VFPTwng0EySQqEr9S_JyqebGtxlsXZlIJiK/pub?gid=26648085&single=true&output=csv";

// ==========================================
// CONFIGURAÇÃO
// ==========================================

app.use(express.json());
app.use(express.static("public"));

// ==========================================
// CONVERSOR CSV
// ==========================================

function parseCSV(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map(header =>
      header
        .trim()
        .replace(/^"|"$/g, "")
        .toLowerCase()
    );

  return lines.slice(1).map(line => {
    const values = line.split(",");

    const product = {};

    headers.forEach((header, index) => {
      product[header] = (values[index] || "")
        .trim()
        .replace(/^"|"$/g, "");
    });

    return product;
  });
}

// ==========================================
// BUSCAR UMA ABA DA PLANILHA
// ==========================================

async function buscarPlanilha(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Erro ao acessar Google Sheets: ${response.status}`
    );
  }

  const csv = await response.text();

  return parseCSV(csv);
}

// ==========================================
// API DOS PRODUTOS
// ==========================================

app.get("/api/products", async (req, res) => {
  try {

    console.log("A carregar primeira aba...");

    const produtos1 =
      await buscarPlanilha(SHEET_CSV_URL_1);

    console.log(
      `Primeira aba: ${produtos1.length} produtos`
    );

    console.log("A carregar segunda aba...");

    const produtos2 =
      await buscarPlanilha(SHEET_CSV_URL_2);

    console.log(
      `Segunda aba: ${produtos2.length} produtos`
    );

    // Junta os produtos das duas abas
    const produtos = [
      ...produtos1,
      ...produtos2
    ];

    console.log(
      `TOTAL: ${produtos.length} produtos carregados`
    );

    res.json(produtos);

  } catch (error) {

    console.error(
      "ERRO AO CARREGAR GOOGLE SHEETS:",
      error
    );

    res.status(500).json({
      error:
        "Não foi possível carregar os produtos da Google Sheets.",
      detalhes: error.message
    });
  }
});

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(
    __dirname + "/public/index.html"
  );
});

// ==========================================
// OUTRAS ROTAS
// ==========================================

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

// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(
    `NovaOra funcionando na porta ${PORT}`
  );
});
