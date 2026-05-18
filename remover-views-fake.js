const fs = require("fs");
let s = fs.readFileSync("public/empresa.html","utf8");

s = s.replace(
`function atualizarStats(){

 const baseViews = 42800;

 document.getElementById("views").innerText =
  compact(baseViews);

 document.getElementById("followers").innerText =
  compact(followersCount);

}`,
`function atualizarStats(){

 const totalViews = [...document.querySelectorAll(".post-stats .views")]
  .map(el => Number((el.innerText || "0").replace(/\\D/g,"")) || 0)
  .reduce((a,b)=>a+b,0);

 document.getElementById("views").innerText =
  compact(totalViews);

 document.getElementById("followers").innerText =
  compact(followersCount);

}`
);

s = s.replace(
`document.getElementById("postCount").innerText = data.length + " posts";`,
`document.getElementById("postCount").innerText = data.length + " posts";
 setTimeout(atualizarStats,100);`
);

fs.writeFileSync("public/empresa.html",s,"utf8");
console.log("VIEWS FAKE REMOVIDAS.");
