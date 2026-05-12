// public/pedidos.js
// FLUX • Pedidos / Histórico de compras

const API = "";

const FluxPedidos = {
  pedidos: [],
  filtro: "todos",
  busca: "",
  whatsapp: "5517992042563",
  token: localStorage.getItem("token") || ""
};

function $(id){
  return document.getElementById(id);
}

function safe(text){
  return String(text || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function money(v){
  return "R$ " + Number(v || 0).toLocaleString("pt-BR",{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

function compact(v){
  v = Number(v || 0);

  if(v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if(v >= 1000) return (v / 1000).toFixed(1) + "k";

  return String(v);
}

function toast(msg){
  let box = $("toast");

  if(!box){
    box = document.createElement("div");
    box.id = "toast";
    box.className = "toast";
    document.body.appendChild(box);
  }

  box.textContent = msg;
  box.classList.add("show");

  clearTimeout(window.fluxToastTimer);
  window.fluxToastTimer = setTimeout(()=>{
    box.classList.remove("show");
  },1500);
}

function statusText(status){
  const map = {
    pago:"Pago",
    enviado:"Enviado",
    pendente:"Pendente",
    cancelado:"Cancelado",
    entregue:"Entregue"
  };

  return map[String(status || "pendente").toLowerCase()] || "Pendente";
}

function statusClass(status){
  return String(status || "pendente").toLowerCase();
}

function demoPedidos(){
  return [
    {
      id:"FLUX1021",
      status:"pago",
      loja:"Premium Soles",
      entrega:"3 dias",
      rastreio:"",
      total:249.90,
      subtotal:249.90,
      fee:3.99,
      createdAt:new Date().toISOString(),
      items:[
        { name:"Tênis Premium", qty:1, price:249.90 }
      ]
    },
    {
      id:"FLUX8841",
      status:"enviado",
      loja:"Flux Urban",
      entrega:"Em rota",
      rastreio:"BR23991",
      total:189.90,
      subtotal:189.90,
      fee:3.03,
      createdAt:new Date().toISOString(),
      items:[
        { name:"Moletom Streetwear", qty:1, price:189.90 }
      ]
    }
  ];
}

function normalizePedido(o){
  return {
    id:o.id || o._id || "FLUX-" + Date.now(),
    status:o.status || "pendente",
    loja:o.loja || o.empresaNome || "Marketplace Flux",
    entrega:o.entrega || "Aguardando confirmação",
    rastreio:o.rastreio || "",
    total:Number(o.total || 0),
    subtotal:Number(o.subtotal || o.total || 0),
    fee:Number(o.fee || 0),
    createdAt:o.createdAt || new Date().toISOString(),
    items:(o.items || o.produtos || []).map(i=>({
      name:i.name || i.nome || i.produto || "Produto Flux",
      qty:Number(i.qty || i.quantidade || 1),
      price:Number(i.price || i.preco || 0)
    }))
  };
}

function getPedidosLocal(){
  const raw = localStorage.getItem("flux_orders") || "[]";

  try{
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(normalizePedido) : [];
  }catch{
    return [];
  }
}

async function getPedidosApi(){
  if(!FluxPedidos.token) return [];

  try{
    const res = await fetch(API + "/api/pedidos",{
      headers:{
        Authorization:"Bearer " + FluxPedidos.token
      }
    });

    if(!res.ok) return [];

    const data = await res.json();

    if(Array.isArray(data)) return data.map(normalizePedido);
    if(Array.isArray(data.pedidos)) return data.pedidos.map(normalizePedido);

    return [];
  }catch{
    return [];
  }
}

async function carregarPedidos(){
  const list = $("list") || $("pedidosList");

  if(list){
    list.innerHTML = `<div class="empty">Carregando pedidos...</div>`;
  }

  const locais = getPedidosLocal();
  const api = await getPedidosApi();

  const todos = [...api, ...locais];

  const mapa = new Map();

  todos.forEach(p=>{
    mapa.set(String(p.id), p);
  });

  FluxPedidos.pedidos = [...mapa.values()];

  if(!FluxPedidos.pedidos.length){
    FluxPedidos.pedidos = demoPedidos();
  }

  renderPedidos();
}

function firstProduct(order){
  return order.items && order.items.length
    ? order.items[0].name
    : "Pedido Flux";
}

function pedidosFiltrados(){
  const q = FluxPedidos.busca.toLowerCase().trim();
  const f = FluxPedidos.filtro;

  return FluxPedidos.pedidos.filter(order=>{
    const text = [
      order.id,
      order.status,
      order.loja,
      order.entrega,
      order.rastreio,
      ...(order.items || []).map(i=>i.name)
    ].join(" ").toLowerCase();

    const okSearch = text.includes(q);
    const okFilter = f === "todos" || statusClass(order.status) === f;

    return okSearch && okFilter;
  });
}

function updateStats(){
  const pedidos = FluxPedidos.pedidos;

  const total = pedidos.length;
  const pagos = pedidos.filter(o=>statusClass(o.status) === "pago").length;
  const valor = pedidos.reduce((s,o)=>s + Number(o.total || 0),0);

  if($("totalPedidos")) $("totalPedidos").textContent = compact(total);
  if($("pagosPedidos")) $("pagosPedidos").textContent = compact(pagos);
  if($("valorPedidos")) $("valorPedidos").textContent = money(valor);
}

function timelineHTML(status){
  const s = statusClass(status);

  const pago = ["pago","enviado","entregue"].includes(s);
  const enviado = ["enviado","entregue"].includes(s);
  const entregue = s === "entregue";

  return `
    <div class="step ok">
      <div class="dot"></div>
      Pedido criado no Marketplace Flux
    </div>

    <div class="step ${pago ? "ok" : ""}">
      <div class="dot"></div>
      Pagamento confirmado
    </div>

    <div class="step ${enviado ? "ok" : ""}">
      <div class="dot"></div>
      Pedido enviado / em rota
    </div>

    <div class="step ${entregue ? "ok" : ""}">
      <div class="dot"></div>
      Entrega concluída
    </div>
  `;
}

function orderHTML(order){
  return `
    <article class="order">
      <div class="order-top">
        <div class="order-id">#${safe(order.id)}</div>
        <div class="status ${safe(statusClass(order.status))}">
          ${safe(statusText(order.status))}
        </div>
      </div>

      <div class="product">${safe(firstProduct(order))}</div>

      <div class="info">
        Loja: ${safe(order.loja)}<br>
        Entrega: ${safe(order.entrega)}<br>
        ${order.rastreio ? "Código rastreio: " + safe(order.rastreio) : "Rastreio: aguardando"}
      </div>

      <div class="items">
        ${(order.items || []).map(i=>`
          <div class="item">
            <span>${safe(i.name)} x${safe(i.qty)}</span>
            <strong>${money(Number(i.price || 0) * Number(i.qty || 1))}</strong>
          </div>
        `).join("")}
      </div>

      <div class="value">${money(order.total)}</div>

      <div class="actions">
        <button class="btn" onclick="toggleTimeline('${safe(order.id)}')">
          Acompanhar pedido
        </button>

        <button class="btn green" onclick="whatsPedido('${safe(order.id)}')">
          WhatsApp
        </button>
      </div>

      <div class="timeline" id="tl-${safe(order.id)}">
        ${timelineHTML(order.status)}
      </div>
    </article>
  `;
}

function renderPedidos(){
  const list = $("list") || $("pedidosList");

  if(!list) return;

  updateStats();

  const data = pedidosFiltrados();

  if(!data.length){
    list.innerHTML = `
      <div class="empty">
        Nenhum pedido encontrado.
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(orderHTML).join("");
}

function toggleTimeline(id){
  const el = $("tl-" + id);

  if(!el) return;

  el.classList.toggle("show");
}

function whatsPedido(id){
  const order = FluxPedidos.pedidos.find(o=>String(o.id) === String(id));

  if(!order) return;

  const itens = order.items.map(i=>{
    return `• ${i.name} x${i.qty} - ${money(Number(i.price || 0) * Number(i.qty || 1))}`;
  }).join("%0A");

  const msg =
    `Olá! Quero acompanhar meu pedido na Flux.%0A%0A` +
    `Pedido: ${order.id}%0A` +
    `Status: ${statusText(order.status)}%0A` +
    `Loja: ${order.loja}%0A` +
    `${itens}%0A%0A` +
    `Total: ${money(order.total)}`;

  location.href = `https://wa.me/${FluxPedidos.whatsapp}?text=${msg}`;
}

function salvarPedido(order){
  const pedidos = getPedidosLocal();

  pedidos.unshift(normalizePedido(order));

  localStorage.setItem("flux_orders", JSON.stringify(pedidos));
}

function criarPedidoDoCarrinho(){
  const cart = JSON.parse(localStorage.getItem("flux_cart") || "[]");

  if(!cart.length){
    toast("Carrinho vazio.");
    return;
  }

  const subtotal = cart.reduce((s,i)=>{
    return s + Number(i.price || 0) * Number(i.qty || 1);
  },0);

  const fee = subtotal * 0.016;
  const total = subtotal + fee;

  const order = {
    id:"FLUX-" + Date.now(),
    status:"pendente",
    loja:"Marketplace Flux",
    entrega:"Aguardando confirmação",
    rastreio:"",
    items:cart.map(i=>({
      name:i.nome || i.name || i.descricao || "Produto Flux",
      qty:i.qty || 1,
      price:i.price || 0
    })),
    subtotal,
    fee,
    total,
    createdAt:new Date().toISOString()
  };

  salvarPedido(order);

  localStorage.setItem("flux_last_order", JSON.stringify(order));
  localStorage.removeItem("flux_cart");

  toast("Pedido criado.");

  setTimeout(()=>{
    location.href = "/pedidos";
  },700);
}

function limparPedidosLocais(){
  if(!confirm("Limpar pedidos salvos neste dispositivo?")) return;

  localStorage.removeItem("flux_orders");
  localStorage.removeItem("flux_last_order");

  FluxPedidos.pedidos = demoPedidos();

  renderPedidos();

  toast("Pedidos locais limpos.");
}

function bindPedidos(){
  const search = $("search") || $("buscarPedido");
  const filter = $("filter") || $("statusPedido");

  if(search){
    search.addEventListener("input",()=>{
      FluxPedidos.busca = search.value;
      renderPedidos();
    });
  }

  if(filter){
    filter.addEventListener("change",()=>{
      FluxPedidos.filtro = filter.value;
      renderPedidos();
    });
  }
}

function startPedidosSocket(){
  try{
    const socket = io();

    socket.on("pedido_update",pedido=>{
      const novo = normalizePedido(pedido);

      const index = FluxPedidos.pedidos.findIndex(p=>String(p.id) === String(novo.id));

      if(index >= 0){
        FluxPedidos.pedidos[index] = novo;
      }else{
        FluxPedidos.pedidos.unshift(novo);
      }

      renderPedidos();
      toast("Pedido atualizado.");
    });

    socket.on("novo_pedido",pedido=>{
      FluxPedidos.pedidos.unshift(normalizePedido(pedido));
      renderPedidos();
      toast("Novo pedido recebido.");
    });

  }catch{}
}

document.addEventListener("DOMContentLoaded",()=>{
  bindPedidos();
  carregarPedidos();
  startPedidosSocket();
});