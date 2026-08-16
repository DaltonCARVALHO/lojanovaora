
const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// ==========================================
// GOOGLE SHEETS - LINK PUBLICADO
// ==========================================

const SHEET_CSV_URL =
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
  const lines = text.trim().split(/\r?\n/);

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
// API DOS PRODUTOS
// ==========================================

app.get("/api/products", async (req, res) => {
  try {
    const response = await fetch(SHEET_CSV_URL);

    if (!response.ok) {
      throw new Error(
        "Não foi possível acessar a Google Sheets."
      );
    }

    const csv = await response.text();

    const products = parseCSV(csv);

    console.log(
      `Produtos carregados da planilha: ${products.length}`
    );

    res.json(products);

  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );

    res.status(500).json({
      error:
        "Erro ao carregar produtos da Google Sheets."
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
// OUTRAS PÁGINAS
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
