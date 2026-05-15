const fs = require("fs");

let server = fs.readFileSync("server.js","utf8");

if(server.includes("/go/ml/:id")){
 console.log("rota afiliada ja existe");
 process.exit(0);
}

const rota = `

/* FLUX AFILIADOS */
app.get("/go/ml/:id",(req,res)=>{

 try{

  const banco = JSON.parse(
   fs.readFileSync("data/afiliados/produtos-afiliados.json","utf8")
  );

  const produto = (banco.produtos || []).find(
   p => String(p.id) === String(req.params.id)
  );

  if(!produto){
   return res.redirect("/marketplace2.html");
  }

  return res.redirect(produto.url);

 }catch(e){

  console.log(e);

  return res.redirect("/marketplace2.html");

 }

});

`;

const pos = server.search(/server\.listen\s*\(/);

if(pos !== -1){
 server =
  server.slice(0,pos) +
  rota +
  server.slice(pos);
}else{
 server += rota;
}

fs.writeFileSync("server.js",server);

console.log("ROTA AFILIADA FLUX CRIADA");