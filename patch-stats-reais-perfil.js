const fs = require("fs");

let s = fs.readFileSync("public/empresa.html","utf8");

if(!s.includes("carregarStatsEmpresa")){

s = s.replace(
`applyFollow();
 carregarFollowers();`,
`applyFollow();
 carregarFollowers();
 carregarStatsEmpresa();`
);

s = s.replace(
`function atualizarStats(){`,
`async function carregarStatsEmpresa(){

 try{

  const empresaId =
   new URLSearchParams(location.search).get("id") ||
   localStorage.getItem("empresa_id") ||
   "6a0af36ad636b37fa42b3289";

  const res = await fetch("/api/empresa-stats/" + empresaId);

  const data = await res.json();

  if(!data.ok) return;

  document.getElementById("views").innerText =
   compact(data.views || 0);

 }catch(e){
  console.log("stats empresa",e);
 }

}

function atualizarStats(){`
);

}

fs.writeFileSync("public/empresa.html",s,"utf8");

console.log("STATS REAIS NO PERFIL APLICADO.");
