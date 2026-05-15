const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const rota = 

/* API AFILIADO */
app.get("/api/afiliado/:id", async (req,res)=>{

 try{

  const r = await fetch(
   "https://api.mercadolibre.com/items/" + req.params.id
  );

  const item = await r.json();

  if(!item || item.error){
   return res.status(404).json({erro:"produto_nao_encontrado"});
  }

  const sellerRes = await fetch(
   "https://api.mercadolibre.com/users/" + item.seller_id
  );

  const seller = await sellerRes.json();

  return res.json({
   ok:true,

   produto:{
    id:item.id,
    titulo:item.title,
    preco:item.price,
    foto:item.thumbnail,
    estoque:item.available_quantity,
    vendidos:item.sold_quantity
   },

   vendedor:{
    id:seller.id,
    nome:seller.nickname,
    localizacao:seller.address || {},
    reputacao:seller.seller_reputation || {}
   }

  });

 }catch(e){

  console.log(e);

  return res.status(500).json({erro:"erro_api_afiliado"});

 }

});

;

const pos = s.search(/server\.listen\s*\(/);

if(pos !== -1){
 s = s.slice(0,pos) + rota + "\n" + s.slice(pos);
}else{
 s += rota;
}

fs.writeFileSync("server.js",s);

console.log("API AFILIADO INSERIDA");

