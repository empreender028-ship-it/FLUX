const fs = require("fs");

const file = "public/fluxo.html";
let s = fs.readFileSync(file, "utf8");

fs.copyFileSync(file, "public/fluxo.backup-produto-real.html");

if(!s.includes("function moneyBR")){
  s = s.replace(
    "function isVideo(src){",
`function moneyBR(v){
 const n = Number(v || 0);
 if(!n) return "Ver preço";
 return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function produtoRealHTML(post){
 const nome = post.produtoNome || post.produto || "";
 if(!post.produtoId && !nome) return "";

 const preco = moneyBR(post.produtoPreco);
 const img = post.produtoImagem || post.media || "";
 const link = post.produtoLink || (post.produtoId ? "/flux-produto/" + post.produtoId : "#");

 return \`
  <div class="produto-real-fluxo">
   \${img ? \`<img src="\${safe(img)}">\` : ""}
   <div>
    <strong>\${safe(nome || "Produto Flux")}</strong>
    <span>\${safe(preco)}</span>
   </div>
   <a href="\${safe(link)}" target="_blank" rel="noopener">Comprar</a>
  </div>
 \`;
}

function isVideo(src){`
  );
}

if(!s.includes(".produto-real-fluxo")){
  s = s.replace("</style>", `
.produto-real-fluxo{
 margin-top:12px;
 padding:10px;
 display:flex;
 align-items:center;
 gap:10px;
 border-radius:18px;
 background:rgba(0,217,255,.10);
 border:1px solid rgba(0,217,255,.25);
 backdrop-filter:blur(16px);
}
.produto-real-fluxo img{
 width:56px;
 height:56px;
 object-fit:cover;
 border-radius:14px;
}
.produto-real-fluxo div{
 flex:1;
 min-width:0;
}
.produto-real-fluxo strong{
 display:block;
 color:#fff;
 font-size:13px;
 white-space:nowrap;
 overflow:hidden;
 text-overflow:ellipsis;
}
.produto-real-fluxo span{
 color:#00d9ff;
 font-size:12px;
 font-weight:900;
}
.produto-real-fluxo a{
 padding:9px 12px;
 border-radius:999px;
 background:#00d9ff;
 color:#001018;
 text-decoration:none;
 font-weight:900;
 font-size:12px;
}
</style>`);
}

s = s.replace(
  '<b>${safe(post.produto || "Produto Flux")}</b>',
  '<b>${safe(post.produtoNome || post.produto || "Produto Flux")}</b>'
);

if(!s.includes("${produtoRealHTML(post)}")){
  s = s.replace(
    '<b>${safe(post.produtoNome || post.produto || "Produto Flux")}</b>',
    '<b>${safe(post.produtoNome || post.produto || "Produto Flux")}</b>${produtoRealHTML(post)}'
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("FLUXO COM PRODUTO REAL + PRECO + COMPRAR APLICADO.");
