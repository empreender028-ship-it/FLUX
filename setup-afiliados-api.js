const fs = require("fs");

function addBeforeServerListen(src, code){
  if(src.includes("SISTEMA AFILIADOS FLUX 50 PERFIS")) return src;
  const marker = /server\.listen\s*\(/;
  const i = src.search(marker);
  if(i === -1) return src + "\n" + code;
  return src.slice(0,i) + code + "\n" + src.slice(i);
}

let s = fs.readFileSync("server.js","utf8");

const apiCode = 

/* SISTEMA AFILIADOS FLUX 50 PERFIS */
const ML_SEARCH_TERMS = [
 "moda feminina","streetwear feminino","vestido feminino","cropped feminino","bolsa feminina",
 "sandalia feminina","chinelo feminino","oculos feminino","beleza feminina","perfume feminino",
 "maquiagem","skincare","tenis feminino","calca feminina","jaqueta feminina"
];

async function mlFetchJson(url){
 const r = await fetch(url,{
  headers:{
   "Accept":"application/json",
   "User-Agent":"Flux/1.0"
  }
 });
 const data = await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(data.message || "erro_ml");
 return data;
}

function mlNormalizeProduct(p){
 const seller = p.seller || {};
 const sellerId = String(seller.id || p.seller_id || "seller");
 const sellerName = seller.nickname || "Loja Parceira";
 return {
  id:p.id,
  mlId:p.id,
  tipo:"afiliado",
  titulo:p.title || "Produto Flux",
  preco:Number(p.price || 0),
  moeda:p.currency_id || "BRL",
  imagem:p.thumbnail || p.secure_thumbnail || "",
  link:p.permalink || "",
  linkAfiliado:p.permalink || "",
  estoque:p.available_quantity ?? null,
  vendidos:p.sold_quantity ?? 0,
  condicao:p.condition || "new",
  vendedor:{
   id:sellerId,
   nickname:sellerName,
   reputacao:seller.seller_reputation || {},
   cidade:p.seller_address?.city?.name || "",
   estado:p.seller_address?.state?.name || "",
   pais:p.seller_address?.country?.name || "Brasil"
  },
  perfil:{
   id:sellerId,
   nome:sellerName,
   slug:"ml-" + sellerId,
   avatar:"",
   capa:p.thumbnail || "",
   localizacao:[
    p.seller_address?.city?.name,
    p.seller_address?.state?.name
   ].filter(Boolean).join(" - "),
   reputacao:seller.seller_reputation || {},
   link:"/perfil-afiliado.html?seller=" + encodeURIComponent(sellerId)
  }
 };
}

app.get("/api/afiliados/perfis", async (req,res)=>{
 try{
  const limit = Math.min(Number(req.query.limit || 50),50);
  const produtos = [];
  const perfis = new Map();

  for(const termo of ML_SEARCH_TERMS){
   if(perfis.size >= limit) break;

   const url = "https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(termo) + "&limit=20";
   const data = await mlFetchJson(url);

   for(const item of (data.results || [])){
    const p = mlNormalizeProduct(item);
    produtos.push(p);

    if(!perfis.has(p.vendedor.id)){
     perfis.set(p.vendedor.id,{
      id:p.vendedor.id,
      tipo:"afiliado",
      nome:p.vendedor.nickname,
      slug:"ml-" + p.vendedor.id,
      avatar:p.imagem,
      capa:p.imagem,
      localizacao:p.perfil.localizacao,
      cidade:p.vendedor.cidade,
      estado:p.vendedor.estado,
      reputacao:p.vendedor.reputacao,
      avaliacao:p.vendedor.reputacao?.level_id || "Loja verificada",
      vendas:p.vendedor.reputacao?.transactions?.completed || p.vendidos || 0,
      produtos:[],
      posts:[]
     });
    }

    const perfil = perfis.get(p.vendedor.id);
    if(perfil.produtos.length < 12) perfil.produtos.push(p);
    if(perfil.posts.length < 6){
     perfil.posts.push({
      id:"post-" + p.id,
      tipo:p.video ? "video" : "produto",
      titulo:p.titulo,
      imagem:p.imagem,
      video:p.video || "",
      texto:"Produto em destaque na Flux.",
      produtoId:p.id
     });
    }

    if(perfis.size >= limit) break;
   }
  }

  return res.json({
   ok:true,
   total:perfis.size,
   perfis:Array.from(perfis.values()),
   produtos:produtos.slice(0,150)
  });
 }catch(err){
  console.log("afiliados perfis erro:",err.message);
  return res.status(500).json({ok:false,erro:err.message});
 }
});

app.get("/api/afiliados/perfil/:sellerId", async (req,res)=>{
 try{
  const sellerId = String(req.params.sellerId || "");
  const geral = await fetch((BASE_URL || "") + "/api/afiliados/perfis?limit=50").then(r=>r.json()).catch(()=>null);

  let perfil = geral?.perfis?.find(p=>String(p.id)===sellerId);

  if(!perfil){
   const data = await mlFetchJson("https://api.mercadolibre.com/sites/MLB/search?seller_id=" + encodeURIComponent(sellerId) + "&limit=30");
   const produtos = (data.results || []).map(mlNormalizeProduct);
   const first = produtos[0];
   perfil = {
    id:sellerId,
    tipo:"afiliado",
    nome:first?.vendedor?.nickname || "Loja Parceira",
    slug:"ml-" + sellerId,
    avatar:first?.imagem || "",
    capa:first?.imagem || "",
    localizacao:first?.perfil?.localizacao || "",
    reputacao:first?.vendedor?.reputacao || {},
    avaliacao:first?.vendedor?.reputacao?.level_id || "Loja verificada",
    vendas:first?.vendedor?.reputacao?.transactions?.completed || 0,
    produtos,
    posts:produtos.slice(0,8).map(p=>({
     id:"post-" + p.id,
     tipo:"produto",
     titulo:p.titulo,
     imagem:p.imagem,
     texto:"Produto em destaque na Flux.",
     produtoId:p.id
    }))
   };
  }

  return res.json({ok:true,perfil});
 }catch(err){
  console.log("afiliado perfil erro:",err.message);
  return res.status(500).json({ok:false,erro:err.message});
 }
});

app.get("/api/ml/item/:id", async (req,res)=>{
 try{
  const id = String(req.params.id || "");
  const item = await mlFetchJson("https://api.mercadolibre.com/items/" + encodeURIComponent(id));
  let desc = {};
  try{
   desc = await mlFetchJson("https://api.mercadolibre.com/items/" + encodeURIComponent(id) + "/description");
  }catch{}

  return res.json({
   ok:true,
   produto:{
    id:item.id,
    mlId:item.id,
    tipo:"afiliado",
    titulo:item.title,
    preco:item.price,
    moeda:item.currency_id,
    imagem:item.pictures?.[0]?.secure_url || item.thumbnail || "",
    fotos:(item.pictures || []).map(x=>x.secure_url || x.url).filter(Boolean),
    estoque:item.available_quantity,
    vendidos:item.sold_quantity,
    condicao:item.condition,
    link:item.permalink,
    linkAfiliado:item.permalink,
    video:item.video_id ? "https://www.youtube.com/watch?v=" + item.video_id : "",
    descricao:desc.plain_text || "",
    atributos:item.attributes || [],
    vendedor:{
     id:item.seller_id
    }
   }
  });
 }catch(err){
  return res.status(500).json({ok:false,erro:err.message});
 }
});

app.get("/api/ml/frete/:id", async (req,res)=>{
 try{
  const id = String(req.params.id || "");
  const cep = String(req.query.cep || "").replace(/\\D/g,"");
  if(!cep || cep.length < 8){
   return res.status(400).json({ok:false,erro:"cep_invalido"});
  }

  const url = "https://api.mercadolibre.com/items/" + encodeURIComponent(id) + "/shipping_options?zip_code=" + encodeURIComponent(cep);
  const data = await mlFetchJson(url);

  return res.json({
   ok:true,
   cep,
   opcoes:(data.options || []).map(o=>({
    nome:o.name || o.shipping_method_id || "Entrega",
    prazo:o.estimated_delivery_time?.date || o.estimated_delivery_time?.shipping || "",
    custo:o.cost || 0,
    moeda:o.currency_id || "BRL"
   })),
   raw:data
  });
 }catch(err){
  return res.status(500).json({ok:false,erro:err.message});
 }
});

app.get("/afiliados", (req,res)=>res.sendFile(path.join(publicPath,"afiliados.html")));
app.get("/perfil-afiliado", (req,res)=>res.sendFile(path.join(publicPath,"perfil-afiliado.html")));
app.get("/checkout-afiliado", (req,res)=>res.sendFile(path.join(publicPath,"checkout-afiliado.html")));

;

s = addBeforeServerListen(s, apiCode);

fs.writeFileSync("server.js",s);
console.log("APIs afiliados adicionadas");
