const dados = {
 premium:{
  nome:"Premium Soles",
  curtidas:[
   ["RT","Roberta Timote","Salvou o produto"],
   ["LC","Lucas Costa","Curtiu a coleção"],
   ["MA","Marina Alves","Visitou o marketplace"]
  ],
  comentarios:[
   ["Roberta Timote","Quero ver modelos femininos disponíveis."],
   ["Lucas Costa","Agora parece app real."],
   ["Marina Alves","Gostei da vitrine limpa."]
  ]
 },
 trends:{
  nome:"Flux Trends",
  curtidas:[
   ["FT","Fernanda Torres","Interesse em campanha"],
   ["BR","Bruno Reis","Abriu métricas"],
   ["CA","Camila Andrade","Salvou o conteúdo"]
  ],
  comentarios:[
   ["Fernanda Torres","Esse modelo comercial ficou claro."],
   ["Bruno Reis","Os sinais comerciais fazem sentido."],
   ["Camila Andrade","Sem imagem quebrada ficou profissional."]
  ]
 }
};

function toast(msg){
 let t = document.querySelector(".flux-toast");

 if(!t){
  t = document.createElement("div");
  t.className = "flux-toast";
  document.body.appendChild(t);
 }

 t.textContent = msg;
 t.classList.add("show");

 setTimeout(()=>t.classList.remove("show"),1400);
}

function inject(){
 const s = document.createElement("style");
 s.innerHTML = `
 .flux-toast{
  position:fixed;
  left:50%;
  bottom:92px;
  transform:translateX(-50%) translateY(18px);
  padding:12px 15px;
  border-radius:16px;
  background:rgba(0,0,0,.82);
  border:1px solid rgba(255,255,255,.12);
  color:white;
  font-size:12px;
  font-weight:900;
  opacity:0;
  pointer-events:none;
  transition:.22s;
  z-index:99999;
  backdrop-filter:blur(18px);
 }

 .flux-toast.show{
  opacity:1;
  transform:translateX(-50%) translateY(0);
 }

 .liked,
 .saved{
  color:#00d9ff!important;
  background:rgba(0,217,255,.10)!important;
  border-color:rgba(0,217,255,.35)!important;
 }

 button,
 .act,
 .follow,
 .open-sheet,
 .theme-btn{
  touch-action:manipulation;
 }
 `;
 document.head.appendChild(s);
}

function aplicarTema(){
 const btn = document.getElementById("themeBtn");
 const tema = localStorage.getItem("flux_theme");

 if(tema === "light"){
  document.body.classList.add("light");
  if(btn) btn.textContent = "Noturno";
 }else{
  document.body.classList.remove("light");
  if(btn) btn.textContent = "Claro";
 }
}

function alternarTema(){
 const claro = document.body.classList.toggle("light");
 localStorage.setItem("flux_theme", claro ? "light" : "dark");

 const btn = document.getElementById("themeBtn");
 if(btn) btn.textContent = claro ? "Noturno" : "Claro";

 toast(claro ? "Sistema claro ativado" : "Sistema noturno ativado");
}

function abrirSheet(id){
 const sheet = document.getElementById("sheet");
 const title = document.getElementById("sheetTitle");

 if(!sheet || !dados[id]) return;

 title.textContent = dados[id].nome;
 sheet.classList.add("show");
 renderLikes(id);
}

function fecharSheet(){
 const sheet = document.getElementById("sheet");
 if(sheet) sheet.classList.remove("show");
}

function renderLikes(id){
 const content = document.getElementById("sheetContent");
 const likesTab = document.getElementById("likesTab");
 const commentsTab = document.getElementById("commentsTab");

 if(!content) return;

 likesTab.classList.add("active");
 commentsTab.classList.remove("active");

 content.innerHTML = dados[id].curtidas.map(p=>`
  <div class="person">
   <div class="person-left">
    <div class="mini">${p[0]}</div>
    <div>
     <h4>${p[1]}</h4>
     <p>${p[2]}</p>
    </div>
   </div>
   <a href="/perfil">Ver</a>
  </div>
 `).join("");

 likesTab.onclick = ()=>renderLikes(id);
 commentsTab.onclick = ()=>renderComments(id);
}

function renderComments(id){
 const content = document.getElementById("sheetContent");
 const likesTab = document.getElementById("likesTab");
 const commentsTab = document.getElementById("commentsTab");

 if(!content) return;

 likesTab.classList.remove("active");
 commentsTab.classList.add("active");

 content.innerHTML = dados[id].comentarios.map(c=>`
  <div class="comment">
   <strong>${c[0]}</strong>
   <p>${c[1]}</p>
  </div>
 `).join("");

 likesTab.onclick = ()=>renderLikes(id);
 commentsTab.onclick = ()=>renderComments(id);
}

function acao(el){
 const action = el.dataset.action;

 if(action === "like"){
  el.classList.toggle("liked");
  el.textContent = el.classList.contains("liked") ? "Curtido" : "Curtir";
  toast(el.classList.contains("liked") ? "Curtida registrada" : "Curtida removida");
 }

 if(action === "save"){
  el.classList.toggle("saved");
  el.textContent = el.classList.contains("saved") ? "Salvo" : "Salvar";
  toast(el.classList.contains("saved") ? "Conteúdo salvo" : "Conteúdo removido");
 }
}

function seguir(el){
 el.textContent = el.textContent.trim() === "Seguir" ? "Seguindo" : "Seguir";
 toast(el.textContent === "Seguindo" ? "Empresa seguida" : "Empresa removida");
}

function handleTap(e){
 const theme = e.target.closest("#themeBtn");
 if(theme){
  e.preventDefault();
  alternarTema();
  return;
 }

 const close = e.target.closest("#closeSheet");
 if(close){
  e.preventDefault();
  fecharSheet();
  return;
 }

 const sheetBtn = e.target.closest("[data-sheet]");
 if(sheetBtn){
  e.preventDefault();
  abrirSheet(sheetBtn.dataset.sheet);
  return;
 }

 const actionBtn = e.target.closest("[data-action]");
 if(actionBtn){
  e.preventDefault();
  acao(actionBtn);
  return;
 }

 const follow = e.target.closest(".follow");
 if(follow){
  e.preventDefault();
  seguir(follow);
  return;
 }
}

document.addEventListener("DOMContentLoaded",()=>{
 inject();
 aplicarTema();

 document.addEventListener("click", handleTap, true);
 document.addEventListener("touchend", handleTap, {passive:false, capture:true});
});