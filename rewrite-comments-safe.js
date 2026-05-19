const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

const nova = `app.post("/api/comments", optionalAuth, async (req, res) => {
  try {
    const texto = cleanText(req.body.texto || "", 700);
    const postId = String(req.body.postId || "").trim();

    const userKey = String(
      req.user?.id ||
      req.body.userKey ||
      req.body.leadId ||
      req.body.email ||
      req.body.telefone ||
      req.ip ||
      "anon"
    );

    const usuarioNome = cleanText(
      req.body.usuarioNome ||
      req.body.nome ||
      req.user?.nome ||
      "Visitante Flux",
      80
    );

    if (!postId || !texto) {
      return res.status(400).json({ erro: "comentario_invalido" });
    }

    const duplicado = await Comment.findOne({
      postId,
      usuarioId: userKey,
      texto
    });

    if (duplicado) {
      return res.json({ ok: true, duplicate: true, comment: duplicado });
    }

    const comment = await Comment.create({
      postId,
      usuarioId: userKey,
      usuarioNome,
      texto
    });

    if (typeof io !== "undefined") {
      io.emit("novo_comentario", comment);
      io.emit("comment:new", comment);
    }

    return res.json({ ok: true, comment });
  } catch (e) {
    console.log("comment_error:", e);
    return res.status(500).json({ erro: "comment_error" });
  }
});
`;

s = s.replace(
  /app\.post\("\/api\/comments",\s*optionalAuth,[\s\S]*?\n\}\);\n/,
  nova + "\n"
);

fs.writeFileSync("server.js", s, "utf8");
console.log("ROTA COMMENTS REESCRITA COM SEGURANCA.");
