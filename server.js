const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// ID da sua planilha Google Sheets
const SHEET_ID = "1w4WGdP-9dezy2ekPlcv7G4C8H2_GUSbcuFlWacvSBXM";

// GID da primeira aba da planilha
const SHEET_GID = "0";

app.use(express.static("public"));

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(",");

    const product = {};

    headers.forEach((header, index) => {
      product[header] = values[index] || "";
    });

    return product;
  });
}

app.get("/api/products", async (req, res) => {
  try {
    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Não foi possível acessar a Google Sheets.");
    }

    const csv = await response.text();

    const products = parseCSV(csv);

    res.json(products);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erro ao carregar produtos da Google Sheets."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(PORT, () => {
  console.log(`NovaOra funcionando na porta ${PORT}`);
});
