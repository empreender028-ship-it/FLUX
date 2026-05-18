const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"server.backup-algoritmo-fluxo.js");

if(!s.includes("scoreViral:")) {
  s = s.replace(
    "posts.map(normalizePost)",
    `posts.map(p=>{
      const n = normalizePost(p);
      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 3 +
        Number(n.saves || 0) * 8 +
        Number(n.shares || 0) * 5;
      return n;
    }).sort((a,b)=>b.scoreViral-a.scoreViral)`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("ALGORITMO VIRAL APLICADO.");
