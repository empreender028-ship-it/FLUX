const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const aliases = `

/* ROTAS PADRÃO FLUX - ALIASES */
const pageAliases = {
 "/home": "/feed",
 "/inicio": "/feed",
 "/postar": "/painel",
 "/publicar": "/painel",
 "/meu-perfil": "/empresa.html",
 "/perfil": "/empresa.html",
 "/perfil-empresa": "/empresa.html",
 "/loja": "/empresa.html",
 "/vitrine": "/empresa.html",
 "/shop": "/marketplace",
 "/mercado": "/marketplace",
 "/compras": "/pedidos",
 "/notificacoes": "/notificacoes.html",
 "/notifications": "/notificacoes.html",
 "/mensagens": "/chat.html",
 "/chat": "/chat.html",
 "/ranking": "/ranking.html",
 "/trends": "/trends.html",
 "/posts": "/posts.html"
};

Object.entries(pageAliases).forEach(([from,to])=>{
 app.get(from,(req,res)=>res.redirect(to));
});

app.get("/api/notificacoes", auth, async (req,res)=>{
 res.json({
  ok:true,
  notificacoes:[
   {
    tipo:"sistema",
    titulo:"Bem-vindo à Flux",
    texto:"Suas notificações aparecerão aqui em tempo real.",
    createdAt:new Date()
   }
  ]
 });
});

app.get("/api/rotas", (req,res)=>{
 res.json({
  ok:true,
  paginas:{
   login:"/login",
   cadastroCliente:"/cliente-cadastro",
   cadastroEmpresa:"/cadastro",
   feed:"/feed",
   fluxo:"/fluxo",
   postar:"/painel",
   perfil:"/empresa.html",
   marketplace:"/marketplace",
   pedidos:"/pedidos",
   notificacoes:"/notificacoes",
   chat:"/chat",
   planos:"/planos",
   admin:"/admin"
  },
  apis:{
   feed:"/api/feed",
   fluxo:"/api/fluxo",
   produtos:"/api/produtos",
   pedidos:"/api/pedidos",
   permissoes:"/api/permissoes",
   online:"/online",
   health:"/api/health"
  }
 });
});
`;

if(!s.includes("/* ROTAS PADRÃO FLUX - ALIASES */")){
 s = s.replace("/* CLIENTE / EMPRESA CADASTRO */", aliases + "\n/* CLIENTE / EMPRESA CADASTRO */");
}

s = s.replace(
`io.emit("novo_post", normalized);
io.emit(tipoRecebido === "fluxo" ? "novo_fluxo" : "novo_feed", normalized);`,
`io.emit("novo_post", normalized);
io.emit("post:new", normalized);
io.emit("feed:update", normalized);
io.emit("flux:update", normalized);
io.emit(tipoRecebido === "fluxo" ? "novo_fluxo" : "novo_feed", normalized);

if (tipoRecebido === "fluxo") {
 io.emit("fluxo:novo", normalized);
} else {
 io.emit("feed:novo", normalized);
}`
);

fs.writeFileSync("server.js",s);
console.log("Rotas e postagem em tempo real corrigidas.");