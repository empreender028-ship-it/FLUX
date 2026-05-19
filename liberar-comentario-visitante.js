const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`app.post("/api/comments", optionalAuth, carregarPlano, verificarRecurso("podeComentar"), async (req, res) => {`,
`app.post("/api/comments", optionalAuth, async (req, res) => {`
);

s = s.replace(
`const usuarioNome = cleanText(req.body.usuarioNome || req.user?.nome || "Usuário Flux", 80);`,
`const usuarioNome = cleanText(
  req.body.usuarioNome ||
  req.body.nome ||
  req.user?.nome ||
  "Visitante Flux",
  80
);`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("COMENTARIO LIBERADO PARA VISITANTE.");
