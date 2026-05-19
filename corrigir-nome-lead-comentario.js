const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`const usuarioNome = cleanText(req.body.usuarioNome || req.user?.nome || "Usu�rio Flux", 80);`,
`const usuarioNome = cleanText(
  req.body.usuarioNome ||
  req.body.nome ||
  req.user?.nome ||
  "Visitante Flux",
  80
);`
);

s = s.replace(
`usuarioNome: usuarioNome,`,
`usuarioNome,`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("NOME DO LEAD NO COMENTARIO CORRIGIDO.");
