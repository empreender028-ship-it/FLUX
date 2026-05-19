const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(
/app\.post\("\/api\/comments",\s*optionalAuth,\s*carregarPlano,\s*verificarRecurso\("podeComentar"\),/g,
'app.post("/api/comments", optionalAuth,'
);

fs.writeFileSync("server.js",s,"utf8");

console.log("BLOQUEIO DE COMENTARIO REMOVIDO.");
