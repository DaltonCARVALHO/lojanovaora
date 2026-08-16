async function carregarProdutos() {
  const status = document.getElementById("status");
  const container = document.getElementById("products");

  try {
    const resposta = await fetch("/api/products");

    if (!resposta.ok) {
      throw new Error("Erro ao carregar produtos");
    }

    const produtos = await resposta.json();

    if (!produtos.length) {
      status.textContent = "Nenhum produto encontrado.";
      return;
    }

    status.textContent = `${produtos.length} produtos encontrados`;

    produtos.forEach(produto => {

      const nome =
        produto.produto ||
        produto.nome ||
        produto["nome do produto"] ||
        "Produto";

      const preco =
        produto.preço ||
        produto.preco ||
        produto.price ||
        "";

      const imagem =
        produto.imagem ||
        produto.image ||
        produto.foto ||
        "";

      const descricao =
        produto.descrição ||
        produto.descricao ||
        produto.description ||
        "";

      const card = document.createElement("article");

      card.className = "produto";

      card.innerHTML = `
        ${
          imagem
            ? `<img src="${imagem}" alt="${nome}">`
            : `<div class="sem-imagem">Sem imagem</div>`
        }

        <h2>${nome}</h2>

        <p>${descricao}</p>

        <strong>${preco}</strong>

        <button>
          Comprar
        </button>
      `;

      container.appendChild(card);
    });

  } catch (erro) {

    console.error(erro);

    status.textContent =
      "Não foi possível carregar os produtos da loja.";
  }
}

carregarProdutos();
