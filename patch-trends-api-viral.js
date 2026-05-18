const fs = require("fs");

const file = "public/trends.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/trends.backup-api-viral.html");

s = s.replace(
`  ] = await Promise.all([
   fetch("/api/feed"),
   fetch("/api/fluxo")
  ]);`,
`  const res = await fetch("/api/trends-viral?v=" + Date.now());
   const data = await res.json();

   const ranking = data.ranking || [];

   allPosts = ranking;

   render();

   return;`
);

fs.writeFileSync(file,s,"utf8");

console.log("TRENDS CONECTADO NA API VIRAL.");
