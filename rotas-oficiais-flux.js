const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const bloco = `

/* =========================================================
   ROTAS OFICIAIS FLUX
========================================================= */

/* CLIENTE */

app.get("/cliente-cadastro",(req,res)=>{
 res.sendFile(path.join(publicPath,"cliente-cadastro.html"));
});

app.get("/cadastro-cliente",(req,res)=>{
 res.redirect("/cliente-cadastro");
});

app.get("/cliente",(req,res)=>{
 res.redirect("/cliente-cadastro");
});

app.get("/perfil",(req,res)=>{
 res.sendFile(path.join(publicPath,"perfil.html"));
});

app.get("/meu-perfil",(req,res)=>{
 res.redirect("/perfil");
});

app.get("/notificacoes",(req,res)=>{
 res.sendFile(path.join(publicPath,"notificacoes.html"));
});

app.get("/notificacao",(req,res)=>{
 res.redirect("/notificacoes");
});

app.get("/mensagens",(req,res)=>{
 res.redirect("/chat");
});

app.get("/compras",(req,res)=>{
 res.redirect("/pedidos");
});

app.get("/meus-pedidos",(req,res)=>{
 res.redirect("/pedidos");
});

app.get("/shop",(req,res)=>{
 res.redirect("/marketplace");
});

app.get("/mercado",(req,res)=>{
 res.redirect("/marketplace");
});

/* EMPRESA */

app.get("/empresa-cadastro",(req,res)=>{
 res.redirect("/cadastro");
});

app.get("/cadastro-empresa",(req,res)=>{
 res.redirect("/cadastro");
});

app.get("/criar-empresa",(req,res)=>{
 res.redirect("/cadastro");
});

app.get("/empresa",(req,res)=>{
 res.redirect("/cadastro");
});

app.get("/empresa-perfil",(req,res)=>{
 res.redirect("/montar-perfil");
});

app.get("/perfil-empresa",(req,res)=>{
 res.redirect("/montar-perfil");
});

app.get("/minha-vitrine",(req,res)=>{
 res.redirect("/montar-perfil");
});

app.get("/editar-perfil-empresa",(req,res)=>{
 res.redirect("/montar-perfil");
});

app.get("/empresa/perfil",(req,res)=>{
 res.redirect("/montar-perfil");
});

app.get("/montar-perfil",(req,res)=>{
 res.sendFile(path.join(publicPath,"empresa.html"));
});

app.get("/empresa-produtos",(req,res)=>{
 res.redirect("/produtos");
});

app.get("/empresa-pedidos",(req,res)=>{
 res.redirect("/pedidos-empresa");
});

app.get("/empresa-estoque",(req,res)=>{
 res.redirect("/estoque");
});

app.get("/empresa-analytics",(req,res)=>{
 res.redirect("/analytics");
});

app.get("/empresa-financeiro",(req,res)=>{
 res.redirect("/financeiro");
});

/* APIs MENUS */

app.get("/api/cliente/menu", auth, carregarPlano, async (req,res)=>{
 res.json({
  ok:true,
  tipo:"cliente",
  menu:[
   {nome:"Feed",rota:"/feed"},
   {nome:"Fluxo",rota:"/fluxo"},
   {nome:"Marketplace",rota:"/marketplace"},
   {nome:"Pedidos",rota:"/pedidos"},
   {nome:"Perfil",rota:"/perfil"},
   {nome:"Notificações",rota:"/notificacoes"},
   {nome:"Chat",rota:"/chat"}
  ]
 });
});

app.get("/api/empresa/menu", auth, carregarPlano, requireEmpresa, async (req,res)=>{
 res.json({
  ok:true,
  tipo:"empresa",
  plano:req.planoNome,
  assinatura:req.empresa.assinaturaStatus,
  menu:[
   {
    nome:"Painel",
    rota:"/painel",
    liberado:req.permissoes.podePainel
   },
   {
    nome:"Montar Perfil",
    rota:"/montar-perfil",
    liberado:true
   },
   {
    nome:"Produtos",
    rota:"/produtos",
    liberado:req.permissoes.podeProduto
   },
   {
    nome:"Pedidos",
    rota:"/pedidos-empresa",
    liberado:req.permissoes.podeProduto
   },
   {
    nome:"Estoque",
    rota:"/estoque",
    liberado:req.permissoes.podeProduto
   },
   {
    nome:"Analytics",
    rota:"/analytics",
    liberado:Boolean(req.permissoes.analytics)
   },
   {
    nome:"IA",
    rota:"/ia",
    liberado:Boolean(req.permissoes.ia)
   },
   {
    nome:"Financeiro",
    rota:"/financeiro",
    liberado:true
   },
   {
    nome:"Marketplace",
    rota:"/marketplace",
    liberado:true
   },
   {
    nome:"Planos",
    rota:"/planos",
    liberado:true
   }
  ]
 });
});

app.get("/api/rotas-flux",(req,res)=>{
 res.json({
  ok:true,
  cliente:{
   cadastro:"/cliente-cadastro",
   login:"/login",
   feed:"/feed",
   fluxo:"/fluxo",
   marketplace:"/marketplace",
   pedidos:"/pedidos",
   perfil:"/perfil",
   notificacoes:"/notificacoes",
   chat:"/chat"
  },
  empresa:{
   cadastro:"/cadastro",
   planos:"/planos",
   login:"/login",
   painel:"/painel",
   montarPerfil:"/montar-perfil",
   produtos:"/produtos",
   pedidos:"/pedidos-empresa",
   estoque:"/estoque",
   analytics:"/analytics",
   financeiro:"/financeiro"
  }
 });
});

/* ========================================================= */
`;

if(!s.includes("ROTAS OFICIAIS FLUX")){
 s = s.replace("/* CLIENTE / EMPRESA CADASTRO */", bloco + "\\n/* CLIENTE / EMPRESA CADASTRO */");
}

s = s.replaceAll('"/empresa.html"', '"/montar-perfil"');

fs.writeFileSync("server.js",s);

console.log("ROTAS OFICIAIS FLUX adicionadas.");