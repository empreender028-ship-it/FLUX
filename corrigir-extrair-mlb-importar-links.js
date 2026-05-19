const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`function extrairMLB(link){
      const texto = String(link || "");
      const match = texto.match(/MLB-?(\\d+)/i);
      return match ? "MLB" + match[1] : "";
    }`,
`function extrairMLB(link){
      const texto = String(link || "");

      const wid = texto.match(/[?&]wid=(MLB\\d+)/i);
      if(wid) return wid[1];

      const itemId = texto.match(/item_id["'=:\\s]+(MLB\\d+)/i);
      if(itemId) return itemId[1];

      const match = texto.match(/MLB-?(\\d+)/i);
      return match ? "MLB" + match[1] : "";
    }`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("EXTRACAO MLB IMPORTAR-LINKS CORRIGIDA.");
