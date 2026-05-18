const fs = require("fs");
let s = fs.readFileSync("public/empresa.html","utf8");

s = s.replace(
`<article class="post">`,
`<article class="post" data-post-id="\${safe(post._id || post.id || '')}">`
);

if(!s.includes("function registrarViewDiretaEmpresa")){
s = s.replace(
`function renderPosts(data){`,
`function registrarViewDiretaEmpresa(){
 document.querySelectorAll("[data-post-id]").forEach(el=>{
  const id = el.dataset.postId;
  if(!id || el.dataset.viewed === "1") return;
  el.dataset.viewed = "1";
  fetch("/api/view/" + id,{method:"POST"}).catch(()=>{});
 });
 setTimeout(carregarStatsEmpresa,800);
}

function renderPosts(data){`
);
}

s = s.replace(
`document.getElementById("postCount").innerText = data.length + " posts";`,
`document.getElementById("postCount").innerText = data.length + " posts";
 setTimeout(registrarViewDiretaEmpresa,500);`
);

fs.writeFileSync("public/empresa.html",s,"utf8");
console.log("VIEW DIRETA EMPRESA APLICADA.");
