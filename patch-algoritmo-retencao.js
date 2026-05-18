const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 4 +
        Number(n.saves || 0) * 9 +
        Number(n.shares || 0) * 7 +
        (n.produtoId ? 12 : 0) +
        (n.tipo === "fluxo" ? 8 : 0);`,

`n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 4 +
        Number(n.saves || 0) * 9 +
        Number(n.shares || 0) * 7 +
        Number(n.watchSeconds || 0) * 0.08 +
        Number(n.watchCount || 0) * 3 +
        Number(n.retentionAvg || 0) * 2.2 +
        (n.produtoId ? 12 : 0) +
        (n.tipo === "fluxo" ? 8 : 0);`
);

fs.writeFileSync("server.js",s,"utf8");

console.log("ALGORITMO RETENCAO APLICADO.");
