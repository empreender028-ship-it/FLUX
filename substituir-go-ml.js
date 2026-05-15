const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

const regex = /app\.get\("\/go\/ml\/:id",\s*async\s*\(req,res\)=>\{[\s\S]*?\n\}\);/;

const nova = pp.get("/go/ml/:id",(req,res)=>{

 try{

  const fs = require("fs");

  const banco = JSON.parse(
   fs.readFileSync("data/afiliados/produtos-afiliados.json","utf8")
  );

  const produto = (banco.produtos || []).find(
   p => String(p.id) === String(req.params.id)
  );

  if(!produto || !produto.url){
   return res.status(404).send("produto afiliado nao encontrado");
  }

  console.log("LINK AFILIADO:",produto.url);

  return res.redirect(produto.url);

 }catch(e){

  console.log(e);

  return res.status(500).send("erro afiliado");

 }

});;

s = s.replace(regex,nova);

fs.writeFileSync("server.js",s);

console.log("ROTA GO ML SUBSTITUIDA");
