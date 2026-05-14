const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const bloco = `

/* LIBERAR NOTIFICACOES PUBLICAS */
app.get("/notificacoes",(req,res)=>{
 return res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 return res.redirect("/notificacoes");
});
`;

if(!s.includes("LIBERAR NOTIFICACOES PUBLICAS")){
 s = bloco + "\n" + s;
}

fs.writeFileSync("server.js",s);

console.log("Notificacoes liberadas.");