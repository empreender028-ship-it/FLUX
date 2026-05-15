const fs=require("fs");
const path="public/marketplace.html";
let html=fs.readFileSync(path,"utf8");

// remove blocos feios de teste Mercado Livre
html=html.replace(/<div id="mlFluxArea"[\s\S]*?carregarProdutosMercadoLivreFlux\(\);\s*<\/script>/g,"");
html=html.replace(/<script>\s*async function carregarProdutosMercadoLivreFlux\(\)[\s\S]*?carregarProdutosMercadoLivreFlux\(\);\s*<\/script>/g,"");

// adiciona ML dentro do sistema original
html=html.replace(
`let products = [
 ...getPainelProducts(),
 ...demoProducts
];`,
`let mlProducts = [];

function normalizeMLProduct(p){
 return {
  id:p.mlId,
  mlId:p.mlId,
  name:p.titulo,
  price:Number(p.preco || 0),
  category:"moda",
  image:p.imagem,
  badge:"Mercado Livre",
  rating:5,
  stock:p.status === "active" ? "Disponível" : "Em análise",
  seller:p.vendedor?.nickname || "Mercado Livre",
  ownerName:p.vendedor?.nickname || "Mercado Livre",
  ownerId:p.vendedor?.id || "ml",
  ownerPlan:"Parceiro integrado",
  ownerLogo:"",
  profileUrl:"/flux-produto.html?id=" + p.mlId,
  desc:"Produto integrado automaticamente na Flux via Mercado Livre."
 };
}

async function loadMLProducts(){
 try{
  const r = await fetch("/api/ml/produtos?v=" + Date.now());
  const data = await r.json();
  mlProducts = (data.produtos || []).map(normalizeMLProduct);
 }catch(e){
  mlProducts = [];
 }
}

let products = [
 ...getPainelProducts(),
 ...mlProducts,
 ...demoProducts
];`
);

html=html.replace(
`products = [
  ...getPainelProducts(),
  ...demoProducts
 ];`,
`products = [
  ...getPainelProducts(),
  ...mlProducts,
  ...demoProducts
 ];`
);

html=html.replace(
`function buyNow(id){
 addCart(id);
 openCart();
}`,
`function buyNow(id){
 const product = findProduct(id);

 if(product && product.mlId){
  location.href = "/flux-produto.html?id=" + product.mlId;
  return;
 }

 addCart(id);
 openCart();
}`
);

html=html.replace(
`renderProducts();
updateCart();
loadOnline();
setInterval(loadOnline,5000);`,
`loadMLProducts().then(()=>{
 renderProducts();
 updateCart();
 loadOnline();
});

setInterval(loadOnline,5000);`
);

fs.writeFileSync(path,html,"utf8");
