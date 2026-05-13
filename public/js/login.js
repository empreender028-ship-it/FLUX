const API = window.location.origin;

async function login(){

 const email = document.getElementById('email').value;
 const senha = document.getElementById('senha').value;
 const status = document.getElementById('status');

 if(!email || !senha){
  status.innerHTML = "Preencha todos os campos";
  return;
 }

 status.innerHTML = "Entrando...";

 try{

  const res = await fetch(API + "/empresa/login",{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body: JSON.stringify({ email, senha })
  });

  const data = await res.json();

  if(data.token){

   localStorage.setItem("token", data.token);

   status.innerHTML = "Login OK 🚀";

   setTimeout(()=>{
    location.href = "/painel";
   },700);

  }else{
   status.innerHTML = data.erro || "Erro login";
  }

 }catch(e){
  status.innerHTML = "Erro servidor";
 }

}

/* ENTER */
document.addEventListener("keydown",(e)=>{
 if(e.key === "Enter") login();
});

