// public/clientes.js
// FLUX • Sistema de Clientes

const API = "";

function $(id){
  return document.getElementById(id);
}

function toast(msg){
  alert(msg);
}

function getToken(){
  return localStorage.getItem("cliente_token") || localStorage.getItem("token") || "";
}

function setToken(token){
  localStorage.setItem("cliente_token", token);
  localStorage.setItem("token", token);
}

function logoutCliente(){
  localStorage.removeItem("cliente_token");
  localStorage.removeItem("token");
  localStorage.removeItem("cliente_flux");
  location.href = "/login";
}

async function cadastrarCliente(){
  const nome = $("nome")?.value.trim();
  const email = $("email")?.value.trim().toLowerCase();
  const senha = $("senha")?.value.trim();
  const telefone = $("telefone")?.value.trim() || "";
  const interesses = JSON.parse(localStorage.getItem("flux_interesses") || "[]");

  if(!nome || !email || !senha){
    toast("Preencha nome, e-mail e senha.");
    return;
  }

  try{
    const res = await fetch(API + "/api/clientes/cadastro",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        nome,
        email,
        senha,
        telefone,
        interesses,
        tipo:"cliente"
      })
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      toast(data.erro || data.mensagem || "Erro ao cadastrar cliente.");
      return;
    }

    if(data.token) setToken(data.token);

    localStorage.setItem("cliente_flux", JSON.stringify(data.cliente || {
      nome,
      email,
      telefone,
      interesses
    }));

    toast("Cadastro realizado com sucesso!");
    location.href = "/interesses";

  }catch(err){
    console.log(err);
    toast("Erro de conexão no cadastro.");
  }
}

async function loginCliente(){
  const email = $("email")?.value.trim().toLowerCase();
  const senha = $("senha")?.value.trim();

  if(!email || !senha){
    toast("Digite e-mail e senha.");
    return;
  }

  try{
    const res = await fetch(API + "/api/clientes/login",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ email, senha })
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      toast(data.erro || data.mensagem || "Login inválido.");
      return;
    }

    setToken(data.token);

    localStorage.setItem("cliente_flux", JSON.stringify(data.cliente || {
      email
    }));

    toast("Login realizado!");
    location.href = "/feed";

  }catch(err){
    console.log(err);
    toast("Erro de conexão no login.");
  }
}

async function carregarCliente(){
  const token = getToken();

  if(!token){
    location.href = "/login";
    return null;
  }

  try{
    const res = await fetch(API + "/api/clientes/me",{
      headers:{
        Authorization:"Bearer " + token
      }
    });

    const data = await res.json();

    if(!res.ok || !data.ok){
      logoutCliente();
      return null;
    }

    localStorage.setItem("cliente_flux", JSON.stringify(data.cliente));

    return data.cliente;

  }catch(err){
    console.log(err);
    return null;
  }
}

function protegerCliente(){
  const token = getToken();

  if(!token){
    location.href = "/login";
  }
}

function preencherClienteNaTela(){
  const raw = localStorage.getItem("cliente_flux");

  if(!raw) return;

  const cliente = JSON.parse(raw);

  if($("clienteNome")) $("clienteNome").textContent = cliente.nome || "Cliente Flux";
  if($("clienteEmail")) $("clienteEmail").textContent = cliente.email || "";
}

function salvarInteressesCliente(){
  const token = getToken();
  const interesses = JSON.parse(localStorage.getItem("flux_interesses") || "[]");

  if(!token){
    location.href = "/login";
    return;
  }

  fetch(API + "/api/clientes/interesses",{
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer " + token
    },
    body:JSON.stringify({ interesses })
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.ok){
      toast("Interesses salvos!");
      location.href = "/feed";
    }else{
      toast("Erro ao salvar interesses.");
    }
  })
  .catch(()=>{
    toast("Erro de conexão.");
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  preencherClienteNaTela();
});