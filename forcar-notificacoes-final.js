const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

/* remover QUALQUER rota antiga de notificacoes que redireciona login */
s = s.replace(/app\.get\(["']\/notificacoes["'][\s\S]*?res\.redirect\(["']\/login["']\);?[\s\S]*?\}\);/g, "");
s = s.replace(/app\.get\(["']\/notificacao["'][\s\S]*?res\.redirect\(["']\/login["']\);?[\s\S]*?\}\);/g, "");

/* remover redirects antigos notificacoes -> login em geral */
s = s.replace(/app\.get\(["']\/notificacoes["'],\s*\(req,res\)=>res\.redirect\(["']\/login["']\)\);/g, "");
s = s.replace(/app\.get\(["']\/notificacao["'],\s*\(req,res\)=>res\.redirect\(["']\/login["']\)\);/g, "");

/* rota certa, inserida DEPOIS que publicPath existe e ANTES da rota genérica /:page */
const bloco = `
/* NOTIFICACOES FINAL - NAO REDIRECIONAR LOGIN */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

s = s.replace(/\/\* NOTIFICACOES FINAL - NAO REDIRECIONAR LOGIN \*\/[\s\S]*?app\.get\(["']\/notificacao["'][\s\S]*?\}\);/g, "");

if(!s.includes("NOTIFICACOES FINAL - NAO REDIRECIONAR LOGIN")){
 s = s.replace('app.get("/:page", (req, res, next) => {', bloco + '\napp.get("/:page", (req, res, next) => {');
}

fs.writeFileSync("server.js",s);

console.log("Notificacoes final corrigida sem redirect login.");