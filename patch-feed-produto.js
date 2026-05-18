const fs = require("fs");

const file = "public/feed.html";
let s = fs.readFileSync(file, "utf8");

fs.copyFileSync(file, "public/feed.backup-commerce.html");

if(!s.includes("function produtoCardHTML(post)")){
  s = s.replace(
    "function postHTML(post){",
`function moneyBR(v){
  const n = Number(v || 0);
  if(!n) return "Ver preço";
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function produtoCardHTML(post){
  if(!post.produtoId && !post.produtoNome) return "";

  const img = post.produtoImagem || post.media || "";
  const nome = post.produtoNome || "Produto Flux";
  const preco = moneyBR(post.produtoPreco);
  const link = post.produtoLink || (post.produtoId ? "/flux-produto/" + post.produtoId : "#");

  return \`
    <div class="flux-product-card">
      \${img ? \`<img src="\${img}" alt="\${nome}">\` : ""}
      <div>
        <strong>\${nome}</strong>
        <span>\${preco}</span>
      </div>
      <a href="\${link}" target="_blank" rel="noopener">Comprar</a>
    </div>
  \`;
}

function postHTML(post){`
  );
}

if(!s.includes(".flux-product-card")){
  s = s.replace("</style>", `
.flux-product-card{
  margin:12px 0 4px;
  padding:10px;
  display:flex;
  align-items:center;
  gap:10px;
  border-radius:18px;
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(16px);
}
.flux-product-card img{
  width:54px;
  height:54px;
  border-radius:14px;
  object-fit:cover;
}
.flux-product-card div{
  flex:1;
  min-width:0;
}
.flux-product-card strong{
  display:block;
  font-size:13px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.flux-product-card span{
  display:block;
  font-size:12px;
  opacity:.8;
  margin-top:3px;
}
.flux-product-card a{
  padding:9px 12px;
  border-radius:999px;
  background:#00d9ff;
  color:#001018;
  font-size:12px;
  font-weight:900;
  text-decoration:none;
}
</style>`);
}

if(!s.includes("${produtoCardHTML(post)}")){
  s = s.replace(
    "${post.descricao || \"\"}",
    "${post.descricao || \"\"}\n        ${produtoCardHTML(post)}"
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("CARD DE PRODUTO NO FEED APLICADO.");
