const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`const r = await fetch("https://api.mercadolibre.com/items/" + mlId);`,
`const headers = {};
    if(process.env.ML_ACCESS_TOKEN){
      headers.Authorization = "Bearer " + process.env.ML_ACCESS_TOKEN;
    }

    const r = await fetch("https://api.mercadolibre.com/items/" + mlId,{headers});`
);

s = s.replace(
`const dr = await fetch("https://api.mercadolibre.com/items/" + mlId + "/description");`,
`const dr = await fetch("https://api.mercadolibre.com/items/" + mlId + "/description",{headers});`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("ML PRODUTO COM TOKEN APLICADO.");
