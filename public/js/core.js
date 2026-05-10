const API = window.location.origin + "/api";

const ROUTES = {
 home:"/index.html",
 login:"/login.html",
 feed:"/feed.html",
 admin:"/admin.html",
 fluxo:"/fluxo.html",
 perfil:"/perfil.html"
};

function go(route){

 if(!ROUTES[route]){
  console.error("rota inválida");
  return;
 }

 location.href = ROUTES[route];
}

function authHeader(){
 return {
  Authorization:
   "Bearer " +
   localStorage.getItem("token"),

  "Content-Type":"application/json"
 };
}

async function api(path,options={}){

 try{

  const r = await fetch(API + path,{
   ...options,
   headers:{
    ...authHeader(),
    ...(options.headers||{})
   }
  });

  return await r.json();

 }catch(e){

  console.error(e);
  return null;

 }
}

function logout(){

 localStorage.clear();
 go("login");

}