const fs = require("fs");

const path = "data/afiliados/produtos-afiliados.json";

const banco = JSON.parse(
 fs.readFileSync(path,"utf8")
);

if(banco.produtos && banco.produtos[0]){
 banco.produtos[0].id = "MLB4519183065";
}

fs.writeFileSync(
 path,
 JSON.stringify(banco,null,2)
);

console.log("ID CORRIGIDO");
