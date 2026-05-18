const fs = require("fs");

const file = "public/empresa.html";
let s = fs.readFileSync(file,"utf8");

s = s.replace(
`function toggleFollow(){
 following = !following;

 localStorage.setItem("flux_follow_empresa",following ? "1" : "0");

 applyFollow();

 toast(following ? "VocÃª estÃ¡ acompanhando" : "VocÃª deixou de acompanhar");

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

  if(data.ok){

   following = true;

   toast("Agora você acompanha este perfil");

   await carregarFollowers();

  }else{

   toast(data.erro || "Erro ao seguir");

  }

 }catch(e){

  console.log(e);
  toast("Erro ao seguir");

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
  console.log("followers:",e);
 }
}

function atualizarStats(){

 const baseViews = 42800;

 document.getElementById("views").innerText =
  compact(baseViews);

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

console.log("FOLLOW REAL VERDADEIRO APLICADO.");
