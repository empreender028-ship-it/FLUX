const fs = require("fs");
let s = fs.readFileSync("public/empresa.html","utf8");

s = s.replace(
`carregarVitrinePremium();`,
`carregarVitrinePremium();

setInterval(()=>{
 const v = document.getElementById("views");
 if(v && v.innerText.includes("42.8")){
   v.innerText = "0";
 }
},300);`
);

fs.writeFileSync("public/empresa.html",s,"utf8");
console.log("FORCE REMOVE 42.8K APLICADO.");
