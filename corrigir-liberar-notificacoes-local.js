const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const blocoErrado = `

/* LIBERAR NOTIFICACOES PUBLICAS */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

s = s.replace(blocoErrado, "");

const blocoCerto = `

/* LIBERAR NOTIFICACOES PUBLICAS */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

if(!s.includes("LIBERAR NOTIFICACOES PUBLICAS")){
 s = s.replace('app.get("/", (req, res) => {', blocoCerto + '\napp.get("/", (req, res) => {');
}

fs.writeFileSync("server.js",s);

console.log("Notificacoes corrigidas no lugar certo.");