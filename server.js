 
 
require("dotenv").config();
 
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const compression = require("compression");
const validator = require("validator");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const { MercadoPagoConfig, Preference } = require("mercadopago");
 
const mpClient = new MercadoPagoConfig({
 accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ""
});
 
const mpPreference = new Preference(mpClient);
const nodemailer = require("nodemailer");
const { Server } = require("socket.io");
 
const app = express();


app.get("/api/ml/debug-expandir", async (req,res)=>{
  try{
    const url = String(req.query.url || "");
    const r = await fetch(url,{
      method:"GET",
      redirect:"follow",
      headers:{
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":"Mozilla/5.0 FluxDebug/1.0"
      }
    });

    const html = await r.text();

    return res.json({
      ok:true,
      status:r.status,
      finalUrl:r.url,
      temMLB:/MLB-?\d+/i.test(r.url + " " + html),
      match:(r.url + " " + html).match(/MLB-?\d+/i)?.[0] || "",
      wid:(r.url + " " + html).match(/[?&]wid=(MLB\d+)/i)?.[1] || "",
      trecho:html.slice(0,800)
    });
  }catch(e){
    return res.status(500).json({ok:false,erro:String(e.message || e)});
  }
});



app.get("/api/ml/produto/:mlId", async (req,res)=>{
  try{
    const mlId = String(req.params.mlId || "").trim();

    const headers = {};
    if(process.env.ML_ACCESS_TOKEN){
      headers.Authorization = "Bearer " + process.env.ML_ACCESS_TOKEN;
    }

    const r = await fetch("https://api.mercadolibre.com/items/" + mlId,{headers});
    const item = await r.json();

    if(!r.ok){
      return res.status(r.status).json({ok:false,erro:"ml_item_error",item});
    }

    let desc = "";
    try{
      const dr = await fetch("https://api.mercadolibre.com/items/" + mlId + "/description",{headers});
      const dj = await dr.json();
      desc = dj.plain_text || "";
    }catch(e){}

    return res.json({
      ok:true,
      produto:{
        id:item.id,
        titulo:item.title,
        preco:item.price,
        moeda:item.currency_id,
        estoque:item.available_quantity,
        vendido:item.sold_quantity,
        thumbnail:item.thumbnail,
        imagens:(item.pictures || []).map(p=>p.secure_url || p.url),
        video:item.video_id || "",
        sellerId:item.seller_id,
        categoria:item.category_id,
        permalink:item.permalink,
        descricao:desc
      }
    });
  }catch(e){
    console.log("ml produto:",e);
    return res.status(500).json({ok:false,erro:"ml_produto_error",detalhe:String(e.message || e)});
  }
});


app.set("trust proxy", 1);
 
app.get("/versao-flux",(req,res)=>{
return res.json({
ok:true,
commit:"server-revisado-seguro",
rota_ml:true,
hora:new Date().toISOString()
});
});
 
 
//* MERCADO LIVRE PUBLICO TOPO */
app.get("/ml-buscar", async (req,res)=>{
  try{
    const q = String(req.query.q || "vestido feminino").trim();
 
    const url =
      "https://api.mercadolibre.com/sites/MLB/search?q=" +
      encodeURIComponent(q) +
      "&limit=50&sort=sold_quantity_desc";
 
    const r = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "FluxApp/1.0 beta123soares@gmail.com"
      }
    });
 
    const data = await r.json();
 
    if (!r.ok) {
      return res.status(r.status).json({
        ok:false,
        status:r.status,
        erro:"mercado_livre_bloqueou",
        detalhe:data
      });
    }
 
    const produtos = (Array.isArray(data.results) ? data.results : []).map(p=>({
      mlId:p.id,
      titulo:p.title,
      preco:p.price,
      imagem:p.thumbnail,
      link:p.permalink,
      vendedor:p.seller || {},
      linkFlux:"/go-public/ml/" + p.id,
      fonte:"Mercado Livre"
    }));
 
    return res.json({
      ok:true,
      busca:q,
      total:produtos.length,
      produtos
    });
 
  }catch(err){
    return res.status(500).json({
      ok:false,
      erro:err.message
    });
  }
});
 
 
/* MERCADO LIVRE OFICIAL FLUX */
app.get("/conectar-ml",(req,res)=>{
const clientId = process.env.ML_CLIENT_ID;
const redirectUri = process.env.ML_REDIRECT_URI || "https://flux-beta-production.up.railway.app/ml-callback";
 
if(!clientId){
return res.status(500).send("ML_CLIENT_ID_FALTANDO");
}
 
const url =
"https://auth.mercadolivre.com.br/authorization" +
"?response_type=code" +
"&client_id=" + clientId +
"&redirect_uri=" + encodeURIComponent(redirectUri);
 
return res.redirect(url);
});
 
app.get("/ml-callback", async (req,res)=>{
try{
const code = req.query.code;
 
if(!code){
return res.status(400).send("Cï¿½digo Mercado Livre ausente");
}
 
const response = await fetch("https://api.mercadolibre.com/oauth/token",{
method:"POST",
headers:{ "Content-Type":"application/x-www-form-urlencoded" },
body:new URLSearchParams({
grant_type:"authorization_code",
client_id:process.env.ML_CLIENT_ID,
client_secret:process.env.ML_CLIENT_SECRET,
code,
redirect_uri:process.env.ML_REDIRECT_URI
})
});
 
const data = await response.json();
 
if(!response.ok){
console.log("ML TOKEN ERRO:", data);
return res.status(400).json(data);
}
 
console.log("ML CONECTADO:", data.user_id);
 
await MLIntegration.findOneAndUpdate(
{ userId:String(data.user_id) },
{
userId:String(data.user_id),
accessToken:data.access_token,
refreshToken:data.refresh_token,
expiresIn:data.expires_in,
tokenType:data.token_type,
ativo:true
},
{ upsert:true, new:true }
);
 
return res.send("Mercado Livre conectado com sucesso na Flux. User ID: " + data.user_id);
 
}catch(err){
console.log("ERRO ML CALLBACK:",err);
return res.status(500).send("Erro ao conectar Mercado Livre");
}
});
 

/* IMPORTAR Meli.la AUTOMATICO - AFILIADOS ML */
app.post("/api/ml/afiliados/importar-meli-auto", async (req,res)=>{
  try{
    const crypto = require("crypto");
    const body = req.body || {};
    const links = Array.isArray(body.links) ? body.links : [];

    if(!links.length){
      return res.status(400).json({ok:false,erro:"envie_links"});
    }

    async function expandirLink(url){
      let atual = String(url || "").trim();

      for(let i=0;i<8;i++){
        const r = await fetch(atual,{
          method:"GET",
          redirect:"manual",
          headers:{
            "User-Agent":"Mozilla/5.0 FluxBot Afiliados",
            "Accept":"text/html,application/xhtml+xml"
          }
        });

        const loc = r.headers.get("location");

        if(loc){
          atual = loc.startsWith("http") ? loc : new URL(loc, atual).href;
          continue;
        }

        const html = await r.text().catch(()=> "");
        return {url:atual, html};
      }

      return {url:atual, html:""};
    }

    function extrairMLB(texto){
      const s = String(texto || "");
      const m =
        s.match(/MLB-?(\d{6,})/i) ||
        s.match(/"item_id"\s*:\s*"MLB(\d{6,})"/i) ||
        s.match(/\/MLB(\d{6,})/i);

      return m ? "MLB" + m[1] : "";
    }

    function extrairMeta(html, prop){
      const re1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i");
      const m = html.match(re1) || html.match(re2);
      return m ? m[1] : "";
    }

    const importados = [];
    const ignorados = [];

    for(const linkAfiliado of links.slice(0,50)){
      try{
        const expandido = await expandirLink(linkAfiliado);
        const textoBusca = expandido.url + "\n" + expandido.html;
        const mlId = extrairMLB(textoBusca);

        let produtoML = null;

        if(mlId){
          const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1}).catch(()=>null);
          const headers = ml?.accessToken
            ? {Authorization:"Bearer " + ml.accessToken, Accept:"application/json"}
            : {Accept:"application/json"};

          const itemRes = await fetch("https://api.mercadolibre.com/items/" + mlId,{headers});
          const itemJson = await itemRes.json().catch(()=>null);

          if(itemRes.ok && itemJson && !itemJson.error){
            produtoML = itemJson;
          }
        }

        const titulo =
          produtoML?.title ||
          extrairMeta(expandido.html, "og:title") ||
          "Produto Mercado Livre";

        const imagem =
          produtoML?.thumbnail ||
          extrairMeta(expandido.html, "og:image") ||
          "";

         let precoTexto =
         expandido.html.match(/R\$\s*[\d\.\,]+/)?.[0] ||
         expandido.html.match(/"price"\s*:\s*"?([\d\.]+)"?/)?.[1] ||
         expandido.html.match(/"amount"\s*:\s*"?([\d\.]+)"?/)?.[1] ||
         expandido.html.match(/"value"\s*:\s*"?([\d\.]+)"?/)?.[1] ||
         "";

         let precoLimpo = String(precoTexto)
         .replace("R$","")
         .replace(/\s/g,"")
         .replace(/\./g,"")
    
          let preco = Number(produtoML?.price || precoLimpo || 0);

         if (!preco || Number.isNaN(preco)) {
          preco = 0;
         }

        const sellerId =
          String(produtoML?.seller_id || "afiliado");

        const sku =
          mlId || "MLI-" + crypto.createHash("md5").update(linkAfiliado).digest("hex").slice(0,12);

        const empresaEmail = `ml-${sellerId}@flux-afiliado.local`;
        const nomePerfil = sellerId === "afiliado" ? "Mercado Livre Afiliados" : `Loja ML ${sellerId}`;

        const perfil = await Empresa.findOneAndUpdate(
          {email:empresaEmail},
          {
            nome:nomePerfil,
            responsavel:"Mercado Livre Afiliado",
            email:empresaEmail,
            segmento:"Afiliado Mercado Livre",
            tipoConta:"empresa",
            plano:"Start",
            assinaturaStatus:"gratis",
            ativo:true,
            marketplaceAtivo:true,
            bio:"Perfil afiliado automï¿½tico com produto real do Mercado Livre.",
            site:linkAfiliado,
            logo:imagem,
            avatar:imagem,
            ultimaAtividade:new Date()
          },
          {upsert:true,new:true,setDefaultsOnInsert:true}
        );

        const produto = await Produto.findOneAndUpdate(
          {sku},
          {
            empresaId:String(perfil._id),
            empresaNome:perfil.nome,
            nome:titulo,
            descricao:titulo,
            preco:preco,
            estoque:Number(produtoML?.available_quantity || 1),
            sku,
            categoria:produtoML?.category_id || "Mercado Livre Afiliado",
            imagem,
            link:linkAfiliado,
            ativo:true,
            destaque:true
          },
          {upsert:true,new:true,setDefaultsOnInsert:true}
        );

        await Post.findOneAndUpdate(
          {empresaId:String(perfil._id), link:linkAfiliado, tipo:"feed"},
          {
            empresaId:String(perfil._id),
            empresaNome:perfil.nome,
            empresaEmail:perfil.email,
            media:imagem,
            descricao:preco ? `${titulo} por R$ ${preco}` : titulo,
            link:linkAfiliado,
            tipo:"feed",
            status:"aprovada"
          },
          {upsert:true,new:true,setDefaultsOnInsert:true}
        );

        importados.push({
          perfil:perfil.nome,
          produto:produto.nome,
          preco:produto.preco,
          sku,
          mlId,
          linkAfiliado,
          linkExpandido:expandido.url
        });

      }catch(e){
        ignorados.push({link:linkAfiliado,motivo:e.message});
      }
    }

    return res.json({
      ok:true,
      total:importados.length,
      ignorados:ignorados.length,
      mensagem:"Links meli.la importados automaticamente.",
      importados,
      detalhesIgnorados:ignorados
    });

  }catch(err){
    return res.status(500).json({ok:false,erro:err.message});
  }
});

const server = http.createServer(app);
 
const corsOptions = {
origin: (origin, callback) => {
if (!origin) return callback(null, true);
if (!IS_PRODUCTION) return callback(null, true);
if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
return callback(new Error("cors_bloqueado"));
},
credentials: true
};
 
const io = new Server(server,{
cors: corsOptions,
maxHttpBufferSize: 1e6
});
 
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "flux-dev-secret-local");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? "" : "1234");
const BASE_URL = process.env.BASE_URL || (IS_PRODUCTION ? "" : "http://localhost:3000");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || BASE_URL || "")
.split(",")
.map(origin => origin.trim())
.filter(Boolean);
const PRICE_IDS = {
Basic:
"price_1TCKeVJkqqOHdzIKsHKn3cc3",
Pro:
"price_1TCKfoJkqqOHdzIKXmr2BE73",
Avancado:
"price_1TCKggJkqqOHdzIKusyC8d3",
Premium:
"price_1TCKhPJkqqOHdzIKZHD1n0Ov"
};
const PLAN_VALUES = {
Start: 0,
Basic: 79.90,
Pro: 149.90,
Avancado: 199.90,
Premium: 249.90
};
const PLAN_LABELS = {
Start: "Start",
Basic: "Bï¿½sico",
Pro: "Intermediï¿½rio",
Avancado: "Avanï¿½ado",
Premium: "Premium"
};
const users = new Set();
 
if (IS_PRODUCTION) {
const missingEnv = [];
if (!MONGO_URI) missingEnv.push("MONGO_URI");
if (!JWT_SECRET || JWT_SECRET.length < 32) missingEnv.push("JWT_SECRET_FORTE");
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 24) missingEnv.push("ADMIN_PASSWORD_FORTE");
if (!BASE_URL || BASE_URL.includes("localhost")) missingEnv.push("BASE_URL_PRODUCAO");
if (missingEnv.length) {
console.error("Variï¿½veis de produï¿½ï¿½o invï¿½lidas:", missingEnv.join(", "));
process.exit(1);
}
}
/* WEBHOOK STRIPE â€” TEM QUE VIR ANTES DO express.json */
app.post(
"/api/stripe/webhook",
express.raw({ type: "application/json" }),
async (req, res) => {
const sig = req.headers["stripe-signature"];
let event;
try {
event = stripe.webhooks.constructEvent(
req.body,
sig,
process.env.STRIPE_WEBHOOK_SECRET
);
} catch (err) {
console.log("Webhook invï¿½lido:", err.message);
return res.status(400).send(`Webhook Error: ${err.message}`);
}
try {
if (event.type === "checkout.session.completed") {
const session = event.data.object;
const empresaId = session.metadata?.empresaId;
const plano = session.metadata?.plano;
if (empresaId && plano) {
const empresa = await Empresa.findByIdAndUpdate(
empresaId,
{
plano,
ativo: true,
assinaturaStatus: "ativo",
receita: PLAN_VALUES[plano] || 0,
stripeCustomerId: session.customer,
stripeSubscriptionId: session.subscription,
ultimaAtividade: new Date()
},
{ new: true }
);
await Pagamento.create({
empresaId,
empresa: empresa?.nome || "Empresa Flux",
email: empresa?.email || session.customer_email || "",
plano,
valor: PLAN_VALUES[plano] || 0,
metodo: "Stripe",
status: "aprovado",
ultimaCobranca: new Date(),
stripeSessionId: session.id,
stripeCustomerId: session.customer,
stripeSubscriptionId: session.subscription
});
console.log(" Assinatura ativada:", plano, empresa?.email);
}
}
if (event.type === "customer.subscription.deleted") {
const subscription = event.data.object;
const empresa = await Empresa.findOneAndUpdate(
{ stripeSubscriptionId: subscription.id },
{
plano: "Start",
assinaturaStatus: "cancelado",
ultimaAtividade: new Date()
},
{ new: true }
);
if (empresa) {
await Pagamento.create({
empresaId: String(empresa._id),
empresa: empresa.nome,
email: empresa.email,
plano: "Start",
valor: 0,
metodo: "Stripe",
status: "recusado",
ultimaCobranca: new Date(),
stripeSubscriptionId: subscription.id
});
console.log("Assinatura cancelada:", empresa.email);
}
}
res.json({ received: true });
} catch (err) {
console.log("Erro webhook:", err);
res.status(500).json({ erro: "webhook_error" });
}
}
);
io.on("connection", socket => {
users.add(socket.id);
io.emit("online", users.size);
socket.on("message:send", msg => {
io.emit("message:receive", msg);
});
socket.on("disconnect", () => {
users.delete(socket.id);
io.emit("online", users.size);
});
});
app.disable("x-powered-by");
 
app.use(helmet({
contentSecurityPolicy: false,
crossOriginResourcePolicy: { policy: "cross-origin" },
referrerPolicy: { policy: "no-referrer" },
hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
}));
 
app.use((req, res, next) => {
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
if (req.path.startsWith("/api/") || req.path.startsWith("/admin/")) {
res.setHeader("Cache-Control", "no-store");
}
if (req.path.includes(".env") || req.path.includes(".git") || req.path.includes("package-lock.json")) {
return res.status(404).json({ erro: "arquivo_bloqueado" });
}
next();
});
 
app.use(compression({
level: 6,
threshold: 1024
}));
 
const generalLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 500,
standardHeaders: true,
legacyHeaders: false,
message: { erro: "muitas_requisicoes" }
});
 
const authLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 30,
standardHeaders: true,
legacyHeaders: false,
message: { erro: "muitas_tentativas_login" }
});
 
const adminLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 12,
standardHeaders: true,
legacyHeaders: false,
message: { erro: "admin_bloqueado_temporariamente" }
});
 
const writeLimiter = rateLimit({
windowMs: 60 * 1000,
max: 40,
standardHeaders: true,
legacyHeaders: false,
message: { erro: "flood_bloqueado" }
});
 
const uploadLimiter = rateLimit({
windowMs: 10 * 60 * 1000,
max: 25,
standardHeaders: true,
legacyHeaders: false,
message: { erro: "limite_upload" }
});
 
app.use(generalLimiter);
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));
/* FLUX PAY PROCESSAR PAGAMENTO - MERCADO PAGO BRICKS */
app.post("/api/mercadopago/processar-pagamento", async (req, res) => {
  try {
    const {
      token,
      issuer_id,
      transaction_amount,
      installments,
      payer,
      plano,
      titulo,
      preco
    } = req.body || {};
 
    const paymentMethodId =
      req.body?.payment_method_id ||
      req.body?.payment_method?.id ||
      req.body?.selected_payment_method ||
      "pix";
 
    const planoNormalizado = String(plano || "Basic")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
 
    const valoresPlano = {
      Start: 0,
      Basic: 39.9,
      Pro: 79.9,
      Avancado: 149.9,
      Premium: 249.9
    };
 
    const valorFinal = Number(
      transaction_amount ||
      preco ||
      valoresPlano[planoNormalizado] ||
      39.9
    );
 
    if (!valorFinal || Number.isNaN(valorFinal) || valorFinal <= 0) {
      return res.status(400).json({
        ok: false,
        status: "rejected",
        status_detail: "invalid_transaction_amount",
        mensagem: "Valor invÃ¡lido para pagamento."
      });
    }
 
    const emailPagador =
      payer?.email ||
      req.body?.email ||
      "pagamento@flux.com";
 
    let empresaId = "";
    let empresaEmail = emailPagador;
 
    try {
      const bearer = req.headers.authorization?.split(" ")[1];
      if (bearer) {
        const decoded = jwt.verify(bearer, JWT_SECRET);
        empresaId = String(decoded.id || "");
        empresaEmail = decoded.email || emailPagador;
      }
    } catch (tokenErr) {
      console.log("Flux Pay sem token vÃ¡lido:", tokenErr.message);
    }
 
    const paymentData = {
      transaction_amount: valorFinal,
      description: titulo || `Flux ${planoNormalizado}`,
      payment_method_id: paymentMethodId,
      payer: {
        email: emailPagador
      },
      metadata: {
        empresaId,
        plano: planoNormalizado,
        origem: "flux_pay_bricks"
      },
      external_reference: empresaId
        ? `flux_${empresaId}_${planoNormalizado}`
        : `flux_${Date.now()}_${planoNormalizado}`
    };
 
    if (token) {
      paymentData.token = token;
    }
 
    if (issuer_id) {
      paymentData.issuer_id = issuer_id;
    }
 
    if (installments) {
      paymentData.installments = Number(installments || 1);
    }
 
    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.MERCADOPAGO_ACCESS_TOKEN,
          "X-Idempotency-Key":
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`
        },
        body: JSON.stringify(paymentData)
      }
    );
 
    const data = await mpResponse.json();
 
    console.log("MP PAYMENT:", data);
 
    const status = data.status || "rejected";
    const statusDetail = data.status_detail || data.message || "Pagamento recusado";
 
    const transactionData =
      data.point_of_interaction?.transaction_data || {};
 
    const respostaBase = {
      mp_payment_id: data.id || "",
      status,
      status_detail: statusDetail,
      plano: planoNormalizado,
      valor: valorFinal,
      qr_code: transactionData.qr_code || "",
      qr_code_base64: transactionData.qr_code_base64 || "",
      ticket_url: transactionData.ticket_url || "",
      mensagem:
        data.message ||
        statusDetail ||
        "Pagamento processado."
    };
 
    if (status === "approved") {
      if (empresaId && typeof Empresa !== "undefined") {
        await Empresa.findByIdAndUpdate(empresaId, {
          plano: planoNormalizado,
          assinaturaStatus: "ativo",
          ativo: true,
          receita: valorFinal,
          ultimaAtividade: new Date()
        });
      }
 
      if (typeof Pagamento !== "undefined") {
        await Pagamento.create({
          empresaId,
          empresa: empresaId || "Empresa Flux",
          email: empresaEmail,
          plano: planoNormalizado,
          valor: valorFinal,
          metodo: paymentMethodId || "Mercado Pago",
          status: "aprovado",
          ultimaCobranca: new Date(),
          mpPaymentId: String(data.id || ""),
          mercadoPagoPaymentId: String(data.id || "")
        });
      }
 
      return res.json({
        ok: true,
        ...respostaBase,
        mensagem: "Pagamento aprovado.",
        redirect: `/obrigada.html?mp=approved&plano=${encodeURIComponent(planoNormalizado)}`
      });
    }
 
    if (["pending", "in_process", "in_mediation"].includes(status)) {
      if (empresaId && typeof Empresa !== "undefined") {
        await Empresa.findByIdAndUpdate(empresaId, {
          plano: planoNormalizado,
          assinaturaStatus: "pendente",
          ultimaAtividade: new Date()
        });
      }
 
      if (typeof Pagamento !== "undefined") {
        await Pagamento.create({
          empresaId,
          empresa: empresaId || "Empresa Flux",
          email: empresaEmail,
          plano: planoNormalizado,
          valor: valorFinal,
          metodo: paymentMethodId || "Mercado Pago",
          status: "pendente",
          ultimaCobranca: new Date(),
          mpPaymentId: String(data.id || ""),
          mercadoPagoPaymentId: String(data.id || "")
        });
      }
 
      return res.json({
        ok: true,
        ...respostaBase,
        mensagem: "Pagamento pendente. Aguarde confirmaÃ§Ã£o.",
        redirect: `/obrigada.html?mp=pending&plano=${encodeURIComponent(planoNormalizado)}`
      });
    }
 
    if (typeof Pagamento !== "undefined") {
      await Pagamento.create({
        empresaId,
        empresa: empresaId || "Empresa Flux",
        email: empresaEmail,
        plano: planoNormalizado,
        valor: valorFinal,
        metodo: paymentMethodId || "Mercado Pago",
        status: "recusado",
        ultimaCobranca: new Date()
      });
    }
 
    return res.status(400).json({
      ok: false,
      ...respostaBase,
      mensagem:
        data.message ||
        statusDetail ||
        "Pagamento recusado. Tente outro cartÃ£o ou PIX."
    });
  } catch (err) {
    console.log("FLUX PAY ERROR:", err);
 
    return res.status(500).json({
      ok: false,
      status: "error",
      mensagem: err.message || "Erro interno no pagamento."
    });
  }
});
 
 
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));
 
function sanitizeObject(obj) {
if (!obj || typeof obj !== "object") return obj;
if (Array.isArray(obj)) return obj.map(sanitizeObject);
for (const key of Object.keys(obj)) {
if (key.startsWith("$") || key.includes(".")) {
delete obj[key];
continue;
}
obj[key] = sanitizeObject(obj[key]);
}
return obj;
}
 
app.use((req, res, next) => {
req.body = sanitizeObject(req.body);
req.query = sanitizeObject(req.query);
req.params = sanitizeObject(req.params);
next();
});
 
app.use(["/login", "/api/login", "/cliente/login", "/empresa/login"], authLimiter);
app.use("/admin/login", adminLimiter);
app.use(["/api/comments", "/api/inbox/send", "/api/pedidos", "/api/produtos"], writeLimiter);
app.use("/postar", uploadLimiter);
function getLocalIP() {
const nets = os.networkInterfaces();
let ip = "localhost";
for (const name of Object.keys(nets)) {
for (const net of nets[name]) {
if (net.family === "IPv4" && !net.internal) ip = net.address;
}
}
return ip;
}

function actorKey(req){
  return String(
    req.user?.id ||
    req.body.userKey ||
    req.headers["x-user-key"] ||
    req.ip ||
    "anon"
  );
}

function actor(req) {
if (req.user?.id) return String(req.user.id);
return String(req.headers["x-forwarded-for"] || req.ip || "anon").split(",")[0].trim();
}
function cleanText(value, max = 1000) {
return validator.escape(String(value || "").trim().slice(0, max));
}
function cleanEmail(value) {
return String(value || "").toLowerCase().trim();
}
function escapeRegex(value) {
return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isValidObjectId(id) {
return mongoose.Types.ObjectId.isValid(String(id || ""));
}
function mediaUrl(media) {
if (!media) return "";
if (String(media).startsWith("http")) return media;
if (String(media).startsWith("/uploads/")) return media;
return "/uploads/" + media;
}
function normalizePost(post) {
const p = typeof post?.toObject === "function" ? post.toObject() : post;
if (!p) return p;
return {
...p,
id: p._id,
mediaUrl: mediaUrl(p.media),
tipoMidia: p.media?.includes("videos/") ? "video" : "imagem"
};
}
if (MONGO_URI) {
mongoose.connect(MONGO_URI, {
serverSelectionTimeoutMS: 30000,
connectTimeoutMS: 30000,
socketTimeoutMS: 45000,
maxPoolSize: 20
})
.then(() => console.log(" Mongo conectado"))
.catch(err => console.log("Mongo erro:", err.message));
} else {
console.log("MONGO_URI nï¿½o definido.");
}
/* MODELS */
const Empresa = mongoose.model("Empresa", new mongoose.Schema({
nome: String,
responsavel: String,
telefone: String,
whatsapp: String,
cidade: String,
segmento: String,
interesses: { type: [String], default: [] },
origemLead: { type: String, default: "" },
email: {
type: String,
unique: true,
lowercase: true,
trim: true
},
senha: String,
tipoConta: {
type: String,
enum: ["usuario", "empresa"],
default: "empresa"
},
plano: {
type: String,
enum: ["Start", "Basic", "Pro", "Avancado", "Premium"],
default: "Start"
},
ativo: { type: Boolean, default: true },
online: { type: Boolean, default: false },
logo: { type: String, default: "" },
avatar: { type: String, default: "" },
receita: { type: Number, default: 0 },
stripeCustomerId: { type: String, default: "" },
stripeSubscriptionId: { type: String, default: "" },
assinaturaStatus: {
type: String,
enum: ["gratis", "pendente", "ativo", "cancelado", "recusado"],
default: "gratis"
},
bio: { type: String, default: "" },
site: { type: String, default: "" },
capa: { type: String, default: "" },
marketplaceAtivo: { type: Boolean, default: true },
estoqueTotal: { type: Number, default: 0 },
vendasTotal: { type: Number, default: 0 },
endereco: {
rua: { type: String, default: "" },
numero: { type: String, default: "" },
bairro: { type: String, default: "" },
cidade: { type: String, default: "" },
estado: { type: String, default: "" },
cep: { type: String, default: "" }
},
ultimaAtividade: { type: Date, default: Date.now }
}, { timestamps: true }));
const Post = mongoose.model("Post", new mongoose.Schema({
empresaId: String,
empresaNome: String,
empresaEmail: String,
media: String,
descricao: String,
link: String,
tipo: {
type: String,
enum: ["feed", "fluxo"],
default: "feed"
},
status: {
type: String,
enum: ["pendente", "aprovada", "denunciada", "removida"],
default: "aprovada"
},
motivoModeracao: { type: String, default: "" },
riscoIA: { type: Number, default: 0 },
likes: { type: Number, default: 0 },
saves: { type: Number, default: 0 },
shares: { type: Number, default: 0 },
views: { type: Number, default: 0 },
likedBy: { type: [String], default: [] },
savedBy: { type: [String], default: [] },
sharedBy: { type: [String], default: [] },
viewedBy: { type: [String], default: [] }
}, { timestamps: true }));
const Comment = mongoose.model("Comment", new mongoose.Schema({
postId: String,
usuarioId: String,
usuarioNome: String,
texto: String
}, { timestamps: true }));
const Pagamento = mongoose.model("Pagamento", new mongoose.Schema({
empresaId: String,
empresa: String,
email: String,
plano: String,
valor: { type: Number, default: 0 },
metodo: { type: String, default: "PIX" },
status: {
type: String,
enum: ["aprovado", "pendente", "recusado"],
default: "pendente"
},
ultimaCobranca: { type: Date, default: Date.now },
stripeSessionId: { type: String, default: "" },
stripeCustomerId: { type: String, default: "" },
stripeSubscriptionId: { type: String, default: "" },
mpPaymentId: { type: String, default: "" },
mercadoPagoPaymentId: { type: String, default: "" }
}, { timestamps: true }));
 
async function pagamentoConfirmadoEmpresa(empresa) {
if (!empresa) return false;
if (String(empresa._id || "") === "demo") return true;
if (empresa.tipoConta === "usuario") return true;
if (!["Basic", "Pro", "Avancado", "Premium"].includes(empresa.plano)) return false;
if (empresa.assinaturaStatus !== "ativo") return false;
const aprovado = await Pagamento.exists({
empresaId: String(empresa._id),
plano: empresa.plano,
status: "aprovado"
});
return Boolean(aprovado);
}
 
async function registrarPagamentoMercadoPago({ empresaId, empresaNome, email, plano, valor, metodo, status, mpPaymentId }) {
const payload = {
empresaId: empresaId || "",
empresa: empresaNome || "Empresa Flux",
email: email || "",
plano: plano || "Basic",
valor: Number(valor || 0),
metodo: metodo || "Mercado Pago",
status: status || "pendente",
ultimaCobranca: new Date(),
mpPaymentId: String(mpPaymentId || ""),
mercadoPagoPaymentId: String(mpPaymentId || "")
};
if (payload.mpPaymentId) {
return Pagamento.findOneAndUpdate(
{ mpPaymentId: payload.mpPaymentId },
payload,
{ upsert: true, new: true, setDefaultsOnInsert: true }
);
}
return Pagamento.create(payload);
}
 
const Lead = mongoose.model("Lead", new mongoose.Schema({
clienteId: String,
nome: String,
email: String,
telefone: String,
whatsapp: String,
cidade: String,
interesses: { type: [String], default: [] },
origem: { type: String, default: "cadastro_cliente" },
status: { type: String, enum: ["novo", "contatado", "convertido"], default: "novo" }
}, { timestamps: true }));
const Produto = mongoose.model("Produto", new mongoose.Schema({
empresaId: String,
empresaNome: String,
nome: String,
descricao: String,
preco: { type: Number, default: 0 },
precoPromocional: { type: Number, default: 0 },
custo: { type: Number, default: 0 },
estoque: { type: Number, default: 0 },
sku: { type: String, default: "" },
categoria: { type: String, default: "geral" },
imagem: { type: String, default: "" },
video: { type: String, default: "" },
imagens: [{ type: String }],
link: { type: String, default: "" },
marketplace: { type: String, default: "flux" },
link: { type: String, default: "" },
tamanhos: { type: [String], default: [] },
cores: { type: [String], default: [] },
vendido: { type: Number, default: 0 },
destaque: { type: Boolean, default: false },
ativo: { type: Boolean, default: true }
}, { timestamps: true }));
const Pedido = mongoose.model("Pedido", new mongoose.Schema({
empresaId: String,
empresaNome: String,
clienteId: { type: String, default: "" },
clienteNome: { type: String, required: true },
clienteEmail: { type: String, required: true },
clienteWhatsapp: { type: String, default: "" },
endereco: {
rua: { type: String, default: "" },
numero: { type: String, default: "" },
bairro: { type: String, default: "" },
cidade: { type: String, default: "" },
estado: { type: String, default: "" },
cep: { type: String, default: "" },
complemento: { type: String, default: "" }
},
produtos: [{
produtoId: String,
nome: String,
preco: Number,
quantidade: Number,
imagem: String,
tamanho: String,
cor: String
}],
subtotal: { type: Number, default: 0 },
frete: { type: Number, default: 0 },
total: { type: Number, required: true },
status: {
type: String,
enum: ["pendente", "pago", "separando", "enviado", "entregue", "cancelado"],
default: "pendente"
},
codigoRastreio: { type: String, default: "" },
etiquetaEnvio: { type: String, default: "" },
pagamento: { type: String, default: "pix" },
pago: { type: Boolean, default: false }
}, { timestamps: true }));
const UserInterest = mongoose.models.UserInterest || mongoose.model("UserInterest", new mongoose.Schema({
  userKey:{type:String,index:true},
  categoria:{type:String,index:true},
  empresaId:{type:String,index:true},
  produtoId:{type:String,index:true},
  peso:{type:Number,default:1},
  updatedAt:{type:Date,default:Date.now}
}));

const Follow = mongoose.model("Follow", new mongoose.Schema({
clienteId: String,
empresaId: String
}, { timestamps: true }));
const Mensagem = mongoose.model("Mensagem", new mongoose.Schema({
fromId: String,
toId: String,
texto: String,
lida: { type: Boolean, default: false }
}, { timestamps: true }));
/* AUTH */
function auth(req, res, next) {
const token = req.headers.authorization?.split(" ")[1];
if (!token) return res.status(401).json({ erro: "sem_token" });
try {
req.user = jwt.verify(token, JWT_SECRET);
next();
} catch {
return res.status(403).json({ erro: "token_invalido" });
}
}
function optionalAuth(req, res, next) {
const token = req.headers.authorization?.split(" ")[1];
if (!token) return next();
try {
req.user = jwt.verify(token, JWT_SECRET);
} catch {}
next();
}
function adminAuth(req, res, next) {
const token = req.headers.authorization?.split(" ")[1] || req.headers.authorization;
if (!token) return res.status(401).json({ erro: "sem_token" });
try {
const decoded = jwt.verify(token, JWT_SECRET);
if (!decoded.admin) {
return res.status(403).json({ erro: "sem_permissao" });
}
req.admin = decoded;
next();
} catch {
return res.status(403).json({ erro: "token_invalido" });
}
}
/* PLANOS E PERMISSï¿½ES */
const PLANOS = {
Visitante: {
postsMes: 0,
podeVerFeed: true,
podeVerFluxo: "limitado",
podeBuscar: "limitado",
podeCurtir: false,
podeComentar: false,
podeSalvar: false,
podeCompartilhar: false,
podeSeguir: false,
podeChat: false,
podePostar: false,
podePainel: false,
analytics: false,
ia: false,
prioridade: false,
leads: false
},
Usuario: {
postsMes: 0,
podeVerFeed: true,
podeVerFluxo: true,
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: false,
podePostar: false,
podePainel: false,
analytics: false,
ia: false,
prioridade: false,
leads: false
},
Start: {
postsMes: 0,
podeVerFeed: true,
podeVerFluxo: "basico",
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: false,
podePostar: false,
podePainel: false,
podeProduto: false,
analytics: false,
ia: false,
prioridade: false,
leads: false
},
Basic: {
postsMes: 50,
podeVerFeed: true,
podeVerFluxo: true,
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: true,
podePostar: true,
podePainel: true,
podeProduto: true,
analytics: "basico",
ia: false,
prioridade: false,
leads: "basico"
},
Pro: {
postsMes: 150,
podeVerFeed: true,
podeVerFluxo: true,
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: true,
podePostar: true,
podePainel: true,
podeProduto: true,
analytics: "avancado",
ia: "basica",
prioridade: "moderada",
leads: "pro"
},
Avancado: {
postsMes: 500,
podeVerFeed: true,
podeVerFluxo: true,
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: true,
podePostar: true,
podePainel: true,
podeProduto: true,
analytics: "executivo",
ia: "avancada",
prioridade: "alta",
leads: "avancado"
},
Premium: {
postsMes: Infinity,
podeVerFeed: true,
podeVerFluxo: true,
podeBuscar: true,
podeCurtir: true,
podeComentar: true,
podeSalvar: true,
podeCompartilhar: true,
podeSeguir: true,
podeChat: true,
podePostar: true,
podePainel: true,
podeProduto: true,
analytics: "supremo",
ia: "completa",
prioridade: "maxima",
leads: "premium"
}
};
async function carregarPlano(req, res, next) {
try {
if (!req.user?.id) {
req.planoNome = "Visitante";
req.permissoes = PLANOS.Visitante;
return next();
}
if (req.user.admin) {
req.planoNome = "Admin";
req.permissoes = { admin: true, tudo: true };
return next();
}
let empresa = null;
try{
empresa = await Empresa.findById(req.user.id);
}catch{}
if(!empresa && req.user.id === "demo"){
empresa = {
_id:"demo",
nome:"Flux Demo",
email:"demo@flux.com",
tipoConta:"empresa",
plano:"Premium",
ativo:true,
save: async () => {}
};
}
if (!empresa) {
req.planoNome = "Usuario";
req.permissoes = PLANOS.Usuario;
return next();
}
if (!empresa.ativo) {
return res.status(403).json({ erro: "empresa_bloqueada" });
}
const plano = empresa.tipoConta === "usuario"
? "Usuario"
: (empresa.assinaturaStatus === "ativo" ? (empresa.plano || "Start") : "Start");
req.empresa = empresa;
req.planoNome = plano;
req.permissoes = PLANOS[plano] || PLANOS.Start;
next();
} catch (err) {
console.log(err);
res.status(500).json({ erro: "plano_error" });
}
}
function verificarRecurso(recurso) {
return (req, res, next) => {
if (req.admin || req.permissoes?.tudo) return next();
if (!req.permissoes) {
return res.status(403).json({ erro: "sem_permissoes" });
}
if (!req.permissoes[recurso]) {
return res.status(403).json({
erro: "recurso_bloqueado",
recurso,
plano: req.planoNome,
mensagem: "Seu plano nï¿½o possui acesso a esse recurso."
});
}
next();
};
}
async function limitarPosts(req, res, next) {
try {
if (req.permissoes?.tudo) return next();
const limite = req.permissoes.postsMes;
if (limite === Infinity) return next();
const inicioMes = new Date(
new Date().getFullYear(),
new Date().getMonth(),
1
);
const total = await Post.countDocuments({
empresaId: String(req.user.id),
createdAt: { $gte: inicioMes },
status: { $ne: "removida" }
});
if (total >= limite) {
return res.status(403).json({
erro: "limite_plano",
plano: req.planoNome,
limite,
usados: total,
mensagem: `Plano ${req.planoNome} atingiu o limite mensal de ${limite} posts.`
});
}
next();
} catch {
res.status(500).json({ erro: "limite_posts_error" });
}
}
function requireEmpresa(req, res, next) {
if (req.empresa?.tipoConta !== "empresa") {
return res.status(403).json({ erro: "somente_empresa" });
}
next();
}
async function requireEmpresaPaga(req, res, next) {
try {
if (req.empresa?.tipoConta !== "empresa") {
return res.status(403).json({ erro: "somente_empresa" });
}
const planoValido = ["Basic", "Pro", "Avancado", "Premium"].includes(req.empresa.plano);
const pagamentoOk = await pagamentoConfirmadoEmpresa(req.empresa);
if (!planoValido || !pagamentoOk) {
return res.status(402).json({
erro: "pagamento_necessario",
mensagem: "Seu acesso premium ainda nï¿½o foi liberado. O plano sï¿½ ï¿½ ativado apï¿½s confirmaï¿½ï¿½o real do pagamento pelo Mercado Pago ou Stripe.",
redirect: "/pagamento.html?plano=" + encodeURIComponent(req.empresa.plano || "Basic")
});
}
next();
} catch (err) {
console.log("requireEmpresaPaga:", err.message);
return res.status(500).json({ erro: "validacao_pagamento_error" });
}
}
/* UPLOAD */
const baseUpload = path.join(__dirname, "public", "uploads");
const imageDir = path.join(baseUpload, "images");
const videoDir = path.join(baseUpload, "videos");
[baseUpload, imageDir, videoDir].forEach(dir => {
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, file.mimetype.startsWith("video") ? videoDir : imageDir);
},
filename: (req, file, cb) => {
const ext = path.extname(file.originalname).toLowerCase();
const safeExts = [".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov"];
if (!safeExts.includes(ext)) return cb(new Error("extensao_invalida"));
const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
cb(null, unique + ext);
}
});
const upload = multer({
storage,
limits: { fileSize: 80 * 1024 * 1024, files: 1 },
fileFilter: (req, file, cb) => {
const allowed = [
"image/png",
"image/jpeg",
"image/jpg",
"image/webp",
"video/mp4",
"video/webm",
"video/quicktime"
];
if (!allowed.includes(file.mimetype)) {
return cb(new Error("arquivo_invalido"));
}
cb(null, true);
}
});
/* STATIC */
const publicPath = path.join(__dirname, "public");
 
/* FORCE ML CONNECT ABSOLUTO */
app.get("/conectar-mercado-livre-flux", (req,res)=>{
const clientId = process.env.ML_CLIENT_ID;
const redirectUri = process.env.ML_REDIRECT_URI || "https://flux-beta-production.up.railway.app/ml-callback";
 
if(!clientId){
return res.status(500).json({erro:"ML_CLIENT_ID_FALTANDO"});
}
 
const url = "https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=" + clientId + "&redirect_uri=" + encodeURIComponent(redirectUri);
 
return res.redirect(url);
});
 
 
/* FIX ABSOLUTO NOTIFICACOES - ANTES DE QUALQUER ROTA */
app.use((req,res,next)=>{
if(req.path === "/notificacoes"){
console.log("FIX NOTIFICACOES 200");
return res.status(200).sendFile(path.join(publicPath,"notificacoes.html"));
}
if(req.path === "/notificacao" || req.path === "/notifications"){
return res.redirect("/notificacoes");
}
next();
});
app.use(express.static(publicPath, {
maxAge: IS_PRODUCTION ? "7d" : 0,
etag: true,
fallthrough: true,
setHeaders: (res, filePath) => {
if (/\.(html)$/i.test(filePath)) {
res.setHeader("Cache-Control", "no-store");
} else {
res.setHeader("Cache-Control", "public, max-age=604800, immutable");
}
}
}));
 
app.use("/uploads", express.static(baseUpload, {
maxAge: IS_PRODUCTION ? "7d" : 0,
etag: true,
fallthrough: true,
setHeaders: (res) => {
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("Cache-Control", "public, max-age=604800, immutable");
}
}));
 
/* NOTIFICACOES + ROTAS PUBLICAS SEGURAS */
app.get("/notificacoes", (req, res) => {
return res.sendFile(path.join(publicPath, "notificacoes.html"));
});
 
app.get("/notificacao", (req, res) => {
return res.redirect("/notificacoes");
});
 
app.get("/notifications", (req, res) => {
return res.redirect("/notificacoes");
});
 
app.get("/", (req, res) => {
return res.sendFile(path.join(publicPath, "login.html"));
});
 
 
/* PRODUTO FLUX - pagina estatica com id por query ou path */
app.get("/upload-commerce.html", (req,res)=>{
  res.sendFile(path.join(publicPath,"upload-commerce.html"));
});

app.get("/upload-commerce", (req,res)=>{
  res.sendFile(path.join(publicPath,"upload-commerce.html"));
});

app.get("/flux-produto.html", (req, res) => {
return res.sendFile(path.join(publicPath, "flux-produto.html"));
});
 
app.get("/flux-produto/:id", (req, res) => {
return res.sendFile(path.join(publicPath, "flux-produto.html"));
});
 
/* ROTAS DINAMICAS SEGURAS */
app.get("/:page", (req, res, next) => {
const page = String(req.params.page || "").trim();
 
const bloqueadas = [
"api",
"uploads",
"admin",
"notificacoes",
"notificacao",
"notifications"
];
 
if (bloqueadas.includes(page)) {
return next();
}
 
if (!/^[a-zA-Z0-9._-]+$/.test(page)) {
return next();
}
 
const file = path.join(publicPath, page + ".html");
 
if (!file.startsWith(publicPath)) {
return next();
}
 
if (fs.existsSync(file)) {
return res.sendFile(file);
}
 
return next();
});
 
/* ROTAS PADRï¿½ï¿½O FLUX - ALIASES */
const pageAliases = {
"/home": "/feed",
"/inicio": "/feed",
"/postar": "/painel",
"/publicar": "/painel",
"/meu-perfil": "/empresa.html",
"/perfil": "/empresa.html",
"/perfil-empresa": "/empresa.html",
"/loja": "/empresa.html",
"/vitrine": "/empresa.html",
"/shop": "/marketplace",
"/mercado": "/marketplace",
"/compras": "/pedidos",
"/mensagens": "/chat.html",
"/chat": "/chat.html",
"/ranking": "/ranking.html",
"/trends": "/trends.html",
"/posts": "/posts.html"
};
 
Object.entries(pageAliases).forEach(([from,to])=>{
app.get(from,(req,res)=>res.redirect(to));
});
 
app.get("/api/notificacoes", auth, async (req,res)=>{
res.json({
ok:true,
notificacoes:[
{
tipo:"sistema",
titulo:"Bem-vindo ï¿½ Flux",
texto:"Suas notificaï¿½ï¿½es aparecerï¿½o aqui em tempo real.",
createdAt:new Date()
}
]
});
});
 
app.get("/api/rotas", (req,res)=>{
res.json({
ok:true,
paginas:{
login:"/login",
cadastroCliente:"/cliente-cadastro",
cadastroEmpresa:"/cadastro",
feed:"/feed",
fluxo:"/fluxo",
postar:"/painel",
perfil:"/empresa.html",
marketplace:"/marketplace",
pedidos:"/pedidos",
notificacoes:"/notificacoes",
chat:"/chat",
planos:"/planos",
admin:"/admin"
},
apis:{
feed:"/api/feed",
fluxo:"/api/fluxo",
produtos:"/api/produtos",
pedidos:"/api/pedidos",
permissoes:"/api/permissoes",
online:"/online",
health:"/api/health"
}
});
});
 
/* CLIENTE / EMPRESA CADASTRO */
function parseInteresses(value) {
if (Array.isArray(value)) return value.map(v => cleanText(v, 80)).filter(Boolean).slice(0, 20);
return String(value || "")
.split(/[;,]/)
.map(v => cleanText(v, 80))
.filter(Boolean)
.slice(0, 20);
}
app.post(["/cliente/cadastro", "/api/cliente/cadastro"], async (req, res) => {
try {
const email = cleanEmail(req.body.email);
const senhaLimpa = String(req.body.senha || "");
if (!validator.isEmail(email)) return res.status(400).json({ erro: "email_invalido" });
if (senhaLimpa.length < 6) return res.status(400).json({ erro: "senha_fraca", mensagem: "Use pelo menos 6 caracteres." });
const exists = await Empresa.findOne({ email });
if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail jï¿½ estï¿½ cadastrado. Faï¿½a login." });
const senha = await bcrypt.hash(senhaLimpa, 10);
const interesses = parseInteresses(req.body.interesses || req.body.interesse);
const cliente = await Empresa.create({
nome: cleanText(req.body.nome || req.body.responsavel || "Cliente Flux", 120),
responsavel: cleanText(req.body.nome || "", 120),
telefone: cleanText(req.body.telefone || req.body.whatsapp, 40),
whatsapp: cleanText(req.body.whatsapp || req.body.telefone, 40),
cidade: cleanText(req.body.cidade, 120),
segmento: "Cliente",
interesses,
email,
senha,
tipoConta: "usuario",
plano: "Start",
assinaturaStatus: "gratis",
ativo: true
});
await Lead.create({
clienteId: String(cliente._id),
nome: cliente.nome,
email: cliente.email,
telefone: cliente.telefone,
whatsapp: cliente.whatsapp,
cidade: cliente.cidade,
interesses
});
res.json({ ok: true, tipoConta: "usuario", redirect: "/login" });
} catch (err) {
console.log("cliente cadastro:", err);
if (err.code === 11000) return res.status(400).json({ erro: "email_existe" });
res.status(500).json({ erro: "cadastro_cliente_error", mensagem: err.message });
}
});
app.post(["/empresa/cadastro", "/api/empresa/cadastro"], async (req, res) => {
try {
const email = cleanEmail(req.body.email);
const senhaLimpa = String(req.body.senha || "");
if (!validator.isEmail(email)) return res.status(400).json({ erro: "email_invalido" });
if (senhaLimpa.length < 6) return res.status(400).json({ erro: "senha_fraca", mensagem: "Use pelo menos 6 caracteres." });
const exists = await Empresa.findOne({ email });
if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail jï¿½ estï¿½ cadastrado. Faï¿½a login." });
const senha = await bcrypt.hash(senhaLimpa, 10);
const empresa = await Empresa.create({
nome: cleanText(req.body.nome || req.body.empresa, 120),
responsavel: cleanText(req.body.responsavel, 120),
telefone: cleanText(req.body.telefone || req.body.whatsapp, 40),
whatsapp: cleanText(req.body.whatsapp || req.body.telefone, 40),
cidade: cleanText(req.body.cidade, 120),
segmento: cleanText(req.body.segmento, 120),
email,
senha,
tipoConta: "empresa",
plano: "Start",
assinaturaStatus: "pendente",
ativo: true
});
res.json({
ok: true,
tipoConta: "empresa",
empresaId: empresa._id,
redirect: "/planos",
mensagem: "Cadastro criado. Escolha um plano para liberar o painel empresarial."
});
} catch (err) {
console.log("empresa cadastro:", err);
if (err.code === 11000) return res.status(400).json({ erro: "email_existe" });
res.status(500).json({ erro: "cadastro_empresa_error", mensagem: err.message });
}
});
/* LOGIN CLIENTE / EMPRESA */
app.post(["/login", "/api/login", "/cliente/login", "/empresa/login"], async (req, res) => {
try {
const email = cleanEmail(req.body.email);
const user = await Empresa.findOne({ email });
if (!user) return res.status(400).json({ erro: "nao_encontrado" });
const ok = await bcrypt.compare(req.body.senha || "", user.senha);
if (!ok) return res.status(401).json({ erro: "senha_invalida" });
if (!user.ativo) return res.status(403).json({ erro: "conta_bloqueada" });
user.online = true;
user.ultimaAtividade = new Date();
await user.save();
const token = jwt.sign({
id: user._id,
nome: user.nome,
email: user.email,
tipoConta: user.tipoConta,
empresa: user.tipoConta === "empresa"
}, JWT_SECRET, { expiresIn: "7d" });
const pagamentoConfirmado =
user.tipoConta === "empresa"
? await pagamentoConfirmadoEmpresa(user)
: true;
const redirect = user.tipoConta === "empresa"
? (pagamentoConfirmado ? "/painel" : "/planos")
: "/fluxo";
res.json({
ok: true,
...(token ? { token } : {}),
redirect,
usuario: {
id: user._id,
nome: user.nome,
email: user.email,
plano: user.plano,
tipoConta: user.tipoConta,
assinaturaStatus: user.assinaturaStatus || "gratis",
pagamentoConfirmado
},
empresa: {
id: user._id,
nome: user.nome,
email: user.email,
plano: user.plano,
tipoConta: user.tipoConta,
assinaturaStatus: user.assinaturaStatus || "gratis",
pagamentoConfirmado
}
});
} catch (err) {
console.log("login:", err);
res.status(500).json({ erro: "login_error", mensagem: err.message });
}
});
/* LOGIN DEMO */
app.post("/empresa/login-demo", (req, res) => {
const token = jwt.sign({
id: "demo",
nome: "Flux Demo",
empresa: true,
tipoConta: "empresa"
}, JWT_SECRET, { expiresIn: "7d" });
res.json({
ok: true,
...(token ? { token } : {}),
empresa: {
id: "demo",
nome: "Flux Demo",
email: "demo@flux.com",
plano: "Premium",
tipoConta: "empresa"
}
});
});
/* ADMIN LOGIN */
app.post("/admin/login", (req, res) => {
try {
const senha = String(req.body.senha || "");
if (senha !== ADMIN_PASSWORD) {
return res.status(401).json({ erro: "senha_invalida" });
}
const token = jwt.sign({
admin: true,
nome: "Flux Master"
}, JWT_SECRET, { expiresIn: "12h" });
res.json({ ok: true, token });
} catch {
res.status(500).json({ erro: "admin_error" });
}
});
/* STRIPE CHECKOUT */
app.post("/api/stripe/checkout", auth, carregarPlano, requireEmpresa, async (req, res) => {
try {
const plano = req.body.plano;
if (!["Basic", "Pro", "Avancado", "Premium"].includes(plano)) {
return res.status(400).json({ erro: "plano_invalido" });
}
if (!PRICE_IDS[plano] || PRICE_IDS[plano].includes("COLE_AQUI")) {
return res.status(400).json({
erro: "price_id_nao_configurado",
mensagem: "Configure o PRICE_ID da Stripe no server.js."
});
}
let empresa = null;
try{
empresa = await Empresa.findById(req.user.id);
}catch{}
if(!empresa && req.user.id === "demo"){
empresa = {
_id:"demo",
nome:"Flux Demo",
email:"demo@flux.com",
tipoConta:"empresa",
plano:"Premium",
ativo:true,
save: async () => {}
};
}
if (!empresa) {
return res.status(404).json({ erro: "empresa_nao_encontrada" });
}
const sessionBase = {
mode: "subscription",
customer_email: empresa.email,
line_items: [
{
price: PRICE_IDS[plano],
quantity: 1
}
],
metadata: {
empresaId: String(empresa._id),
plano
},
subscription_data: {
metadata: {
empresaId: String(empresa._id),
plano
}
},
success_url: `${BASE_URL}/obrigada.html?sucesso=true&plano=${plano}`,
cancel_url: `${BASE_URL}/planos.html?cancelado=true`
};
let session;
try {
session = await stripe.checkout.sessions.create({
...sessionBase,
payment_method_types: ["card", "pix"]
});
} catch (pixErr) {
console.log("Stripe nï¿½o aceitou PIX em assinatura. Voltando para cartï¿½o:", pixErr.message);
session = await stripe.checkout.sessions.create({
...sessionBase,
payment_method_types: ["card"]
});
}
res.json({
ok: true,
url: session.url
});
} catch (err) {
console.log("Stripe checkout erro:", err);
res.status(500).json({
erro: "stripe_checkout_error",
mensagem: err.message
});
}
});
/* STRIPE PIX ï¿½NICO â€” CASO A STRIPE Nï¿½O LIBERE PIX EM ASSINATURA */
app.post("/api/stripe/checkout-pix-unico", auth, async (req, res) => {
try {
const plano = req.body.plano;
if (!["Basic", "Pro", "Avancado", "Premium"].includes(plano)) {
return res.status(400).json({ erro: "plano_invalido" });
}
if (!process.env.STRIPE_SECRET_KEY) {
return res.status(400).json({
erro: "stripe_nao_configurada",
mensagem: "Configure STRIPE_SECRET_KEY no .env."
});
}
let empresa = null;
try {
if (isValidObjectId(req.user.id)) {
empresa = await Empresa.findById(req.user.id);
}
} catch {}
if (!empresa) {
return res.status(404).json({ erro: "empresa_nao_encontrada" });
}
const session = await stripe.checkout.sessions.create({
mode: "payment",
payment_method_types: ["card"],
customer_email: empresa.email,
line_items: [
{
price_data: {
currency: "brl",
product_data: {
name: `Flux ${PLAN_LABELS[plano] || plano}`
},
unit_amount: Math.round((PLAN_VALUES[plano] || 0) * 100)
},
quantity: 1
}
],
metadata: {
empresaId: String(empresa._id),
plano,
tipo: "pix_unico"
},
success_url: `${BASE_URL}/obrigada.html?sucesso=true&plano=${plano}`,
cancel_url: `${BASE_URL}/planos.html?cancelado=true`
});
res.json({ ok: true, url: session.url });
} catch (err) {
console.log("Stripe PIX ï¿½nico erro:", err);
res.status(500).json({
erro: "stripe_pix_unico_error",
mensagem: err.message
});
}
});
/* PORTAL DO CLIENTE STRIPE */
app.post("/api/stripe/portal", auth, async (req, res) => {
try {
let empresa = null;
try{
empresa = await Empresa.findById(req.user.id);
}catch{}
if(!empresa && req.user.id === "demo"){
empresa = {
_id:"demo",
nome:"Flux Demo",
email:"demo@flux.com",
tipoConta:"empresa",
plano:"Premium",
ativo:true,
save: async () => {}
};
}
if (!empresa || !empresa.stripeCustomerId) {
return res.status(400).json({ erro: "cliente_stripe_nao_encontrado" });
}
const portalSession = await stripe.billingPortal.sessions.create({
customer: empresa.stripeCustomerId,
return_url: `${BASE_URL}/painel`
});
res.json({ ok: true, url: portalSession.url });
} catch (err) {
console.log(err);
res.status(500).json({ erro: "stripe_portal_error" });
}
});

app.get("/api/trends-viral", async (req,res)=>{
  try{
    const posts = await Post.find({ status:{ $ne:"removida" } }).sort({createdAt:-1}).limit(100).lean();

    const ranking = posts.map(p=>{
      const n = normalizePost(p);
      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 3 +
        Number(n.saves || 0) * 8 +
        Number(n.shares || 0) * 5;
      return n;
    }).sort((a,b)=>b.scoreViral-a.scoreViral).slice(0,20);

    return res.json({ok:true,ranking});
  }catch(e){
    console.log("trends viral:",e);
    return res.status(500).json({erro:"trends_viral_error"});
  }
});


/* PERFIL */
app.get("/api/me", auth, async (req, res) => {
try {
const empresa = await Empresa.findById(req.user.id)
.select("-senha")
.lean();
if (!empresa) {
return res.status(404).json({
erro: "empresa_nao_encontrada"
});
}
const pagamentoConfirmado = await pagamentoConfirmadoEmpresa(empresa);
res.json({
ok: true,
empresa: {
...empresa,
pagamentoConfirmado
}
});
} catch (err) {
console.log(err);
res.status(500).json({
erro: "perfil_error"
});
}
});
 
app.get("/api/pagamento/status", auth, async (req, res) => {
try {
const empresa = await Empresa.findById(req.user.id).select("-senha").lean();
if (!empresa) return res.status(404).json({ ok:false, erro:"empresa_nao_encontrada" });
const pagamentoConfirmado = await pagamentoConfirmadoEmpresa(empresa);
return res.json({
ok:true,
pagamentoConfirmado,
assinaturaStatus: empresa.assinaturaStatus || "gratis",
plano: empresa.plano || "Start",
liberado: pagamentoConfirmado
});
} catch (err) {
console.log("pagamento status:", err.message);
return res.status(500).json({ ok:false, erro:"pagamento_status_error" });
}
});
app.put("/api/me", auth, async (req, res) => {
try {
const updates = {
nome: cleanText(req.body.nome, 120),
responsavel: cleanText(req.body.responsavel, 120),
telefone: cleanText(req.body.telefone, 40),
segmento: cleanText(req.body.segmento, 120),
bio: cleanText(req.body.bio, 500),
site: cleanText(req.body.site, 200),
whatsapp: cleanText(req.body.whatsapp, 40),
avatar: cleanText(req.body.avatar, 500),
logo: cleanText(req.body.logo, 500),
capa: cleanText(req.body.capa, 500)
};
Object.keys(updates).forEach(key => {
if (
updates[key] === undefined ||
updates[key] === null ||
updates[key] === ""
) {
delete updates[key];
}
});
const empresa = await Empresa.findByIdAndUpdate(
req.user.id,
updates,
{
new: true
}
).select("-senha");
res.json({
ok: true,
empresa
});
} catch (err) {
console.log(err);
res.status(500).json({
erro: "perfil_update_error"
});
}
});
app.get("/api/empresa.html/:id", async (req, res) => {
try {
if (!isValidObjectId(req.params.id)) return res.status(400).json({ erro: "id_invalido" });
const empresa = await Empresa.findById(req.params.id).select("-senha -stripeCustomerId -stripeSubscriptionId").lean();
if (!empresa || !empresa.ativo) return res.status(404).json({ erro: "perfil_nao_encontrado" });
const posts = await Post.find({ empresaId: String(empresa._id), status: { $ne: "removida" } }).sort({ createdAt: -1 }).limit(30).lean();
const produtos = await Produto.find({ empresaId: String(empresa._id), ativo: true }).sort({ createdAt: -1 }).limit(30).lean();
res.json({ ok: true, perfil: empresa, posts: posts.map(p=>{
      const n = normalizePost(p);
      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 3 +
        Number(n.saves || 0) * 8 +
        Number(n.shares || 0) * 5;
      return n;
    }).sort((a,b)=>b.scoreViral-a.scoreViral), produtos });
} catch {
res.status(500).json({ erro: "perfil_publico_error" });
}
});
/* PERMISSï¿½ES */
app.get("/api/permissoes", optionalAuth, carregarPlano, async (req, res) => {
res.json({
ok: true,
plano: req.planoNome,
label: PLAN_LABELS[req.planoNome] || req.planoNome,
permissoes: req.permissoes,
empresa: req.empresa ? {
id: req.empresa._id,
nome: req.empresa.nome,
email: req.empresa.email,
plano: req.empresa.plano,
tipoConta: req.empresa.tipoConta
} : null
});
});
/* FEED */



app.post("/api/interesse", optionalAuth, async (req,res)=>{
  try{
    const userKey =
      req.user?.id ||
      req.body.userKey ||
      req.ip ||
      "anon";

    const categoria = String(req.body.categoria || "geral");
    const empresaId = String(req.body.empresaId || "");
    const produtoId = String(req.body.produtoId || "");
    const peso = Number(req.body.peso || 1);

    await UserInterest.updateOne(
      {userKey,categoria,empresaId,produtoId},
      {
        $inc:{peso},
        $set:{updatedAt:new Date()}
      },
      {upsert:true}
    );

    return res.json({ok:true});
  }catch(e){
    console.log("interesse:",e);
    return res.status(500).json({erro:"interesse_error"});
  }
});





app.get("/api/for-you", optionalAuth, async (req,res)=>{
  try{
    const limit = Math.min(Number(req.query.limit || 40),80);

    const userKey =
      req.user?.id ||
      req.ip ||
      "anon";

    const interesses = await UserInterest.find({
      userKey
    }).lean();

    const mapaInteresse = {};

    interesses.forEach(i=>{
      mapaInteresse[i.categoria] =
        (mapaInteresse[i.categoria] || 0) +
        Number(i.peso || 0);
    });

    const posts = await Post.find({
      status:{ $ne:"removida" }
    }).sort({createdAt:-1}).limit(160).lean();

    const agora = Date.now();

    const ranking = posts.map(p=>{
      const n = normalizePost(p);

      const idadeHoras = Math.max(
        1,
        (agora - new Date(n.createdAt || Date.now()).getTime()) / 36e5
      );

      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 4 +
        Number(n.saves || 0) * 9 +
        Number(n.shares || 0) * 7 +
        Number(n.watchSeconds || 0) * 0.08 +
        Number(n.watchCount || 0) * 3 +
        Number(n.retentionAvg || 0) * 2.2 +
        (n.produtoId ? 12 : 0) +
        (n.tipo === "fluxo" ? 8 : 0);

      const categoriaPost =
        n.categoria ||
        n.segmento ||
        "geral";

      const interesseBoost =
        Number(mapaInteresse[categoriaPost] || 0);

      n.scoreForYou =
        (
          n.scoreViral +
          (interesseBoost * 18)
        ) / Math.pow(idadeHoras,0.35);

      return n;
    })
    .sort((a,b)=>b.scoreForYou-a.scoreForYou)
    .slice(0,limit);

    return res.json({ok:true,posts:ranking});
  }catch(e){
    console.log("for you:",e);
    return res.status(500).json({erro:"for_you_error"});
  }
});


app.post("/api/comentar/:postId", optionalAuth, async (req,res)=>{
  try{
    const texto = String(req.body.texto || "").trim();

    if(!texto){
      return res.status(400).json({erro:"texto_obrigatorio"});
    }

    const userKey = String(req.user?.id || req.body.userKey || req.headers["x-user-key"] || req.ip || "anon");

    const duplicado = await Comment.findOne({
      postId,
      usuarioId:userKey,
      texto
    });

    if(duplicado){
      return res.json({
        ok:true,
        duplicate:true,
        comment:duplicado
      });
    }

    const comment = await Comment.create({
      postId:String(req.params.postId),
      userId:String(req.user?.id || "anon"),
      nome:req.user?.nome || "Flux User",
      avatar:req.user?.avatar || "",
      texto,
      createdAt:new Date()
    });

    if(typeof io !== "undefined"){
      io.emit("novo_comentario", {
        postId:String(req.params.postId),
        comment
      });
    }

    return res.json({ok:true,comment});
  }catch(e){
    console.log("comentar:",e);
    return res.status(500).json({erro:"comentar_error"});
  }
});

app.get("/api/feed", optionalAuth, carregarPlano, verificarRecurso("podeVerFeed"), async (req, res) => {
try {
const posts = await Post.find({
tipo: "feed",
status: { $ne: "removida" }
})
.sort({ createdAt: -1 })
.limit(50)
.lean();
res.json(posts.map(normalizePost));
} catch {
res.status(500).json({ erro: "feed_error" });
}
});
/* FLUXO */
app.get("/api/fluxo", optionalAuth, carregarPlano, verificarRecurso("podeVerFluxo"), async (req, res) => {
try {
const limit = req.planoNome === "Visitante" ? 10 : 50;
const posts = await Post.find({
tipo: "fluxo",
status: { $ne: "removida" }
})
.sort({ createdAt: -1 })
.limit(limit)
.lean();
res.json(posts.map(normalizePost));
} catch {
res.status(500).json({ erro: "fluxo_error" });
}
});
/* POSTAR */
app.post(
"/postar",
auth,
carregarPlano,
requireEmpresaPaga,
verificarRecurso("podePostar"),
limitarPosts,
upload.single("media"),
async (req, res) => {
try {
if (!req.file) return res.status(400).json({ erro: "sem_midia" });
const filePath = req.file.mimetype.startsWith("video")
? "videos/" + req.file.filename
: "images/" + req.file.filename;
const tipoRecebido = req.body.tipo === "fluxo" ? "fluxo" : "feed";
if (tipoRecebido === "fluxo" && !req.permissoes.podeVerFluxo) {
return res.status(403).json({
erro: "fluxo_bloqueado",
mensagem: "Seu plano nï¿½o permite publicar no Fluxo."
});
}
const post = await Post.create({
empresaId: String(req.empresa?._id || req.user.id),
empresaNome: req.empresa?.nome || req.user.nome || "Empresa Flux",
empresaEmail: req.empresa?.email || req.user.email || "",
media: filePath,
descricao: cleanText(req.body.descricao, 1500),
link: cleanText(req.body.link, 500),
tipo: tipoRecebido,
status: "aprovada"
});
if (req.empresa) {
req.empresa.ultimaAtividade = new Date();
await req.empresa.save();
}
const normalized = normalizePost(post);
io.emit("novo_post", normalized);
io.emit(tipoRecebido === "fluxo" ? "novo_fluxo" : "novo_feed", normalized);
res.json({
ok: true,
plano: req.planoNome,
permissoes: req.permissoes,
post: normalized
});
} catch (err) {
console.log(err);
res.status(500).json({ erro: "upload_error" });
}
}
);
/* LIKES */
app.post("/api/like/:id", optionalAuth, async (req,res)=>{
  try{
    const userKey = String(req.user?.id || req.body.userKey || req.headers["x-user-key"] || req.ip || "anon");
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    post.likedBy = post.likedBy || [];

    if(post.likedBy.includes(userKey)){
      return res.json({
        ok:true,
        alreadyLiked:true,
        likes:post.likes || post.likedBy.length
      });
    }

    post.likedBy.push(userKey);
    post.likes = post.likedBy.length;

    await post.save();

    return res.json({
      ok:true,
      likes:post.likes
    });

  }catch(e){
    console.log("like:",e);
    return res.status(500).json({erro:"like_error"});
  }
});



app.post("/api/comments/:postId", optionalAuth, async (req,res)=>{
  try{
    const texto = String(req.body.texto || "").trim();

    if(!texto){
      return res.status(400).json({erro:"texto_obrigatorio"});
    }

    const comment = await Comment.create({
      postId:String(req.params.postId),
      userId:String(req.user?.id || "anon"),
      nome:req.user?.nome || "Flux User",
      avatar:req.user?.avatar || "",
      texto
    });

    if(typeof io !== "undefined"){
      io.emit("novo_comentario", {
        postId:String(req.params.postId),
        comment
      });
    }

    return res.json({ok:true,comment});
  }catch(e){
    console.log("comments_post:",e);
    return res.status(500).json({erro:"comments_post_error"});
  }
});


/* VIEW */
app.post("/api/view/:id", optionalAuth, async (req, res) => {
try {
const id = actor(req);
const post = await Post.findById(req.params.id);
if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });
if (post.viewedBy.includes(id)) {
return res.json({ ok: true, alreadyViewed: true, views: post.views });
}
post.viewedBy.push(id);
post.views = post.viewedBy.length;
await post.save();
res.json({ ok: true, views: post.views });
} catch {
res.status(500).json({ erro: "view_error" });
}
});





app.post("/api/save-post/:id", optionalAuth, async (req,res)=>{
  try{
    const userKey = String(req.user?.id || req.body?.userKey || req.headers["x-user-key"] || req.ip || "anon");
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    post.savedBy = Array.isArray(post.savedBy) ? post.savedBy : [];

    if(post.savedBy.includes(userKey)){
      return res.json({ok:true,alreadySaved:true,saves:post.savedBy.length});
    }

    post.savedBy.push(userKey);
    post.saves = post.savedBy.length;

    await post.save();

    return res.json({ok:true,saves:post.saves});
  }catch(e){
    console.log("save_post_error:", e);
    return res.status(500).json({erro:"save_post_error",detalhe:String(e.message || e)});
  }
});


/* SAVES */
app.post("/api/save/:id", optionalAuth, async (req,res)=>{
  try{
    const userKey = String(req.user?.id || req.body?.userKey || req.headers["x-user-key"] || req.ip || "anon");
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    post.savedBy = Array.isArray(post.savedBy) ? post.savedBy : [];

    if(post.savedBy.includes(userKey)){
      return res.json({
        ok:true,
        alreadySaved:true,
        saves:post.savedBy.length
      });
    }

    post.savedBy.push(userKey);
    post.saves = post.savedBy.length;

    await post.save();

    return res.json({
      ok:true,
      saves:post.saves
    });

  }catch(e){
    console.log("save_error:", e);
    return res.status(500).json({erro:"save_error", detalhe:String(e.message || e)});
  }
});


/* COMMENTS */
app.get("/api/comments/:postId", async (req, res) => {
try {
const comments = await Comment.find({ postId: req.params.postId })
.sort({ createdAt: -1 })
.limit(50)
.lean();
res.json(comments);
} catch {
res.status(500).json({ erro: "comment_error" });
}
});
app.post("/api/comments", optionalAuth, async (req, res) => {
try {
const texto = cleanText(req.body.texto, 700);
const postId = req.body.postId;
const usuarioNome = cleanText(
  req.body.usuarioNome ||
  req.body.nome ||
  req.user?.nome ||
  "Visitante Flux",
  80
);
if (!postId || !texto) return res.status(400).json({ erro: "comentario_invalido" });
const comment = await Comment.create({
postId,
usuarioId:userKey,
usuarioNome,
texto
});
io.emit("novo_comentario", comment);
io.emit("comment:new", comment);
res.json({ ok: true, comment });
} catch {
res.status(500).json({ erro: "comment_error" });
}
});
/* BUSCA */
app.get("/api/buscar", optionalAuth, carregarPlano, verificarRecurso("podeBuscar"), async (req, res) => {
try {
const q = String(req.query.q || "").trim();
const limit = req.planoNome === "Visitante" ? 10 : 30;
if (!q) {
const empresas = await Empresa.find({ ativo: true }).limit(limit).lean();
const posts = await Post.find({ status: { $ne: "removida" } }).sort({ createdAt: -1 }).limit(limit).lean();
return res.json({ empresas, posts });
}
const regex = new RegExp(escapeRegex(q), "i");
const empresas = await Empresa.find({
ativo: true,
$or: [
{ nome: regex },
{ email: regex },
{ segmento: regex }
]
}).limit(limit).lean();
const posts = await Post.find({
status: { $ne: "removida" },
$or: [
{ descricao: regex },
{ empresaNome: regex },
{ tipo: regex }
]
}).limit(limit).lean();
res.json({ empresas, posts });
} catch {
res.status(500).json({ erro: "buscar_error" });
}
});
/* ANALYTICS EMPRESA */
app.get("/api/empresa/analytics", auth, carregarPlano, verificarRecurso("analytics"), async (req, res) => {
try {
const posts = await Post.find({
empresaId: String(req.user.id),
status: { $ne: "removida" }
});
const views = posts.reduce((a, p) => a + Number(p.views || 0), 0);
const likes = posts.reduce((a, p) => a + Number(p.likes || 0), 0);
const saves = posts.reduce((a, p) => a + Number(p.saves || 0), 0);
const shares = posts.reduce((a, p) => a + Number(p.shares || 0), 0);
res.json({
ok: true,
plano: req.planoNome,
analytics: req.permissoes.analytics,
posts: posts.length,
views,
likes,
saves,
shares
});
} catch {
res.status(500).json({ erro: "empresa_analytics_error" });
}
});
/* IA EMPRESA */
app.get("/api/empresa/ia", auth, carregarPlano, verificarRecurso("ia"), async (req, res) => {
res.json({
ok: true,
plano: req.planoNome,
ia: req.permissoes.ia,
mensagem: "IA liberada para este plano."
});
});
/* ANALYTICS ADMIN */
app.get("/api/analytics", adminAuth, async (req, res) => {
try {
const empresas = await Empresa.countDocuments();
const posts = await Post.countDocuments({ status: { $ne: "removida" } });
const viewsData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]);
const likesData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$likes" } } }]);
const savesData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$saves" } } }]);
const pagamentosData = await Pagamento.aggregate([
{ $match: { status: "aprovado" } },
{ $group: { _id: null, total: { $sum: "$valor" } } }
]);
const empresasLista = await Empresa.find().sort({ createdAt: -1 }).limit(20).lean();
res.json({
views: viewsData[0]?.total || 0,
seguidores: likesData[0]?.total || 0,
posts,
receita: pagamentosData[0]?.total || 0,
changes: {
views: 0,
seguidores: 0,
posts: 0,
receita: 0
},
chart: [0, 0, viewsData[0]?.total || 0, likesData[0]?.total || 0, savesData[0]?.total || 0, posts, empresas],
insights: [
{
title: "Dados reais conectados",
text: "A Flux estï¿½ lendo empresas, posts, views, likes e receita direto do banco."
},
{
title: "Feed e Fluxo separados",
text: "As mï¿½tricas podem ser separadas por tipo de publicaï¿½ï¿½o."
},
{
title: "Admin ativo",
text: "O painel mestre jï¿½ pode controlar a plataforma."
}
],
empresas: empresasLista.map(e => ({
nome: e.nome,
email: e.email,
plano: e.plano,
posts: 0,
views: 0,
receita: e.receita || 0,
status: e.ativo ? "Ativo" : "Bloqueada",
avatar: e.avatar || ""
}))
});
} catch {
res.status(500).json({ erro: "analytics_error" });
}
});
/* ADMIN */
app.get("/admin/stats", adminAuth, async (req, res) => {
try {
const empresas = await Empresa.countDocuments();
const posts = await Post.countDocuments();
const viewsData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]);
const energiaData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$likes" } } }]);
res.json({
empresas,
posts,
views: viewsData[0]?.total || 0,
energia: energiaData[0]?.total || 0
});
} catch {
res.status(500).json({ erro: "stats_error" });
}
});
app.get("/admin/grafico", adminAuth, async (req, res) => {
try {
const dados = await Post.aggregate([
{
$group: {
_id: { $dateToString: { format: "%d/%m", date: "$createdAt" } },
energia: { $sum: "$likes" }
}
},
{ $sort: { _id: 1 } },
{ $limit: 7 }
]);
res.json(dados);
} catch {
res.status(500).json({ erro: "grafico_error" });
}
});
app.get("/admin/ranking", adminAuth, async (req, res) => {
try {
const dados = await Post.aggregate([
{
$group: {
_id: "$empresaNome",
energia: { $sum: "$likes" },
views: { $sum: "$views" },
posts: { $sum: 1 }
}
},
{ $sort: { energia: -1 } },
{ $limit: 10 }
]);
res.json(dados);
} catch {
res.status(500).json({ erro: "ranking_error" });
}
});
app.get("/admin/empresas", adminAuth, async (req, res) => {
try {
const empresas = await Empresa.find().sort({ createdAt: -1 }).lean();
res.json(empresas);
} catch {
res.status(500).json({ erro: "empresas_error" });
}
});
/* API EMPRESAS */
app.get("/api/empresas", adminAuth, async (req, res) => {
try {
const lista = await Empresa.find().sort({ createdAt: -1 }).lean();
const empresas = await Promise.all(lista.map(async e => {
const posts = await Post.countDocuments({ empresaId: String(e._id) });
const receitaData = await Pagamento.aggregate([
{ $match: { empresaId: String(e._id), status: "aprovado" } },
{ $group: { _id: null, total: { $sum: "$valor" } } }
]);
return {
id: e._id,
nome: e.nome,
email: e.email,
responsavel: e.responsavel,
segmento: e.segmento,
plano: e.plano || "Start",
status: !e.ativo ? "banida" : e.online ? "online" : "offline",
posts,
receita: receitaData[0]?.total || 0,
ultimaAtividade: e.ultimaAtividade ? new Date(e.ultimaAtividade).toLocaleString("pt-BR") : "-",
avatar: e.avatar || ""
};
}));
res.json({
resumo: {
total: empresas.length,
ativas: empresas.filter(e => e.status === "online").length,
premium: empresas.filter(e => ["Premium", "Pro", "Basic"].includes(e.plano)).length,
receita: empresas.reduce((acc, e) => acc + Number(e.receita || 0), 0)
},
empresas
});
} catch {
res.status(500).json({ erro: "api_empresas_error" });
}
});
app.put("/api/empresas/:id/plano", adminAuth, async (req, res) => {
try {
await Empresa.findByIdAndUpdate(req.params.id, {
plano: req.body.plano || "Start"
});
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "plano_error" });
}
});
app.post("/api/empresas/:id/banir", adminAuth, async (req, res) => {
try {
await Empresa.findByIdAndUpdate(req.params.id, {
ativo: false,
online: false
});
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "ban_error" });
}
});
/* ADMIN POSTS */
app.get("/admin/posts", adminAuth, async (req, res) => {
try {
const posts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();
res.json(posts);
} catch {
res.status(500).json({ erro: "posts_error" });
}
});
app.delete("/admin/post/:id", adminAuth, async (req, res) => {
try {
await Post.findByIdAndUpdate(req.params.id, { status: "removida" });
io.emit("post_removido", { id: req.params.id });
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "delete_error" });
}
});
/* MODERAï¿½ï¿½O */
app.get("/api/moderacao/posts", adminAuth, async (req, res) => {
try {
const lista = await Post.find({ status: { $ne: "removida" } })
.sort({ createdAt: -1 })
.limit(100)
.lean();
const posts = lista.map(p => ({
id: p._id,
empresa: p.empresaNome,
email: p.empresaEmail || "",
legenda: p.descricao,
destino: p.tipo,
tipo: p.media?.includes("videos/") ? "video" : "imagem",
midia: "/uploads/" + p.media,
status: p.status,
risco: p.riscoIA || 0,
motivo: p.motivoModeracao || "",
criadoEm: p.createdAt ? new Date(p.createdAt).toLocaleString("pt-BR") : "agora"
}));
res.json({
resumo: {
pendentes: posts.filter(p => p.status === "pendente").length,
denuncias: posts.filter(p => p.status === "denunciada").length,
aprovados: posts.filter(p => p.status === "aprovada").length,
riscoMedio: posts.length ? Math.round(posts.reduce((a, p) => a + Number(p.risco || 0), 0) / posts.length) : 0
},
posts
});
} catch {
res.status(500).json({ erro: "moderacao_error" });
}
});
app.post("/api/moderacao/posts/:id/aprovar", adminAuth, async (req, res) => {
try {
const post = await Post.findByIdAndUpdate(req.params.id, { status: "aprovada" }, { new: true });
io.emit("post_aprovado", post);
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "aprovar_error" });
}
});
app.delete("/api/moderacao/posts/:id/remover", adminAuth, async (req, res) => {
try {
await Post.findByIdAndUpdate(req.params.id, { status: "removida" });
io.emit("post_removido", { id: req.params.id });
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "remover_error" });
}
});
/* PAGAMENTOS */
app.get("/api/pagamentos", adminAuth, async (req, res) => {
try {
const lista = await Pagamento.find().sort({ createdAt: -1 }).lean();
res.json({
resumo: {
receitaTotal: lista.filter(p => p.status === "aprovado").reduce((a, p) => a + Number(p.valor || 0), 0),
receitaChange: 0,
aprovados: lista.filter(p => p.status === "aprovado").length,
pendentes: lista.filter(p => p.status === "pendente").length,
recusados: lista.filter(p => p.status === "recusado").length
},
pagamentos: lista.map(p => ({
id: p._id,
empresa: p.empresa,
email: p.email,
plano: p.plano,
valor: p.valor,
metodo: p.metodo,
status: p.status,
ultimaCobranca: p.ultimaCobranca ? new Date(p.ultimaCobranca).toLocaleString("pt-BR") : "-"
}))
});
} catch {
res.status(500).json({ erro: "pagamentos_error" });
}
});
app.post("/api/pagamentos/nova", adminAuth, async (req, res) => {
try {
const pagamento = await Pagamento.create({
empresaId: req.body.empresaId || "",
empresa: validator.escape(req.body.empresa || "Empresa Flux"),
email: validator.escape(req.body.email || ""),
plano: validator.escape(req.body.plano || "Premium"),
valor: Number(req.body.valor || 0),
metodo: validator.escape(req.body.metodo || "PIX"),
status: req.body.status || "pendente"
});
res.json({ ok: true, pagamento });
} catch {
res.status(500).json({ erro: "nova_cobranca_error" });
}
});
app.post("/api/pagamentos/:id/aprovar", adminAuth, async (req, res) => {
try {
const pagamento = await Pagamento.findByIdAndUpdate(
req.params.id,
{ status: "aprovado", ultimaCobranca: new Date() },
{ new: true }
);
if (pagamento?.empresaId) {
await Empresa.findByIdAndUpdate(pagamento.empresaId, {
plano: pagamento.plano,
assinaturaStatus: "ativo",
ativo: true,
receita: Number(pagamento.valor || 0)
});
}
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "aprovar_pagamento_error" });
}
});
app.post("/api/pagamentos/:id/cancelar", adminAuth, async (req, res) => {
try {
await Pagamento.findByIdAndUpdate(req.params.id, { status: "recusado" });
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "cancelar_pagamento_error" });
}
});

/* COMMERCE TURBO - PRODUTO + FOTOS + POST */
app.post(
  "/api/commerce/postar-produto",
  auth,
  carregarPlano,
  requireEmpresaPaga,
  verificarRecurso("podeProduto"),
  upload.array("medias", 10),
  async (req, res) => {
    try {
      const files = (req.files || []).map(f => {
        return f.mimetype.startsWith("video")
          ? "videos/" + f.filename
          : "images/" + f.filename;
      });

      const imagemPrincipal = files.find(f => !f.includes("videos/")) || files[0] || "";
      const videoPrincipal = files.find(f => f.includes("videos/")) || "";

      const produto = await Produto.create({
        empresaId: String(req.user.id),
        empresaNome: req.user.nome || req.user.empresa || "Empresa Flux",
        nome: cleanText(req.body.nome || req.body.titulo || "Produto Flux", 120),
        descricao: cleanText(req.body.descricao || "", 2000),
        preco: Number(req.body.preco || 0),
        precoPromocional: Number(req.body.precoPromocional || 0),
        estoque: Number(req.body.estoque || 1),
        categoria: cleanText(req.body.categoria || "Produto", 80),
        imagem: imagemPrincipal,
        imagens: files,
        video: videoPrincipal,
        link: cleanText(req.body.link || "", 500),
        marketplace: cleanText(req.body.marketplace || "flux", 80),
        ativo: true
      });

      const post = await Post.create({
        empresaId: String(req.user.id),
        empresaNome: req.user.nome || req.user.empresa || "Empresa Flux",
        descricao: cleanText(req.body.postDescricao || req.body.descricao || produto.nome, 2000),
        media: videoPrincipal || imagemPrincipal,
        medias: files,
        tipo: "feed",
        produtoId: String(produto._id),
        produtoNome: produto.nome,
        produtoPreco: Number(produto.precoPromocional || produto.preco || 0),
        produtoImagem: imagemPrincipal,
        produtoLink: produto.link || "/flux-produto/" + produto._id,
        status: "aprovada"
      });

      const normalized = normalizePost(post);
      io.emit("novo_post", normalized);

      res.json({ ok: true, produto, post: normalized });
    } catch (err) {
      console.log("commerce postar produto:", err);
      res.status(500).json({ erro: "commerce_postar_produto_error" });
    }
  }
);



 /* PRODUTOS / MARKETPLACE */
app.get("/api/produtos", async (req, res) => {
try {
const produtos = await Produto.find({ ativo: true }).sort({ createdAt: -1 }).limit(100).lean();
res.json(produtos);
} catch (err) {
res.status(500).json({ erro: "produtos_error" });
}
});
app.post("/api/produtos", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
try {
const produto = await Produto.create({
empresaId: String(req.empresa._id),
empresaNome: req.empresa.nome,
nome: cleanText(req.body.nome, 120),
descricao: cleanText(req.body.descricao, 500),
preco: Number(req.body.preco || 0),
precoPromocional: Number(req.body.precoPromocional || 0),
custo: Number(req.body.custo || 0),
estoque: Number(req.body.estoque || 0),
sku: cleanText(req.body.sku, 80),
categoria: cleanText(req.body.categoria || "geral", 120),
imagem: cleanText(req.body.imagem, 500),
video: cleanText(req.body.video, 500),
link: cleanText(req.body.link, 500),
tamanhos: Array.isArray(req.body.tamanhos) ? req.body.tamanhos.map(t => cleanText(t, 30)) : String(req.body.tamanhos || "").split(",").map(t => cleanText(t, 30)).filter(Boolean),
cores: Array.isArray(req.body.cores) ? req.body.cores.map(c => cleanText(c, 30)) : String(req.body.cores || "").split(",").map(c => cleanText(c, 30)).filter(Boolean),
destaque: Boolean(req.body.destaque),
ativo: true
});
res.json({ ok: true, produto });
} catch (err) {
console.log(err);
res.status(500).json({ erro: "produto_create_error" });
}
});
app.put("/api/produtos/:id", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
try {
const produto = await Produto.findOneAndUpdate(
{ _id: req.params.id, empresaId: String(req.user.id) },
{
nome: cleanText(req.body.nome, 120),
descricao: cleanText(req.body.descricao, 500),
preco: Number(req.body.preco || 0),
precoPromocional: Number(req.body.precoPromocional || 0),
custo: Number(req.body.custo || 0),
estoque: Number(req.body.estoque || 0),
sku: cleanText(req.body.sku, 80),
categoria: cleanText(req.body.categoria || "geral", 120),
imagem: cleanText(req.body.imagem, 500),
video: cleanText(req.body.video, 500),
link: cleanText(req.body.link, 500),
tamanhos: Array.isArray(req.body.tamanhos) ? req.body.tamanhos.map(t => cleanText(t, 30)) : String(req.body.tamanhos || "").split(",").map(t => cleanText(t, 30)).filter(Boolean),
cores: Array.isArray(req.body.cores) ? req.body.cores.map(c => cleanText(c, 30)) : String(req.body.cores || "").split(",").map(c => cleanText(c, 30)).filter(Boolean),
destaque: Boolean(req.body.destaque),
ativo: req.body.ativo !== false
},
{ new: true }
);
if (!produto) return res.status(404).json({ erro: "produto_nao_encontrado" });
res.json({ ok: true, produto });
} catch {
res.status(500).json({ erro: "produto_update_error" });
}
});
app.delete("/api/produtos/:id", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
try {
await Produto.findOneAndUpdate({ _id: req.params.id, empresaId: String(req.user.id) }, { ativo: false });
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "produto_delete_error" });
}
});
/* PEDIDOS / ESTOQUE FLUX COMMERCE */
app.get("/api/meus-produtos", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
try {
const produtos = await Produto.find({ empresaId: String(req.user.id) }).sort({ createdAt: -1 }).lean();
res.json({ ok: true, produtos });
} catch {
res.status(500).json({ erro: "meus_produtos_error" });
}
});
app.post("/api/pedidos", optionalAuth, async (req, res) => {
const session = await mongoose.startSession();
session.startTransaction();
try {
const produtosRecebidos = Array.isArray(req.body.produtos) ? req.body.produtos : [];
if (!produtosRecebidos.length) {
await session.abortTransaction();
return res.status(400).json({ erro: "pedido_sem_produtos" });
}
const itens = [];
let subtotal = 0;
let empresaId = "";
let empresaNome = "Flux";
for (const item of produtosRecebidos) {
const produtoId = String(item.produtoId || item.id || "");
const quantidade = Math.max(1, Number(item.quantidade || 1));
if (!isValidObjectId(produtoId)) {
throw new Error("produto_invalido");
}
const produto = await Produto.findOne({ _id: produtoId, ativo: true }).session(session);
if (!produto) {
throw new Error("produto_nao_encontrado");
}
if (Number(produto.estoque || 0) < quantidade) {
throw new Error(`estoque_insuficiente:${produto.nome}`);
}
const precoFinal = Number(produto.precoPromocional || 0) > 0
? Number(produto.precoPromocional)
: Number(produto.preco || 0);
produto.estoque = Number(produto.estoque || 0) - quantidade;
produto.vendido = Number(produto.vendido || 0) + quantidade;
await produto.save({ session });
empresaId = produto.empresaId || empresaId;
empresaNome = produto.empresaNome || empresaNome;
itens.push({
produtoId: String(produto._id),
nome: produto.nome,
preco: precoFinal,
quantidade,
imagem: produto.imagem || "",
tamanho: cleanText(item.tamanho, 30),
cor: cleanText(item.cor, 30)
});
subtotal += precoFinal * quantidade;
}
const frete = Number(req.body.frete || 0);
const total = subtotal + frete;
const pedido = await Pedido.create([{
empresaId,
empresaNome,
clienteId: req.user?.id || "",
clienteNome: cleanText(req.body.clienteNome || req.body.nome, 120),
clienteEmail: cleanEmail(req.body.clienteEmail || req.body.email),
clienteWhatsapp: cleanText(req.body.clienteWhatsapp || req.body.whatsapp, 40),
endereco: {
rua: cleanText(req.body.rua, 120),
numero: cleanText(req.body.numero, 30),
bairro: cleanText(req.body.bairro, 120),
cidade: cleanText(req.body.cidade, 120),
estado: cleanText(req.body.estado, 40),
cep: cleanText(req.body.cep, 20),
complemento: cleanText(req.body.complemento, 120)
},
produtos: itens,
subtotal,
frete,
total,
pagamento: cleanText(req.body.pagamento || "pix", 30),
status: "pendente",
pago: false
}], { session });
await session.commitTransaction();
io.emit("pedido:new", pedido[0]);
res.json({ ok: true, pedido: pedido[0] });
} catch (err) {
await session.abortTransaction();
console.log("pedido erro:", err.message);
res.status(400).json({ erro: "pedido_error", mensagem: err.message });
} finally {
session.endSession();
}
});
app.get("/api/pedidos", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
try {
const pedidos = await Pedido.find({ empresaId: String(req.user.id) }).sort({ createdAt: -1 }).limit(200).lean();
res.json({ ok: true, pedidos });
} catch {
res.status(500).json({ erro: "pedidos_error" });
}
});
app.put("/api/pedidos/:id/status", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
try {
const statusPermitidos = ["pendente", "pago", "separando", "enviado", "entregue", "cancelado"];
const status = String(req.body.status || "pendente");
if (!statusPermitidos.includes(status)) {
return res.status(400).json({ erro: "status_invalido" });
}
const pedido = await Pedido.findOneAndUpdate(
{ _id: req.params.id, empresaId: String(req.user.id) },
{
status,
codigoRastreio: cleanText(req.body.codigoRastreio, 120),
etiquetaEnvio: cleanText(req.body.etiquetaEnvio, 500),
pago: Boolean(req.body.pago)
},
{ new: true }
);
if (!pedido) return res.status(404).json({ erro: "pedido_nao_encontrado" });
io.emit("pedido:update", pedido);
res.json({ ok: true, pedido });
} catch {
res.status(500).json({ erro: "pedido_status_error" });
}
});
app.get("/api/estoque/resumo", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
try {
const produtos = await Produto.find({ empresaId: String(req.user.id), ativo: true }).lean();
const pedidos = await Pedido.find({ empresaId: String(req.user.id) }).lean();
const estoqueTotal = produtos.reduce((acc, p) => acc + Number(p.estoque || 0), 0);
const vendidos = produtos.reduce((acc, p) => acc + Number(p.vendido || 0), 0);
const baixoEstoque = produtos.filter(p => Number(p.estoque || 0) <= 3);
const receitaPedidos = pedidos
.filter(p => ["pago", "separando", "enviado", "entregue"].includes(p.status))
.reduce((acc, p) => acc + Number(p.total || 0), 0);
res.json({
ok: true,
resumo: {
produtos: produtos.length,
estoqueTotal,
vendidos,
baixoEstoque: baixoEstoque.length,
pedidos: pedidos.length,
receitaPedidos
},
baixoEstoque
});
} catch {
res.status(500).json({ erro: "estoque_resumo_error" });
}
});

 
app.get("/api/follow-status/:empresaId", optionalAuth, async (req,res)=>{
  try{
    const empresaId = String(req.params.empresaId);
    const seguidores = await Follow.countDocuments({empresaId});

    let seguindo = false;

    if(req.user && req.user.id){
      seguindo = !!(await Follow.findOne({
        clienteId:String(req.user.id),
        empresaId
      }));
    }

    return res.json({ok:true,empresaId,seguidores,seguindo});
  }catch(e){
    console.log("follow status:",e);
    return res.status(500).json({erro:"follow_status_error"});
  }
});



app.get("/api/empresa-stats/:empresaId", async (req,res)=>{

  try{

    const empresaId = String(req.params.empresaId);

    const posts = await Post.find({
      empresaId,
      status:{ $ne:"removida" }
    }).lean();

    const views = posts.reduce((a,p)=>a + Number(p.views || 0),0);
    const likes = posts.reduce((a,p)=>a + Number(p.likes || 0),0);
    const saves = posts.reduce((a,p)=>a + Number(p.saves || 0),0);
    const shares = posts.reduce((a,p)=>a + Number(p.shares || 0),0);

    return res.json({
      ok:true,
      empresaId,
      posts:posts.length,
      views,
      likes,
      saves,
      shares
    });

  }catch(e){

    console.log("empresa stats:",e);

    return res.status(500).json({
      erro:"empresa_stats_error"
    });

  }

});

/* SEGUIR EMPRESA */
app.post("/api/follow/:empresaId", auth, carregarPlano, verificarRecurso("podeSeguir"), async (req, res) => {
try {
const empresaId = req.params.empresaId;
if (!isValidObjectId(empresaId)) return res.status(400).json({ erro: "empresa_invalida" });
const empresa = await Empresa.findOne({ _id: empresaId, tipoConta: "empresa", ativo: true });
if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
const exists = await Follow.findOne({ clienteId: String(req.user.id), empresaId });
if (exists) return res.json({ ok: true, seguindo: true });
await Follow.create({ clienteId: String(req.user.id), empresaId });
res.json({ ok: true, seguindo: true });
} catch {
res.status(500).json({ erro: "follow_error" });
}
});
/* INBOX SIMPLES */
app.post("/api/inbox/send", auth, carregarPlano, async (req, res) => {
try {
const toId = String(req.body.toId || "");
const texto = cleanText(req.body.texto, 1000);
if (!isValidObjectId(toId) || !texto) return res.status(400).json({ erro: "mensagem_invalida" });
const destino = await Empresa.findById(toId);
if (!destino) return res.status(404).json({ erro: "destinatario_nao_encontrado" });
const msg = await Mensagem.create({
fromId: String(req.user.id),
toId,
texto
});
io.emit("inbox:new", msg);
res.json({ ok: true, mensagem: msg });
} catch (err) {
console.log(err);
res.status(500).json({ erro: "inbox_send_error" });
}
});
app.get("/api/inbox", auth, async (req, res) => {
try {
const id = String(req.user.id);
const mensagens = await Mensagem.find({ $or: [{ fromId: id }, { toId: id }] })
.sort({ createdAt: -1 })
.limit(100)
.lean();
res.json({ ok: true, mensagens });
} catch {
res.status(500).json({ erro: "inbox_error" });
}
});
/* LEADS */
app.get("/api/leads", adminAuth, async (req, res) => {
try {
const leads = await Lead.find().sort({ createdAt: -1 }).limit(300).lean();
res.json({ ok: true, leads });
} catch {
res.status(500).json({ erro: "leads_error" });
}
});
/* HEALTH */
app.get("/api/health", (req, res) => {
res.json({
ok: true,
app: "Flux",
mongo: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
stripe: Boolean(process.env.STRIPE_SECRET_KEY),
onlineUsers: users.size,
horario: new Date()
});
});
/* ONLINE */
app.get("/online", (req, res) => {
res.json({ onlineUsers: users.size });
});
app.get("/seed-demo-flux", async (req, res) => {
try {
const count = await Post.countDocuments();
if (count > 0) {
return res.json({ ok: true, mensagem: "Jï¿½ existem posts no feed.", total: count });
}
await Post.create([
{
empresaNome: "Premium Soles",
descricao: "Lanï¿½amento beta da Flux: moda, marketplace e vï¿½deos em uma experiï¿½ncia mobile.",
media: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900",
tipo: "feed",
status: "aprovada",
likes: 12,
views: 230
},
{
empresaNome: "Flux",
descricao: "Fluxo vertical ativo. Testando a experiï¿½ncia estilo app.",
media: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900",
tipo: "feed",
status: "aprovada",
likes: 34,
views: 520
}
]);
res.json({ ok: true, mensagem: "Posts demo criados." });
} catch (err) {
console.error("ERRO SEED DEMO:", err);
res.status(500).json({
ok: false,
erro: "seed_demo_error",
detalhe: err.message
});
}
});
/* SEED ADMIN TESTE */
app.post("/admin/seed", adminAuth, async (req, res) => {
try {
const count = await Empresa.countDocuments();
if (count === 0) {
await Empresa.create([
{
nome: "Premium Soles",
responsavel: "Admin",
telefone: "17992042563",
email: "premium@email.com",
senha: await bcrypt.hash("123456", 10),
segmento: "Moda",
tipoConta: "empresa",
plano: "Premium",
ativo: true,
online: true
},
{
nome: "Urban Vision",
responsavel: "Admin",
telefone: "17992042563",
email: "urban@email.com",
senha: await bcrypt.hash("123456", 10),
segmento: "Moda",
tipoConta: "empresa",
plano: "Start",
ativo: true,
online: false
}
]);
}
res.json({ ok: true });
} catch {
res.status(500).json({ erro: "seed_error" });
}
});
 
/* ROTAS DE Pï¿½ï¿½GINAS */
const pageRoutes = {
"/": "login.html",
"/login": "login.html",
"/notificacoes": "notificacoes.html",
"/notificacao": "notificacoes.html",
"/notifications": "notificacoes.html",
"/feed": "feed.html",
"/fluxo": "fluxo.html",
"/painel": "painel.html",
"/marketplace": "marketplace.html",
"/admin": "admin.html",
"/cadastro": "cadastro.html",
"/cadastro-cliente": "cadastro-cliente.html",
"/cadastro-empresa": "cadastro-empresa.html",
"/empresa": "empresa.html",
"/empresa.html": "empresa.html",
"/montar-perfil": "montar-perfil.html",
"/editar-perfil": "editar-perfil.html",
"/minha-loja": "minha-loja.html",
"/minhas-compras": "minhas-compras.html",
"/planos": "planos.html",
"/posts": "posts.html",
"/produtos": "produtos.html",
"/pedidos": "pedidos.html",
"/chat": "chat.html",
"/buscar": "buscar.html",
"/explorar": "explorar.html",
"/analytics": "analytics.html",
"/leads": "leads.html",
"/ranking": "ranking.html",
"/trends": "trends.html",
"/notificacoes": "notificacoes.html",
"/notificacao": "notificacao.html",
"/obrigado": "obrigado.html",
"/pagamento": "pagamento.html",
"/recuperar-senha": "recuperar-senha.html",
"/redefinir-senha": "redefinir-senha.html",
"/admin-empresas": "admin-empresas.html",
"/admin-moderacao": "admin-moderacao.html",
"/admin-pagamentos": "admin-pagamentos.html",
"/admin-relatorios": "admin-relatorios.html"
};
 
Object.entries(pageRoutes).forEach(([route, fileName]) => {
app.get(route, (req, res) => {
const filePath = path.join(publicPath, fileName);
if (fs.existsSync(filePath)) {
return res.sendFile(filePath);
}
 
if (route === "/") {
return res.status(404).send("ROTA_NAO_EXISTE");
}
 
return res.status(404).send("Pï¿½gina nï¿½o encontrada: " + fileName);
});
});
 
/* RECUPERAï¿½ï¿½ï¿½O DE SENHA */
function createMailTransporter() {
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
return null;
}
 
return nodemailer.createTransport({
service: process.env.EMAIL_SERVICE || "gmail",
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});
}
 
app.post(["/api/recuperar-senha", "/empresa/recuperar"], async (req, res) => {
try {
const email = cleanEmail(req.body.email);
 
if (!validator.isEmail(email)) {
return res.status(400).json({
erro: "email_invalido",
mensagem: "Digite um e-mail vï¿½lido."
});
}
 
const user = await Empresa.findOne({ email });
 
const respostaPadrao = {
ok: true,
mensagem: "Se o e-mail existir, enviaremos as instruï¿½ï¿½es de recuperaï¿½ï¿½o."
};
 
if (!user) {
return res.json(respostaPadrao);
}
 
const resetToken = jwt.sign(
{ id: String(user._id), email: user.email, tipo: "reset_senha" },
JWT_SECRET,
{ expiresIn: "15m" }
);
 
const link = `${BASE_URL}/redefinir-senha?token=${encodeURIComponent(resetToken)}`;
 
const transporter = createMailTransporter();
 
if (transporter) {
await transporter.sendMail({
from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
to: email,
subject: "Recuperaï¿½ï¿½o de senha FLUX",
html: `
<div style="background:#020617;color:white;padding:40px;font-family:Arial,sans-serif">
<h1 style="margin:0 0 16px">FLUX</h1>
<p>Recebemos uma solicitaï¿½ï¿½o para redefinir sua senha.</p>
<p>Esse link expira em 15 minutos.</p>
<a href="${link}" style="display:inline-block;padding:14px 22px;background:#00d9ff;color:#020617;text-decoration:none;border-radius:14px;font-weight:800">
Redefinir senha
</a>
</div>
`
});
} else {
console.log("Link de recuperaï¿½ï¿½o gerado:", link);
}
 
return res.json(respostaPadrao);
} catch (err) {
console.log("recuperar senha:", err);
return res.status(500).json({
erro: "erro_recuperar_senha",
mensagem: "Nï¿½o foi possï¿½vel processar a solicitaï¿½ï¿½o."
});
}
});
 
app.post(["/api/redefinir-senha", "/empresa/redefinir"], async (req, res) => {
try {
const token = String(req.body.token || req.query.token || "");
const novaSenha = String(req.body.senha || req.body.novaSenha || "");
 
if (!token) {
return res.status(400).json({ erro: "token_obrigatorio" });
}
 
if (novaSenha.length < 6) {
return res.status(400).json({
erro: "senha_fraca",
mensagem: "Use pelo menos 6 caracteres."
});
}
 
let decoded;
 
try {
decoded = jwt.verify(token, JWT_SECRET);
} catch {
return res.status(403).json({
erro: "token_invalido_ou_expirado"
});
}
 
if (decoded.tipo !== "reset_senha" || !decoded.id) {
return res.status(403).json({
erro: "token_invalido"
});
}
 
const senha = await bcrypt.hash(novaSenha, 10);
 
const user = await Empresa.findByIdAndUpdate(
decoded.id,
{ senha, ultimaAtividade: new Date() },
{ new: true }
);
 
if (!user) {
return res.status(404).json({
erro: "usuario_nao_encontrado"
});
}
 
return res.json({
ok: true,
mensagem: "Senha redefinida com sucesso."
});
} catch (err) {
console.log("redefinir senha:", err);
return res.status(500).json({
erro: "erro_redefinir_senha"
});
}
});
 
/* ERROR */
app.use((err, req, res, next) => {
const erro = err?.message || "server_error";
console.log("Erro global:", erro);
 
if (["arquivo_invalido", "extensao_invalida", "File too large"].includes(erro)) {
return res.status(400).json({ erro: "upload_bloqueado" });
}
 
if (erro === "cors_bloqueado") {
return res.status(403).json({ erro: "origem_bloqueada" });
}
 
return res.status(500).json({ erro: "server_error" });
});
 
/* FALLBACK */
 
/* START */
 
/* FORCE FIX NOTIFICACOES ANTES DO START */
app.get("/notificacoes", (req,res) => {
return res.status(200).sendFile(path.join(publicPath, "notificacoes.html"));
});
 
app.get("/notificacao", (req,res) => {
return res.redirect("/notificacoes");
});
 
app.get("/notifications", (req,res) => {
return res.redirect("/notificacoes");
});
 
/* MERCADO PAGO CHECKOUT REAL - PIX + CARTÃƒO */
app.post("/api/mercadopago/checkout", async (req,res)=>{
 
 try{
 
  const { titulo, preco, plano } = req.body;
 
  const valorFinal = Number(preco || 39.90);
 
  const tituloFinal =
   titulo || ("Flux " + (plano || "Basic"));
 
  const preference = {
 
   items:[{
    title: tituloFinal,
    quantity:1,
    currency_id:"BRL",
    unit_price: valorFinal
   }],
 
   payment_methods:{
    installments:12,
    excluded_payment_types:[],
    excluded_payment_methods:[]
   },
 
   back_urls:{
    success:
     process.env.BASE_URL +
     "/obrigada.html?mp=approved",
 
    failure:
     process.env.BASE_URL +
     "/pagamento.html?erro=mp",
 
    pending:
     process.env.BASE_URL +
     "/obrigada.html?mp=pending"
   },
 
   auto_return:"approved",
 
   notification_url:
    process.env.BASE_URL +
    "/api/mercadopago/webhook"
  };
 
  const response = await mpPreference.create({
   body: preference
  });
 
  const initPoint =
   response?.init_point ||
   response?.body?.init_point ||
   response?.sandbox_init_point ||
   response?.body?.sandbox_init_point;
 
  if(!initPoint){
 
   console.log(
    "MP RESPONSE SEM INIT_POINT:",
    response
   );
 
   return res.status(500).json({
    erro:true,
    mensagem:
     "Mercado Pago nÃ£o retornou init_point"
   });
 
  }
 
  return res.json({
   ok:true,
   init_point:initPoint
  });
 
 }catch(err){
 
  console.log("mercadopago:",err);
 
  return res.status(500).json({
   erro:true,
   mensagem: err.message
  });
 
 }
 
});
/* WEBHOOK MERCADO PAGO - CONFIRMAï¿½ï¿½O REAL DO PAGAMENTO */
app.post("/api/mercadopago/webhook", async (req,res)=>{
try {
console.log("WEBHOOK MP:", req.body, req.query);
const paymentId =
req.body?.data?.id ||
req.body?.id ||
req.query?.["data.id"] ||
req.query?.id ||
"";
if (!paymentId) {
return res.sendStatus(200);
}
const mpResponse = await fetch(
"https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId),
{
method: "GET",
headers: {
Authorization: "Bearer " + process.env.MERCADOPAGO_ACCESS_TOKEN
}
}
);
const pagamento = await mpResponse.json();
console.log("WEBHOOK MP PAYMENT:", pagamento);
if (!mpResponse.ok) {
return res.sendStatus(200);
}
const metadata = pagamento.metadata || {};
const empresaId = metadata.empresaId || metadata.empresa_id || "";
const plano = String(metadata.plano || "Basic")
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "");
const statusMP = pagamento.status || "pending";
const statusFlux =
statusMP === "approved"
? "aprovado"
: (["pending", "in_process", "in_mediation"].includes(statusMP) ? "pendente" : "recusado");
let empresa = null;
if (empresaId && mongoose.Types.ObjectId.isValid(String(empresaId))) {
empresa = await Empresa.findById(empresaId);
}
if (empresa && statusFlux === "aprovado") {
empresa.plano = plano;
empresa.assinaturaStatus = "ativo";
empresa.ativo = true;
empresa.receita = Number(pagamento.transaction_amount || 0);
empresa.ultimaAtividade = new Date();
await empresa.save();
}
if (empresa && statusFlux !== "aprovado") {
empresa.assinaturaStatus = statusFlux === "pendente" ? "pendente" : "recusado";
empresa.ultimaAtividade = new Date();
await empresa.save();
}
await registrarPagamentoMercadoPago({
empresaId: empresa ? String(empresa._id) : empresaId,
empresaNome: empresa?.nome || "Empresa Flux",
email: empresa?.email || pagamento.payer?.email || "",
plano,
valor: Number(pagamento.transaction_amount || 0),
metodo: pagamento.payment_method_id || "Mercado Pago",
status: statusFlux,
mpPaymentId: pagamento.id
});
return res.sendStatus(200);
} catch (err) {
console.log("WEBHOOK MP ERROR:", err.message);
return res.sendStatus(200);
}
});
 
/* =========================
CARTEIRA FLUX
========================= */
 
const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", new mongoose.Schema({
 
userId:String,
tipoConta:String,
 
saldoDisponivel:{
type:Number,
default:0
},
 
saldoPendente:{
type:Number,
default:0
},
 
totalRecebido:{
type:Number,
default:0
},
 
totalGasto:{
type:Number,
default:0
},
 
moeda:{
type:String,
default:"BRL"
},
 
ativa:{
type:Boolean,
default:true
}
 
},{timestamps:true}));
 
 
const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", new mongoose.Schema({
 
userId:String,
 
tipo:String,
 
descricao:String,
 
valor:Number,
 
status:{
type:String,
default:"pendente"
},
 
metodo:String,
 
referencia:String
 
},{timestamps:true}));
 
 
/* CRIAR / PEGAR CARTEIRA */
app.get("/api/wallet/:userId", async (req,res)=>{
 
try{
 
let wallet = await Wallet.findOne({
userId:req.params.userId
});
 
if(!wallet){
 
wallet = await Wallet.create({
userId:req.params.userId,
tipoConta:"usuario"
});
 
}
 
return res.json({
ok:true,
wallet
});
 
}catch(err){
 
console.log("wallet:",err);
 
return res.status(500).json({
erro:true,
mensagem:err.message
});
 
}
 
});
 
 
/* HISTï¿½RICO */
app.get("/api/wallet/:userId/transacoes", async (req,res)=>{
 
try{
 
const transacoes =
await WalletTransaction
.find({userId:req.params.userId})
.sort({_id:-1})
.limit(100);
 
return res.json({
ok:true,
transacoes
});
 
}catch(err){
 
console.log("wallet transacoes:",err);
 
return res.status(500).json({
erro:true
});
 
}
 
});
 
 
/* CREDITAR */
app.post("/api/wallet/creditar", async (req,res)=>{
 
try{
 
const {
userId,
valor,
descricao,
metodo
} = req.body;
 
let wallet =
await Wallet.findOne({userId});
 
if(!wallet){
 
wallet = await Wallet.create({
userId
});
 
}
 
wallet.saldoDisponivel += Number(valor || 0);
wallet.totalRecebido += Number(valor || 0);
 
await wallet.save();
 
await WalletTransaction.create({
 
userId,
 
tipo:"credito",
 
descricao:
descricao || "Crï¿½dito carteira",
 
valor:Number(valor || 0),
 
status:"aprovado",
 
metodo:
metodo || "manual"
 
});
 
return res.json({
ok:true,
wallet
});
 
}catch(err){
 
console.log("wallet credito:",err);
 
return res.status(500).json({
erro:true
});
 
}
 
});
 
 
/* DEBITAR */
app.post("/api/wallet/debitar", async (req,res)=>{
 
try{
 
const {
userId,
valor,
descricao,
metodo
} = req.body;
 
const wallet =
await Wallet.findOne({userId});
 
if(!wallet){
 
return res.status(404).json({
erro:"wallet_nao_encontrada"
});
 
}
 
if(wallet.saldoDisponivel < Number(valor || 0)){
 
return res.status(400).json({
erro:"saldo_insuficiente"
});
 
}
 
wallet.saldoDisponivel -= Number(valor || 0);
wallet.totalGasto += Number(valor || 0);
 
await wallet.save();
 
await WalletTransaction.create({
 
userId,
 
tipo:"debito",
 
descricao:
descricao || "Dï¿½bito carteira",
 
valor:Number(valor || 0),
 
status:"aprovado",
 
metodo:
metodo || "manual"
 
});
 
return res.json({
ok:true,
wallet
});
 
}catch(err){
 
console.log("wallet debito:",err);
 
return res.status(500).json({
erro:true
});
 
}
 
});
 
/* =========================
MERCADO LIVRE LOGIN
========================= */
 
 
 
 
 
 
/* MERCADO LIVRE IMPORTADOR DE PRODUTOS */
const MLIntegration = mongoose.models.MLIntegration || mongoose.model("MLIntegration", new mongoose.Schema({
userId:String,
accessToken:String,
refreshToken:String,
expiresIn:Number,
tokenType:String,
ativo:{type:Boolean,default:true}
},{timestamps:true}));
 
app.get("/api/ml/produtos", async (req,res)=>{
try{
const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
 
if(!ml || !ml.accessToken){
return res.status(400).json({erro:"mercado_livre_nao_conectado"});
}
 
const userRes = await fetch("https://api.mercadolibre.com/users/me",{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const user = await userRes.json();
 
const itemsRes = await fetch("https://api.mercadolibre.com/users/" + user.id + "/items/search",{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const itemsData = await itemsRes.json();
const ids = (itemsData.results || []).slice(0,20);
 
if(!ids.length){
return res.json({ok:true, vendedor:user, produtos:[]});
}
 
const detailsRes = await fetch("https://api.mercadolibre.com/items?ids=" + ids.join(","),{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const details = await detailsRes.json();
 
const produtos = details.map(x => x.body).filter(Boolean).map(item => ({
mlId:item.id,
titulo:item.title,
preco:item.price,
estoque:item.available_quantity,
imagem:item.thumbnail,
status:item.status,
vendedor:{
id:user.id,
nickname:user.nickname,
reputacao:user.seller_reputation || {}
},
linkFlux:"/go/ml/" + item.id
}));
 
return res.json({ok:true, vendedor:user, produtos});
 
}catch(err){
console.log("ML PRODUTOS ERRO:",err);
return res.status(500).json({erro:err.message});
}
});
 
app.get("/go/ml/:id",(req,res)=>{
 
 try{
 
  const fs = require("fs");
 
  const banco = JSON.parse(
   fs.readFileSync("data/afiliados/produtos-afiliados.json","utf8")
  );
 
  const produto = (banco.produtos || []).find(
   p => String(p.id) === String(req.params.id)
  );
 
  if(!produto || !produto.url){
   return res.status(404).send("produto afiliado nao encontrado");
  }
 
  console.log("LINK AFILIADO:", produto.url);
 
  return res.redirect(produto.url);
 
 }catch(e){
 
  console.log(e);
 
  return res.status(500).send("erro afiliado");
 
 }
 
});
 
/* MERCADO LIVRE PUBLICO - SEM OAUTH */
app.get("/api/ml/buscar", async (req,res)=>{
try{
const q = String(req.query.q || "moda feminina").trim();
 
const r = await fetch(
  "https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(q) + "&limit=50&sort=sold_quantity_desc",
  {
    headers: {
      "Accept": "application/json",
      "User-Agent": "FluxApp/1.0 beta123soares@gmail.com"
    }
  }
);
const data = await r.json();
 
const produtos = ((Array.isArray(data.results) ? data.results : [])).map(p=>({
mlId:p.id,
titulo:p.title,
preco:p.price,
imagem:p.thumbnail,
link:p.permalink,
vendedor:p.seller || {},
linkFlux:"/go-public/ml/" + p.id
}));
 
return res.json({ok:true, busca:q, produtos});
}catch(err){
return res.status(500).json({ok:false, erro:err.message});
}
});
 
app.get("/go-public/ml/:id", async (req,res)=>{
try{
const r = await fetch("https://api.mercadolibre.com/items/" + req.params.id);
const item = await r.json();
if(item?.permalink){
return res.redirect(item.permalink);
}
return res.redirect("/marketplace");
}catch(e){
return res.redirect("/marketplace");
}
});
 
 
/* MERCADO LIVRE OFICIAL - 50 PRODUTOS/PERFIS */
app.get("/api/ml/oficial/50-perfis", async (req,res)=>{
  try{
    const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
 
    if(!ml || !ml.accessToken){
      return res.status(400).json({
        ok:false,
        erro:"mercado_livre_nao_conectado"
      });
    }
 
    const userRes = await fetch("https://api.mercadolibre.com/users/me",{
      headers:{ Authorization:"Bearer " + ml.accessToken }
    });
 
    const user = await userRes.json();
 
    const itemsRes = await fetch(
      "https://api.mercadolibre.com/users/" + user.id + "/items/search?limit=50",
      { headers:{ Authorization:"Bearer " + ml.accessToken } }
    );
 
    const itemsData = await itemsRes.json();
    const ids = Array.isArray(itemsData.results) ? itemsData.results.slice(0,50) : [];
 
    const produtos = [];
 
    for(const id of ids){
      const r = await fetch("https://api.mercadolibre.com/items/" + id,{
        headers:{ Authorization:"Bearer " + ml.accessToken }
      });
 
      const p = await r.json();
 
      produtos.push({
        mlId:p.id,
        titulo:p.title,
        preco:p.price,
        imagem:p.thumbnail,
        link:p.permalink,
        vendedorId:user.id,
        vendedorNome:user.nickname,
        status:p.status,
        estoque:p.available_quantity || 0,
        vendidos:p.sold_quantity || 0,
        linkFlux:"/go/ml/" + p.id,
        fonte:"Mercado Livre Oficial"
      });
    }
 
    return res.json({
      ok:true,
      vendedor:user.nickname,
      vendedorId:user.id,
      total:produtos.length,
      produtos
    });
 
  }catch(err){
    return res.status(500).json({
      ok:false,
      erro:err.message
    });
  }
}); 
 
 
/* IMPORTAR LINKS AFILIADOS OFICIAIS ML PARA FLUX */
app.post("/api/ml/afiliados/importar-links", express.json({ limit: "5mb" }), async (req,res)=>{
  try{
    const links = Array.isArray(req.body?.links) ? req.body.links.slice(0,50) : [];
 
    if(!links.length){
      return res.status(400).json({
        ok:false,
        erro:"envie_links",
        exemplo:{
          links:["https://produto.mercadolivre.com.br/MLB-6778297770-camisa-masculina-stay-for-the-tucker-shirt-from-_JM"]
        }
      });
    }
 
    async function expandirLinkMercadoLivre(link){
      const original = String(link || "").trim();
      if(!original) return "";
      if(/MLB-?\d+/i.test(original)) return original;
 
      if(original.includes("meli.la")){
        try{
          const resposta = await fetch(original, {
            method:"GET",
            redirect:"follow",
            signal: AbortSignal.timeout(12000),
            headers:{
              "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "User-Agent":"Mozilla/5.0 FluxAfiliados/1.0"
            }
          });
          return resposta.url || original;
        }catch(e){
          console.log("Erro ao expandir link curto ML:", e.message);
          return original;
        }
      }
 
      return original;
    }
 
    function extrairMLB(link){
      const texto = String(link || "");
      const match = texto.match(/MLB-?(\d+)/i);
      return match ? "MLB" + match[1] : "";
    }
 
    const importados = [];
    const ignorados = [];
 
    for(const linkRecebido of links){
      const linkAfiliado = String(linkRecebido || "").trim();
      const linkExpandido = await expandirLinkMercadoLivre(linkAfiliado);
      const mlId = extrairMLB(linkExpandido) || extrairMLB(linkAfiliado);
 
      if(!mlId){
        ignorados.push({link:linkAfiliado, motivo:"mlb_nao_encontrado"});
        continue;
      }
 
      const itemRes = await fetch("https://api.mercadolibre.com/items/" + mlId, {
        signal: AbortSignal.timeout(12000),
        headers:{
          "Accept":"application/json",
          "User-Agent":"FluxApp/1.0 beta123soares@gmail.com"
        }
      });
      const produtoML = await itemRes.json();
 
      if(!itemRes.ok || !produtoML || produtoML.error){
        ignorados.push({link:linkAfiliado, mlId, motivo:"produto_nao_encontrado", detalhe:produtoML});
        continue;
      }
 
      const sellerId = String(produtoML.seller_id || "");
      if(!sellerId){
        ignorados.push({link:linkAfiliado, mlId, motivo:"seller_nao_encontrado"});
        continue;
      }
 
      let seller = {};
      try{
        const sellerRes = await fetch("https://api.mercadolibre.com/users/" + sellerId, {
          signal: AbortSignal.timeout(12000),
          headers:{
            "Accept":"application/json",
            "User-Agent":"FluxApp/1.0 beta123soares@gmail.com"
          }
        });
        seller = await sellerRes.json();
      }catch(e){
        seller = { id:sellerId, nickname:"Loja Mercado Livre " + sellerId };
      }
 
      const empresaEmail = `ml-${sellerId}@flux-afiliado.local`;
      const nomePerfil = seller.nickname || `Loja ML ${sellerId}`;
      const imagem = String(produtoML.thumbnail || "").replace("http://", "https://");
      const linkFinal = linkAfiliado || produtoML.permalink || linkExpandido;
 
      const perfil = await Empresa.findOneAndUpdate(
        { email: empresaEmail },
        {
          nome: nomePerfil,
          responsavel: "Mercado Livre Afiliado",
          email: empresaEmail,
          cidade: seller.address?.city || "",
          segmento: "Afiliado Mercado Livre",
          tipoConta: "empresa",
          plano: "Start",
          assinaturaStatus: "gratis",
          ativo: true,
          marketplaceAtivo: true,
          bio: "Perfil afiliado automatico com produtos reais do Mercado Livre.",
          site: linkFinal,
          logo: imagem,
          avatar: imagem,
          ultimaAtividade: new Date()
        },
        { upsert:true, new:true, setDefaultsOnInsert:true }
      );
 
      const produto = await Produto.findOneAndUpdate(
        { sku: mlId },
        {
          empresaId: String(perfil._id),
          empresaNome: perfil.nome,
          nome: produtoML.title,
          descricao: produtoML.title,
          preco: Number(produtoML.price || 0),
          estoque: Number(produtoML.available_quantity || 0),
          sku: mlId,
          categoria: produtoML.category_id || "Mercado Livre Afiliado",
          imagem,
          link: linkFinal,
          ativo: true,
          destaque: true
        },
        { upsert:true, new:true, setDefaultsOnInsert:true }
      );
 
      await Post.findOneAndUpdate(
        { empresaId:String(perfil._id), link:linkFinal, tipo:"feed" },
        {
          empresaId:String(perfil._id),
          empresaNome:perfil.nome,
          empresaEmail:perfil.email,
          media: imagem,
          descricao:`${produtoML.title} por R$ ${produtoML.price}`,
          link:linkFinal,
          tipo:"feed",
          status:"aprovada"
        },
        { upsert:true, new:true, setDefaultsOnInsert:true }
      );
 
      importados.push({
        perfil: perfil.nome,
        sellerId,
        mlId,
        produto: produto.nome,
        preco: produto.preco,
        linkAfiliado: linkFinal
      });
    }
 
    return res.json({
      ok:true,
      total:importados.length,
      ignorados:ignorados.length,
      mensagem:"Links afiliados importados para perfis, feed e marketplace.",
      importados,
      detalhesIgnorados:ignorados
    });
 
  }catch(err){
    console.log("IMPORTAR LINKS AFILIADOS ML:", err);
    return res.status(500).json({ok:false,erro:err.message});
  }
});
 
/* DEBUG BUSCA GERAL ML - MOSTRA O 403 QUANDO A API BLOQUEIA /sites/MLB/search */
app.get("/api/ml/debug-busca", async (req,res)=>{
  try{
    const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
    const termo = req.query.q || "celular";
 
    const headers = { Accept:"application/json", "User-Agent":"FluxApp/1.0 beta123soares@gmail.com" };
    if(ml?.accessToken) headers.Authorization = "Bearer " + ml.accessToken;
 
    const r = await fetch(
      "https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(termo) + "&limit=5",
      { headers }
    );
 
    const data = await r.json();
    return res.json({ok:r.ok, status:r.status, termo, data});
  }catch(err){
    return res.status(500).json({ok:false,erro:err.message});
  }
});
 
/* IMPORTAR PRODUTOS ML */
app.get("/api/ml/importar", async (req,res)=>{
try{
const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
 
if(!ml || !ml.accessToken){
return res.status(400).json({erro:"mercado_livre_nao_conectado"});
}
 
const userRes = await fetch("https://api.mercadolibre.com/users/me",{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const user = await userRes.json();
 
const busca = await fetch("https://api.mercadolibre.com/users/" + user.id + "/items/search",{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const dadosBusca = await busca.json();
const ids = dadosBusca.results || [];
const produtos = [];
 
for(const id of ids.slice(0,20)){
const r = await fetch("https://api.mercadolibre.com/items/" + id,{
headers:{Authorization:"Bearer " + ml.accessToken}
});
 
const p = await r.json();
 
produtos.push({
mlId:p.id,
titulo:p.title,
preco:p.price,
imagem:p.thumbnail,
link:p.permalink,
loja:user.nickname,
vendedorId:user.id,
linkFlux:"/go/ml/" + p.id
});
}
 
if(produtos.length){
await mongoose.connection.db.collection("flux_produtos_ml").deleteMany({vendedorId:user.id});
await mongoose.connection.db.collection("flux_produtos_ml").insertMany(produtos);
}
 
return res.json({ok:true,vendedor:user.nickname,total:produtos.length,produtos});
 
}catch(err){
return res.status(500).json({ok:false,erro:err.message});
}
});
/* API AFILIADO */
app.get("/api/afiliado/:id", async (req,res)=>{
 
 try{
 
  const r = await fetch(
   "https://api.mercadolibre.com/items/" + req.params.id
  );
 
  const item = await r.json();
 
  if(!item || item.error){
   return res.status(404).json({erro:"produto_nao_encontrado"});
  }
 
  const sellerRes = await fetch(
   "https://api.mercadolibre.com/users/" + item.seller_id
  );
 
  const seller = await sellerRes.json();
 
  return res.json({
 
   ok:true,
 
   produto:{
    id:item.id,
    titulo:item.title,
    preco:item.price,
    foto:item.thumbnail,
    estoque:item.available_quantity,
    vendidos:item.sold_quantity
   },
 
   vendedor:{
    id:seller.id,
    nome:seller.nickname,
    localizacao:seller.address || {},
    reputacao:seller.seller_reputation || {}
   }
 
  });
 
 }catch(e){
 
  console.log(e);
 
  return res.status(500).json({erro:"erro_api_afiliado"});
 
 }
 
});server.listen(PORT, "0.0.0.0", () => {
const ip = getLocalIP();
 
console.log("\nFLUX ONLINE\n");
console.log("Local:   http://localhost:" + PORT);
console.log("Celular: http://" + ip + ":" + PORT);
console.log("\nAdmin seguro: senha protegida por variï¿½vel de ambiente");
console.log("Feed + Fluxo + Admin + Planos + Stripe + Estoque/Pedidos ativos\n");
});
 
app.get('/flux-produto-v2.html',(req,res)=>res.sendFile(path.join(__dirname,'public','flux-produto-v2.html')));
 
app.get('/marketplace2.html',(req,res)=>res.sendFile(path.join(__dirname,'public','marketplace2.html')));
 
app.get('/checkout-afiliado.html',(req,res)=>res.sendFile(path.join(__dirname,'public','checkout-afiliado.html')));
 
app.get('/perfil-afiliado.html',(req,res)=>res.sendFile(path.join(__dirname,'public','perfil-afiliado.html')));
 
 
 
 
