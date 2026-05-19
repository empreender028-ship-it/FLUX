const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

if(!s.includes('app.get("/api/ml/produto/:mlId"')){
const rota = `

app.get("/api/ml/produto/:mlId", async (req,res)=>{
  try{
    const mlId = String(req.params.mlId || "").trim();

    const r = await fetch("https://api.mercadolibre.com/items/" + mlId);
    const item = await r.json();

    if(!r.ok){
      return res.status(r.status).json({
        ok:false,
        erro:"ml_item_error",
        item
      });
    }

    let desc = "";
    try{
      const dr = await fetch("https://api.mercadolibre.com/items/" + mlId + "/description");
      const dj = await dr.json();
      desc = dj.plain_text || "";
    }catch(e){}

    return res.json({
      ok:true,
      produto:{
        id:item.id,
        titulo:item.title,
        preco:item.price,
        moeda:item.currency_id,
        estoque:item.available_quantity,
        vendido:item.sold_quantity,
        thumbnail:item.thumbnail,
        imagens:(item.pictures || []).map(p=>p.secure_url || p.url),
        video:item.video_id || "",
        sellerId:item.seller_id,
        categoria:item.category_id,
        permalink:item.permalink,
        descricao:desc
      }
    });

  }catch(e){
    console.log("ml produto:",e);
    return res.status(500).json({
      ok:false,
      erro:"ml_produto_error",
      detalhe:String(e.message || e)
    });
  }
});

`;

s = s.replace('app.get("/api/for-you"', rota + '\napp.get("/api/for-you"');
}

fs.writeFileSync("server.js",s,"utf8");
console.log("ROTA ML PRODUTO CRIADA.");
