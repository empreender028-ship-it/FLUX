const fs = require("fs");

let s = fs.readFileSync("public/fluxo.html","utf8");

fs.copyFileSync("public/fluxo.html","public/fluxo.backup-for-you.html");

s = s.replace(
  'fetch("/api/fluxo",{cache:"no-store"})',
  'fetch("/api/for-you?limit=50",{cache:"no-store"})'
);

s = s.replace(
  'const posts = await res.json();',
  `const data = await res.json();
  const posts = data.posts || data || [];`
);

fs.writeFileSync("public/fluxo.html",s,"utf8");

console.log("FLUXO CONECTADO AO FOR YOU.");
