const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

/* remove rota antiga singular */
s = s.replace('  "/notificacao": "notificacao.html",\n', "");

/* garante rota plural */
if(!s.includes('  "/notificacoes":