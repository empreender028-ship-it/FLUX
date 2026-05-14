const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replaceAll('return res.redirect("/login");','return res.sendFile(path.join(publicPath,"feed.html"));');

const rota = `
/* NOTIFICACOES FIX ONLINE DEFINITIVO */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

if(!s.includes("NOTIFICACOES FIX ONLINE DEFINITIVO")){
 s = s.replace('app.get("/", (req, res) => {', rota + '\napp.get("/", (req, res) => {');
}

fs.writeFileSync("server.js",s);

console.log("Login forcado removido e notificacoes fixadas.");