const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

/* remove notificacoes dos aliases antigos */
s = s.replace(' "/notificacoes": "/notificacoes.html",\n', "");
s = s.replace(' "/notifications": "/notificacoes.html",\n', "");

/* adiciona rota correta ANTES do /:page */
const bloco = `
/* NOTIFICACOES ROTA FINAL */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});

app.get("/notifications",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

if(!s.includes("NOTIFICACOES ROTA FINAL")){
 s = s.replace('app.get("/:page", (req, res, next) => {', bloco + '\napp.get("/:page", (req, res, next) => {');
}

fs.writeFileSync("server.js",s);

console.log("Alias notificacoes corrigido.");