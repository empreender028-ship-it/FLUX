const fs=require("fs");
let s=fs.readFileSync("server.js","utf8");

s=s.replace(/app\.get\(['"]\/perfil-afiliado\.html['"][\s\S]*?\}\);/g,"");

const rota=
/* ROTA PERFIL AFILIADO FLUX */
app.get("/perfil-afiliado.html",(req,res)=>{
 return res.sendFile(path.join(__dirname,"public","perfil-afiliado.html"));
});
;

const i=s.search(/server\.listen\s*\(/);

if(i>-1){
 s=s.slice(0,i)+rota+"\n"+s.slice(i);
}else{
 s+="\n"+rota;
}

fs.writeFileSync("server.js",s);
console.log("rota perfil afiliado inserida antes do server.listen");
