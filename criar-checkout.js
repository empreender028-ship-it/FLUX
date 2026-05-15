const fs = require("fs");

const html = 
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Checkout FLUX</title>

<style>
*{
 box-sizing:border-box;
 margin:0;
 padding:0;
 font-family:Inter,Arial;
}

body{
 background:radial-gradient(circle at top,#123b88,#050816 45%,#000);
 color:white;
 min-height:100vh;
}

.top{
 padding:18px;
 background:rgba(0,0,0,.78);
 backdrop-filter:blur(20px);
 font-size:24px;
 font-weight:900;
}

.wrap{
 max-width:760px;
 margin:auto;
 padding:16px;
}

.card{
 background:rgba(255,255,255,.07);
 border:1px solid rgba(255,255,255,.1);
 border-radius:28px;
 padding:16px;
}

.product{
 display:grid;
 grid-template-columns:160px 1fr;
 gap:14px;
}

img{
 width:100%;
 border-radius:20px;
 background:#111;
}

.price{
 color:#18f2a3;
 font-size:32px;
 font-weight:900;
 margin-top:10px;
}

.box{
 margin-top:14px;
 padding:14px;
 border-radius:18px;
 background:rgba(255,255,255,.06);
 border:1px solid rgba(255,255,255,.1);
}

input{
 width:100%;
 height:52px;
 border-radius:16px;
 border:none;
 padding:0 14px;
 margin-top:10px;
}

button{
 width:100%;
 height:56px;
 border:none;
 border-radius:18px;
 background:linear-gradient(90deg,#2563ff,#00d9ff);
 color:white;
 font-weight:900;
 margin-top:12px;
 cursor:pointer;
}

.pay{
 background:linear-gradient(90deg,#00c853,#18f2a3);
 color:#001b10;
}

.option{
 padding:12px;
 border-radius:14px;
 background:rgba(255,255,255,.07);
 margin-top:8px;
}
</style>
</head>

<body>

<header class="top">
FLUX Checkout
</header>

<main class="wrap">
<section class="card" id="app">
Carregando...
</section>
</main>

<script>

let produto = null;

function money(v){
 return "R$ " + Number(v || 0).toLocaleString("pt-BR",{
  minimumFractionDigits:2
 });
}

async function load(){

 const id = new URLSearchParams(location.search).get("id");

 const r = await fetch("/api/ml/item/" + id);

 const d = await r.json();

 produto = d.produto;

 if(!produto){
  document.getElementById("app").innerHTML = "Produto não encontrado";
  return;
 }

 document.getElementById("app").innerHTML = \
 <div class="product">

   <img src="\">

   <div>
      <h1>\</h1>

      <div class="price">
      \
      </div>

      <div style="margin-top:10px;color:#94a3b8">
      Estoque real integrado
      </div>
   </div>

 </div>

 <div class="box">

   <b>Calcular frete</b>

   <input id="cep" placeholder="Digite seu CEP">

   <button onclick="frete()">
   Calcular entrega
   </button>

   <div id="frete"></div>

 </div>

 <div class="box">

   <b>Pagamento</b>

   <div class="option">Cartão de crédito</div>
   <div class="option">Pix</div>
   <div class="option">Boleto</div>
   <div class="option">Saldo Mercado Pago</div>

   <button class="pay" onclick="finalizar()">
   Finalizar compra segura
   </button>

 </div>
 \;

}

async function frete(){

 const cep = document.getElementById("cep").value;

 const box = document.getElementById("frete");

 box.innerHTML = "Consultando entrega...";

 const r = await fetch("/api/ml/frete/" + produto.id + "?cep=" + cep);

 const d = await r.json();

 if(!d.ok){
   box.innerHTML = "Frete indisponível";
   return;
 }

 box.innerHTML = (d.opcoes || []).map(o => \
   <div class="option">
   \ - \
   </div>
 \).join("");

}

function finalizar(){

 location.href = "/go/ml/" + produto.id;

}

load();

</script>

</body>
</html>
;

fs.writeFileSync("public/checkout-afiliado.html", html);

console.log("checkout-afiliado.html criado com sucesso");
