const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(/app\.get\(["']\/flux-produto\.html["'][\s\S]*?\}\);/g,"");
s = s.replace(/app\.get\(["']\/flux-produto\/:id["'][\s\S]*?\}\);/g,"");
s = s.replace(/app\.get\(["']\/flux-produto-final\.html["'][\s\S]*?\}\);/g,"");

const marker = 'const publicPath = path.join(__dirname, "public");';

const forceRoute = 
/* FORCE PRODUTO FLUX NOVO */
app.use((req,res,next)=>{
  if(
    req.path === "/flux-produto.html" ||
    req.path === "/flux-produto-final.html" ||
    req.path.startsWith("/flux-produto/")
  ){
    return res.sendFile(path.join(publicPath,"flux-produto.html"));
  }
  next();
});
;

if(!s.includes("FORCE PRODUTO FLUX NOVO")){
  s = s.replace(marker, marker + "\\n" + forceRoute);
}

fs.writeFileSync("server.js",s);
console.log("ROTA PRODUTO FLUX CORRIGIDA");
