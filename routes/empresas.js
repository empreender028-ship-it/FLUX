// public/empresa.js
// FLUX • Sistema de Empresas

const API = "";

function $(id){
  return document.getElementById(id);
}

function toast(msg){
  alert(msg);
}

function getEmpresaToken(){
  return localStorage.getItem("empresa_token") || localStorage.getItem("token") || "";
}

function setEmpresaToken(token){
  localStorage.setItem("empresa_token", token);
  localStorage.setItem("token", token);
}

function logoutEmpresa(){
  localStorage.removeItem("empresa_token");
  localStorage.removeItem("token");
  localStorage.removeItem("empresa_flux");
  localStorage.removeItem("plano_flux");
  location.href = "/login";
}

async function cadastrarEmpresa(){
  const nome = $("nome")?.value.trim();
  const responsavel = $("responsavel")?.value.trim();
  const email = $("email")?.value.trim().toLowerCase();
  const senha = $("senha")?.value.trim();
  const telefone = $("telefone")?.value.trim() || "";
  const whatsapp = $("whatsapp")?.value.trim() || telefone;
  const segmento = $("segmento")?.value.trim() || "";
  const cidade = $("cidade")?.value.trim() || "";
  const site = $("site")?.value.trim() || "";
  const bio = $("bio")?.value.trim() || "";

  if(!nome || !email || !senha){
    toast("Preencha nome da empresa, e-mail e senha.");
    return;
  }

  try{
    const res = await fetch(API + "/empresa/cadastro",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        nome,
        responsavel,
        email,
        senha,
        telefone,
        whatsapp,
        segmento,
        cidade,
        site,
        bio,
        tipo:"empresa",
        plano:"Start",
        premium:false
      })
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      toast(data.erro || data.mensagem || "Erro ao cadastrar empresa.");
      return;
    }

    if(data.token) setEmpresaToken(data.token);

    localStorage.setItem("empresa_flux", JSON.stringify(data.empresa || {
      nome,
      responsavel,
      email,
      telefone,
      whatsapp,
      segmento,
      cidade,
      site,
      bio,
      plano:"Start"
    }));

    localStorage.setItem("plano_flux", data.empresa?.plano || "Start");

    toast("Empresa cadastrada com sucesso!");
    location.href = "/painel";

  }catch(err){
    console.log(err);
    toast("Erro de conexão no cadastro da empresa.");
  }
}

async function loginEmpresa(){
  const email = $("email")?.value.trim().toLowerCase();
  const senha = $("senha")?.value.trim();

  if(!email || !senha){
    toast("Digite e-mail e senha.");
    return;
  }

  try{
    const res = await fetch(API + "/empresa/login",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ email, senha })
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      toast(data.erro || data.mensagem || "Login inválido.");
      return;
    }

    setEmpresaToken(data.token);

    localStorage.setItem("empresa_flux", JSON.stringify(data.empresa || { email }));
    localStorage.setItem("plano_flux", data.empresa?.plano || "Start");

    toast("Login realizado!");
    location.href = "/painel";

  }catch(err){
    console.log(err);
    toast("Erro de conexão no login.");
  }
}

async function carregarEmpresa(){
  const token = getEmpresaToken();

  if(!token){
    location.href = "/login";
    return null;
  }

  try{
    const res = await fetch(API + "/api/me",{
      headers:{ Authorization:"Bearer " + token }
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      logoutEmpresa();
      return null;
    }

    const empresa = data.empresa;

    localStorage.setItem("empresa_flux", JSON.stringify(empresa));
    localStorage.setItem("plano_flux", empresa.plano || "Start");

    return empresa;

  }catch(err){
    console.log(err);
    return null;
  }
}

function protegerEmpresa(){
  const token = getEmpresaToken();

  if(!token){
    location.href = "/login";
  }
}

function preencherEmpresaNaTela(){
  const raw = localStorage.getItem("empresa_flux");

  if(!raw) return;

  const empresa = JSON.parse(raw);

  if($("empresaNome")) $("empresaNome").textContent = empresa.nome || "Empresa Flux";
  if($("empresaEmail")) $("empresaEmail").textContent = empresa.email || "";
  if($("empresaPlano")) $("empresaPlano").textContent = empresa.plano || "Start";
  if($("empresaSegmento")) $("empresaSegmento").textContent = empresa.segmento || "";
  if($("empresaBio")) $("empresaBio").textContent = empresa.bio || "";
}

async function salvarPerfilEmpresa(){
  const token = getEmpresaToken();

  if(!token){
    location.href = "/login";
    return;
  }

  const payload = {
    nome:$("nome")?.value.trim() || "",
    responsavel:$("responsavel")?.value.trim() || "",
    telefone:$("telefone")?.value.trim() || "",
    whatsapp:$("whatsapp")?.value.trim() || "",
    segmento:$("segmento")?.value.trim() || "",
    cidade:$("cidade")?.value.trim() || "",
    bio:$("bio")?.value.trim() || "",
    site:$("site")?.value.trim() || "",
    avatar:$("avatar")?.value.trim() || "",
    logo:$("avatar")?.value.trim() || "",
    capa:$("capa")?.value.trim() || ""
  };

  try{
    const res = await fetch(API + "/api/me",{
      method:"PUT",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer " + token
      },
      body:JSON.stringify(payload)
    });

    const data = await res.json();

    if(data.ok){
      localStorage.setItem("empresa_flux", JSON.stringify(data.empresa));
      toast("Perfil salvo com sucesso!");
      location.href = "/empresa.html";
    }else{
      toast("Erro ao salvar perfil.");
    }

  }catch(err){
    console.log(err);
    toast("Erro de conexão.");
  }
}

async function carregarPerfilParaEditar(){
  const empresa = await carregarEmpresa();

  if(!empresa) return;

  if($("nome")) $("nome").value = empresa.nome || "";
  if($("responsavel")) $("responsavel").value = empresa.responsavel || "";
  if($("telefone")) $("telefone").value = empresa.telefone || "";
  if($("whatsapp")) $("whatsapp").value = empresa.whatsapp || "";
  if($("segmento")) $("segmento").value = empresa.segmento || "";
  if($("cidade")) $("cidade").value = empresa.cidade || "";
  if($("bio")) $("bio").value = empresa.bio || "";
  if($("site")) $("site").value = empresa.site || "";
  if($("avatar")) $("avatar").value = empresa.avatar || empresa.logo || "";
  if($("capa")) $("capa").value = empresa.capa || "";
}

async function escolherPlanoEmpresa(plano, valor){
  const token = getEmpresaToken();

  localStorage.setItem("plano_flux", plano);
  localStorage.setItem("valor_plano_flux", String(valor || 0));

  if(plano === "Start"){
    toast("Plano Start ativado.");
    location.href = "/painel";
    return;
  }

  if(!token){
    toast("Faça login para assinar.");
    location.href = "/login";
    return;
  }

  try{
    const res = await fetch(API + "/api/stripe/checkout",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer " + token
      },
      body:JSON.stringify({ plano })
    });

    const data = await res.json();

    if(data.ok && data.url){
      location.href = data.url;
      return;
    }

    toast(data.erro || "Erro ao abrir checkout.");

  }catch(err){
    console.log(err);
    toast("Erro ao conectar com pagamento.");
  }
}

function planoAtual(){
  return localStorage.getItem("plano_flux") || "Start";
}

function temPlano(...planosPermitidos){
  const plano = planoAtual().toLowerCase();

  return planosPermitidos
    .map(p => String(p).toLowerCase())
    .includes(plano);
}

function bloquearPorPlano(recurso){
  const plano = planoAtual();

  const regras = {
    analytics:["Pro","Avançado","Premium"],
    ia:["Pro","Avançado","Premium"],
    destaque:["Avançado","Premium"],
    premium:["Premium"],
    marketplace:["Basic","Pro","Avançado","Premium"],
    postsIlimitados:["Basic","Pro","Avançado","Premium"]
  };

  const permitidos = regras[recurso] || [];

  if(!permitidos.includes(plano)){
    toast("Esse recurso precisa de upgrade de plano.");
    location.href = "/planos";
    return false;
  }

  return true;
}

async function publicarEmpresa(){
  const token = getEmpresaToken();

  if(!token){
    location.href = "/login";
    return;
  }

  const media = $("media")?.files?.[0] || $("file")?.files?.[0];
  const descricao = $("descricao")?.value.trim() || $("desc")?.value.trim() || "";
  const link = $("link")?.value.trim() || "";
  const tipo = $("tipo")?.value || document.querySelector(".pill.active")?.dataset.type || "feed";

  if(!media){
    toast("Escolha uma imagem ou vídeo.");
    return;
  }

  if(!descricao){
    toast("Escreva uma legenda.");
    return;
  }

  const form = new FormData();

  form.append("media", media);
  form.append("descricao", descricao);
  form.append("link", link);
  form.append("tipo", tipo);

  try{
    const res = await fetch(API + "/postar",{
      method:"POST",
      headers:{ Authorization:"Bearer " + token },
      body:form
    });

    const data = await res.json();

    if(data.ok){
      toast("Publicado com sucesso!");
      location.href = tipo === "fluxo" ? "/fluxo" : "/feed";
    }else{
      toast(data.erro || data.mensagem || "Erro ao publicar.");
    }

  }catch(err){
    console.log(err);
    toast("Erro de conexão ao publicar.");
  }
}

async function carregarPostsEmpresa(){
  const token = getEmpresaToken();

  if(!token) return [];

  try{
    const res = await fetch(API + "/api/me/posts",{
      headers:{ Authorization:"Bearer " + token }
    });

    if(!res.ok) return [];

    return await res.json();

  }catch(err){
    console.log(err);
    return [];
  }
}

async function apagarPostEmpresa(id){
  const token = getEmpresaToken();

  if(!token){
    location.href = "/login";
    return;
  }

  if(!confirm("Excluir este post?")) return;

  try{
    const res = await fetch(API + "/api/posts/" + id,{
      method:"DELETE",
      headers:{ Authorization:"Bearer " + token }
    });

    const data = await res.json();

    if(data.ok){
      toast("Post excluído.");
      location.reload();
    }else{
      toast("Erro ao excluir.");
    }

  }catch(err){
    console.log(err);
    toast("Erro de conexão.");
  }
}

async function impulsionarPostEmpresa(id){
  const token = getEmpresaToken();

  if(!bloquearPorPlano("destaque")) return;

  try{
    const res = await fetch(API + "/api/boost/" + id,{
      method:"POST",
      headers:{ Authorization:"Bearer " + token }
    });

    const data = await res.json();

    if(data.ok){
      toast("Post impulsionado.");
    }else{
      toast("Erro ao impulsionar.");
    }

  }catch(err){
    console.log(err);
    toast("Erro de conexão.");
  }
}

async function recuperarSenhaEmpresa(){
  const email = $("email")?.value.trim().toLowerCase();

  if(!email){
    toast("Digite seu e-mail.");
    return;
  }

  try{
    await fetch(API + "/empresa/recuperar",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ email })
    });

    toast("Se o e-mail existir, enviaremos instruções.");

  }catch{
    toast("Solicitação registrada.");
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  preencherEmpresaNaTela();
});

