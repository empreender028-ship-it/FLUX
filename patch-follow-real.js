const fs = require("fs");

const file = "public/empresa.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/empresa.backup-follow-real.html");

s = s.replace(
`let following = localStorage.getItem("flux_follow_empresa") === "1";`,
`let following = false;
let followersCount = 0;`
);

s = s.replace(
`function toggleFollow(){
 following = !following;

 localStorage.setItem("flux_follow_empresa",following ? "1" : "0");

 applyFollow();

 toast(following ? "Você está acompanhando" : "Você deixou de acompanhar");

 atualizarStats();
}`,
`async function toggleFollow(){

 try{

   const empresaId =
     new URLSearchParams(location.search).get("id") ||
     localStorage.getItem("empresa_id") ||
     "6a0af36ad636b37fa42b3289";

   const token =
     localStorage.getItem("token") ||
     localStorage.getItem("flux_token");

   const res = await fetch("/api/follow/" + empresaId,{
     method:"POST",
     headers:{
       Authorization:"Bearer " + token
     }
   });

   const data = await res.json();

   following = true;

   await carregarFollowers();

   applyFollow();

   toast(data.ok ? "Agora você acompanha este perfil" : "Erro ao seguir");

 }catch(e){
   console.log(e);
   toast("Erro ao seguir perfil");
 }
}`
);

s = s.replace(
`function atualizarStats(){
 const baseViews = 42800;
 const baseFollowers = 8200 + (following ? 1 : 0);

 document.getElementById("views").innerText = compact(baseViews);
 document.getElementById("followers").innerText = compact(baseFollowers);
}`,
`async function carregarFollowers(){

 try{

   const empresaId =
     new URLSearchParams(location.search).get("id") ||
     localStorage.getItem("empresa_id") ||
     "6a0af36ad636b37fa42b3289";

   const token =
     localStorage.getItem("token") ||
     localStorage.getItem("flux_token");

   const res = await fetch("/api/follow-status/" + empresaId,{
     headers: token ? {
       Authorization:"Bearer " + token
     } : {}
   });

   const data = await res.json();

   following = !!data.seguindo;
   followersCount = Number(data.seguidores || 0);

   applyFollow();

   atualizarStats();

 }catch(e){
   console.log("followers",e);
 }
}

function atualizarStats(){

 const baseViews = 42800;

 document.getElementById("views").innerText = compact(baseViews);

 document.getElementById("followers").innerText =
   compact(followersCount);
}`
);

s = s.replace(
`applyFollow();
 atualizarStats();`,
`applyFollow();
 carregarFollowers();`
);

fs.writeFileSync(file,s,"utf8");

console.log("FOLLOW REALTIME REAL APLICADO.");
