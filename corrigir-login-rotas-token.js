const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");

const arquivosLivres = [
 "feed.html",
 "fluxo.html",
 "marketplace.html",
 "planos.html",
 "ranking.html",
 "trends.html",
 "posts.html",
 "pedidos.html",
 "notificacoes.html",
 "perfil.html"
];

function existe(file){
 return fs.existsSync(path.join(publicDir,file));
}

for(const file of arquivosLivres){
 if(!existe(file)) continue;

 const full = path.join(publicDir,file);
 let html = fs.readFileSync(full,"utf8");

 html = html.replaceAll('localStorage.getItem("flux_token")','localStorage.getItem("token")');
 html = html.replaceAll("localStorage.getItem('flux_token')","localStorage.getItem('token')");
 html = html.replaceAll('localStorage.getItem("authToken")','localStorage.getItem("token")');
 html = html.replaceAll("localStorage.getItem('authToken')","localStorage.getItem('token')");

 html = html.replace(/if\s*\(\s*!token\s*\)\s*\{\s*location\.href\s*=\s*["']\/login["'];?\s*\}/g,"");
 html = html.replace(/if\s*\(\s*!localStorage\.getItem\(["']token["']\)\s*\)\s*\{\s*location\.href\s*=\s*["']\/login["'];?\s*\}/g,"");

 fs.writeFileSync(full,html);
 console.log("corrigido:",file);
}

let server = fs.readFileSync("server.js","utf8");

const bloco = `
/* ROTAS PÚBLICAS FLUX - NÃO JOGAR TUDO PARA LOGIN */
app.get("/feed",(req,res)=>res.sendFile(path.join(publicPath,"feed.html")));
app.get("/fluxo",(req,res)=>res.sendFile(path.join(publicPath,"fluxo.html")));
app.get("/marketplace",(req,res)=>res.sendFile(path.join(publicPath,"marketplace.html")));
app.get("/planos",(req,res)=>res.sendFile(path.join(publicPath,"planos.html")));
app.get("/ranking",(req,res)=>res.sendFile(path.join(publicPath,"ranking.html")));
app.get("/trends",(req,res)=>res.sendFile(path.join(publicPath,"trends.html")));
app.get("/posts",(req,res)=>res.sendFile(path.join(publicPath,"posts.html")));
app.get("/pedidos",(req,res)=>res.sendFile(path.join(publicPath,"pedidos.html")));
app.get("/notificacoes",(req,res)=>res.sendFile(path.join(publicPath,"notificacoes.html")));
app.get("/perfil",(req,res)=>res.sendFile(path.join(publicPath,"perfil.html")));
`;

if(!server.includes("ROTAS PÚBLICAS FLUX - NÃO JOGAR TUDO PARA LOGIN")){
 server = server.replace('app.get("/", (req, res) => {', bloco + '\napp.get("/", (req, res) => {');
 fs.writeFileSync("server.js",server);
 console.log("rotas públicas adicionadas no server");
}

console.log("Correção finalizada.");