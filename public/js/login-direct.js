async function entrarDireto(){
 try{
  const res = await fetch("/empresa/login-demo",{ method:"POST" });
  const data = await res.json();

  if(!data.token){
   alert("Servidor não enviou token demo");
   return;
  }

  localStorage.clear();
  localStorage.setItem("flux_logged","true");
  localStorage.setItem("token",data.token);
  localStorage.setItem("flux_user","demo@flux.com");

  window.location.href="/planos";

 }catch(err){
  console.log(err);
  alert("Erro ao fazer login demo");
 }
}

window.addEventListener("DOMContentLoaded", function(){
 const loginBtn = document.getElementById("loginBtn");
 const demoBtn = document.getElementById("demoBtn");

 if(loginBtn){
  loginBtn.addEventListener("click", entrarDireto);
 }

 if(demoBtn){
  demoBtn.addEventListener("click", entrarDireto);
 }
});
