const fs = require("fs");

const file = "public/flux-produto.html";
let s = fs.existsSync(file) ? fs.readFileSync(file,"utf8") : "";

const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Produto Flux</title>
<style>
body{margin:0;background:#050505;color:white;font-family:Arial}
.wrap{max-width:520px;margin:auto;min-height:100vh;background:#000}
.hero img,.hero video{width:100%;max-height:62vh;object-fit:cover;background:#111}
.content{padding:20px}
h1{font-size:24px;margin:0 0 8px}
.price{font-size:26px;color:#00d9ff;font-weight:900;margin:12px 0}
.desc{opacity:.82;line-height:1.5}
.btn{display:block;text-align:center;background:#00d9ff;color:#001018;padding:16px;border-radius:999px;text-decoration:none;font-weight:900;margin-top:18px}
.meta{margin-top:14px;font-size:13px;opacity:.65}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero" id="hero"></div>
  <div class="content">
    <h1 id="nome">Produto Flux</h1>
    <div class="price" id="preco">Carregando...</div>
    <p class="desc" id="descricao"></p>
    <a class="btn" id="comprar" href="#">Comprar agora</a>
    <div class="meta" id="meta"></div>
  </div>
</div>

<script>
function idProduto(){
 const path = location.pathname.split("/").filter(Boolean);
 return path[path.length-1] || new URLSearchParams(location.search).get("id");
}

function money(v){
 const n = Number(v || 0);
 if(!n) return "Ver preço";
 return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

async function carregar(){
 const id = idProduto();
 const res = await fetch("/api/produtos");
 const produtos = await res.json();
 const p = produtos.find(x => String(x._id) === String(id));

 if(!p){
  nome.textContent = "Produto não encontrado";
  preco.textContent = "";
  return;
 }

 nome.textContent = p.nome || "Produto Flux";
 preco.textContent = money(p.precoPromocional || p.preco);
 descricao.textContent = p.descricao || "";
 comprar.href = p.link || "#";
 comprar.target = p.link && p.link.startsWith("http") ? "_blank" : "_self";
 meta.textContent = "Estoque: " + (p.estoque ?? 0) + " • Vendidos: " + (p.vendido ?? 0);

 const img = p.imagem || (p.imagens && p.imagens[0]) || "";
 const video = p.video || "";

 if(video){
  hero.innerHTML = '<video src="'+video+'" controls autoplay muted playsinline></video>';
 }else{
  hero.innerHTML = '<img src="'+img+'" alt="">';
 }
}

carregar();
</script>
</body>
</html>
`;

fs.writeFileSync(file, html, "utf8");
console.log("PAGINA PRODUTO FLUX PREMIUM CRIADA.");
