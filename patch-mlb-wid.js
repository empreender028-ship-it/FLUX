const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`const match = finalUrl.match(/MLB-?\\d+/i);`,
`let match = finalUrl.match(/MLB-?\\d+/i);

        if(!match){
          const wid = finalUrl.match(/[?&]wid=(MLB\\d+)/i);
          if(wid) match = [wid[1]];
        }`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("EXTRACAO MLB WID APLICADA.");
