const fs = require("fs");
const path = require("path");

const file = path.join(__dirname,"public","notificacoes.html");

let html = fs.readFileSync(file,"utf8");

/* rota errada */
html = html.replaceAll('href="/notificacao"','href="/notificacoes"');

/* perfil empresa -> rota nova */
html = html.replaceAll('href="/empresa.html"','href="/montar-perfil"');

/* painel empresa */
html = html.replaceAll('href="/painel"','href="/painel"');

/* garantir feed */
html = html.replaceAll('href="/feed"','href="/feed"');

/* garantir fluxo */
html = html.replaceAll('href="/fluxo"','href="/fluxo"');

fs.writeFileSync(file,html);

console.log("HTML notificacoes corrigido.");