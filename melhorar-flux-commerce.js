const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file, "utf8");

fs.copyFileSync(file, "server.backup-commerce-" + Date.now() + ".js");

if (!s.includes("produtoId: { type: String")) {
  s = s.replace(
    "media: { type: String, default: \"\" },",
    `media: { type: String, default: "" },
medias: [{ type: String }],
produtoId: { type: String, default: "" },
produtoNome: { type: String, default: "" },
produtoPreco: { type: Number, default: 0 },
produtoImagem: { type: String, default: "" },
produtoLink: { type: String, default: "" },`
  );
}

if (!s.includes("imagens: [{ type: String }]")) {
  s = s.replace(
    "video: { type: String, default: \"\" },",
    `video: { type: String, default: "" },
imagens: [{ type: String }],
link: { type: String, default: "" },
marketplace: { type: String, default: "flux" },`
  );
}

const route = `
/* COMMERCE TURBO - PRODUTO + FOTOS + POST */
app.post(
  "/api/commerce/postar-produto",
  auth,
  carregarPlano,
  requireEmpresaPaga,
  verificarRecurso("podeProduto"),
  upload.array("medias", 10),
  async (req, res) => {
    try {
      const files = (req.files || []).map(f => {
        return f.mimetype.startsWith("video")
          ? "videos/" + f.filename
          : "images/" + f.filename;
      });

      const imagemPrincipal = files.find(f => !f.includes("videos/")) || files[0] || "";
      const videoPrincipal = files.find(f => f.includes("videos/")) || "";

      const produto = await Produto.create({
        empresaId: String(req.user.id),
        empresaNome: req.user.nome || req.user.empresa || "Empresa Flux",
        nome: cleanText(req.body.nome || req.body.titulo || "Produto Flux", 120),
        descricao: cleanText(req.body.descricao || "", 2000),
        preco: Number(req.body.preco || 0),
        precoPromocional: Number(req.body.precoPromocional || 0),
        estoque: Number(req.body.estoque || 1),
        categoria: cleanText(req.body.categoria || "Produto", 80),
        imagem: imagemPrincipal,
        imagens: files,
        video: videoPrincipal,
        link: cleanText(req.body.link || "", 500),
        marketplace: cleanText(req.body.marketplace || "flux", 80),
        ativo: true
      });

      const post = await Post.create({
        empresaId: String(req.user.id),
        empresaNome: req.user.nome || req.user.empresa || "Empresa Flux",
        descricao: cleanText(req.body.postDescricao || req.body.descricao || produto.nome, 2000),
        media: videoPrincipal || imagemPrincipal,
        medias: files,
        tipo: "feed",
        produtoId: String(produto._id),
        produtoNome: produto.nome,
        produtoPreco: Number(produto.precoPromocional || produto.preco || 0),
        produtoImagem: imagemPrincipal,
        produtoLink: produto.link || "/flux-produto/" + produto._id,
        status: "aprovada"
      });

      const normalized = normalizePost(post);
      io.emit("novo_post", normalized);

      res.json({ ok: true, produto, post: normalized });
    } catch (err) {
      console.log("commerce postar produto:", err);
      res.status(500).json({ erro: "commerce_postar_produto_error" });
    }
  }
);
`;

if (!s.includes("/api/commerce/postar-produto")) {
  s = s.replace("/* PRODUTOS / MARKETPLACE */", route + "\n\n/* PRODUTOS / MARKETPLACE */");
}

fs.writeFileSync(file, s, "utf8");
console.log("FLUX COMMERCE TURBO APLICADO COM BACKUP.");
