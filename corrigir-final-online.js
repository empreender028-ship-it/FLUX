const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

/* remove rota antiga */
s = s.replace('  "/notificacao": "notificacao.html",\n', "");

/* força notificacoes no mapa correto */
if(!s.includes('"/notificacoes": "notificacoes.html"')){
 s = s.replace(
  '  "/trends": "trends.html",',
  '  "/trends": "trends.html",\n  "/notificacoes": "notificacoes.html",'
 );
}

/* impede login automático */
s = s.replace(
`if (route === "/") {
      return res.redirect("/login");
    }`,
`if (route === "/") {
      return res.sendFile(path.join(publicPath, "feed.html"));
    }`
);

fs.writeFileSync("server.js",s);

console.log("ONLINE FINAL corrigido.");