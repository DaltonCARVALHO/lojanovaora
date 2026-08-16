const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// ===============================
// GOOGLE SHEETS
// ===============================

const SHEET_ID = "1w4WGdP-9dezy2ekPlcv7G4C8H2_GUSbcuFlWacvSBXM";
const SHEET_GID = "0";

// ===============================
// CONFIGURAÇÃO
// ===============================

app.use(express.json());
app.use(express.static("public"));

// ===============================
// CONVERTER CSV DA PLANILHA
// ===============================

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((header) => header.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(",");

    const product = {};

    headers.forEach((header, index) => {
      product[header] = values[index] || "";
    });

    return product;
  });
}

// ===============================
// API DOS PRODUTOS
// ===============================

app.get("/api/products", async (req, res) => {
  try {
    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export` +
      `?format=csv&gid=${SHEET_GID}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Não foi possível acessar a Google Sheets."
      );
    }

    const csv = await response.text();

    const products = parseCSV(csv);

    res.json(products);

  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );

    res.status(500).json({
      error: "Erro ao carregar produtos da Google Sheets."
    });
  }
});

// ===============================
// PÁGINA PRINCIPAL
// ===============================

app.get("/", (req, res) => {
  res.sendFile(
    __dirname + "/public/index.html"
  );
});

// ===============================
// OUTRAS ROTAS
// ===============================

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

// ===============================
// SERVIDOR
// ===============================

app.listen(PORT, () => {

  console.log(
    `NovaOra funcionando na porta ${PORT}`
  );

});
