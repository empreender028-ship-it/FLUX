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
const os = require("os");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const validator = require("validator");
const { Server } = require("socket.io");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
 cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "flux-secret-2050";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/*
 TROQUE PELOS PRICE_ID REAIS DA STRIPE
 Exemplo: price_1TCxxxxx
*/
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
 Basic: "Básico",
 Pro: "Intermediário",
 Avancado: "Avançado",
 Premium: "Premium"
};

const users = new Set();

/* WEBHOOK STRIPE — TEM QUE VIR ANTES DO express.json */
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
   console.log("❌ Webhook inválido:", err.message);
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

     console.log("✅ Assinatura ativada:", plano, empresa?.email);
    }
   }

   if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;

    const empresa = await Empresa.findOneAndUpdate(
     { stripeSubscriptionId: subscription.id },
     {
      plano: "Start",
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

     console.log("⚠️ Assinatura cancelada:", empresa.email);
    }
   }

   res.json({ received: true });
  } catch (err) {
   console.log("❌ Erro webhook:", err);
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

app.use(helmet({ contentSecurityPolicy: false }));

app.use(rateLimit({
 windowMs: 15 * 60 * 1000,
 max: 800,
 message: { erro: "muitas_requisicoes" }
}));

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

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
  .then(() => console.log("🔥 Mongo conectado"))
  .catch(err => console.log("❌ Mongo erro:", err.message));
} else {
 console.log("⚠️ MONGO_URI não definido.");
}

/* MODELS */

const Empresa = mongoose.model("Empresa", new mongoose.Schema({
 nome: String,
 responsavel: String,
 telefone: String,
 segmento: String,
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
 stripeSubscriptionId: { type: String, default: "" }
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

/* PLANOS E PERMISSÕES */

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
  postsMes: 10,
  podeVerFeed: true,
  podeVerFluxo: "basico",
  podeBuscar: true,
  podeCurtir: true,
  podeComentar: true,
  podeSalvar: true,
  podeCompartilhar: true,
  podeSeguir: true,
  podeChat: "simples",
  podePostar: true,
  podePainel: true,
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
   : empresa.plano || "Start";

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
    mensagem: "Seu plano não possui acesso a esse recurso."
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
  const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
  cb(null, unique + ext);
 }
});

const upload = multer({
 storage,
 limits: { fileSize: 100 * 1024 * 1024 },
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

app.use(express.static(publicPath));
app.use("/uploads", express.static(baseUpload));

app.get("/", (req, res) => {
 res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/:page", (req, res, next) => {
 const page = req.params.page;

 if (page.startsWith("api") || page === "uploads" || page === "admin") return next();

 const file = path.join(publicPath, page + ".html");

 if (fs.existsSync(file)) return res.sendFile(file);

 next();
});

/* EMPRESA CADASTRO */

app.post("/empresa/cadastro", async (req, res) => {
 try {
  const email = cleanEmail(req.body.email);

  if (!validator.isEmail(email)) {
   return res.status(400).json({ erro: "email_invalido" });
  }

  const exists = await Empresa.findOne({ email });

  if (exists) return res.status(400).json({ erro: "email_existe" });

  const senha = await bcrypt.hash(req.body.senha || "", 10);

  await Empresa.create({
   nome: cleanText(req.body.nome, 120),
   responsavel: cleanText(req.body.responsavel, 120),
   telefone: cleanText(req.body.telefone, 40),
   segmento: cleanText(req.body.segmento, 120),
   email,
   senha,
   tipoConta: "empresa",
   plano: "Start"
  });

  res.json({ ok: true });
 } catch (err) {
  console.log(err);
  res.status(500).json({ erro: "cadastro_error" });
 }
});

/* EMPRESA LOGIN */

app.post("/empresa/login", async (req, res) => {
 try {
  const email = cleanEmail(req.body.email);
  const user = await Empresa.findOne({ email });

  if (!user) return res.status(400).json({ erro: "nao_encontrado" });

  const ok = await bcrypt.compare(req.body.senha || "", user.senha);

  if (!ok) return res.status(401).json({ erro: "senha_invalida" });

  if (!user.ativo) return res.status(403).json({ erro: "empresa_bloqueada" });

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

  res.json({
   ok: true,
   token,
   empresa: {
    id: user._id,
    nome: user.nome,
    email: user.email,
    plano: user.plano,
    tipoConta: user.tipoConta
   }
  });
 } catch {
  res.status(500).json({ erro: "login_error" });
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
  token,
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
  }, JWT_SECRET, { expiresIn: "30d" });

  res.json({ ok: true, token });
 } catch {
  res.status(500).json({ erro: "admin_error" });
 }
});

/* STRIPE CHECKOUT */

app.post("/api/stripe/checkout", auth, async (req, res) => {
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
   console.log("⚠️ Stripe não aceitou PIX em assinatura. Voltando para cartão:", pixErr.message);

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
  console.log("❌ Stripe checkout erro:", err);
  res.status(500).json({
   erro: "stripe_checkout_error",
   mensagem: err.message
  });
 }
});


/* STRIPE PIX ÚNICO — CASO A STRIPE NÃO LIBERE PIX EM ASSINATURA */

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
   payment_method_types: ["pix", "card"],
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
  console.log("❌ Stripe PIX único erro:", err);
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
   return_url: `${BASE_URL}/painel.html`
  });

  res.json({ ok: true, url: portalSession.url });
 } catch (err) {
  console.log(err);
  res.status(500).json({ erro: "stripe_portal_error" });
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

  res.json({
   ok: true,
   empresa
  });

 } catch (err) {

  console.log(err);

  res.status(500).json({
   erro: "perfil_error"
  });

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


/* PERMISSÕES */

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
     mensagem: "Seu plano não permite publicar no Fluxo."
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

app.post("/api/like/:id", optionalAuth, carregarPlano, verificarRecurso("podeCurtir"), async (req, res) => {
 try {
  const id = actor(req);
  const post = await Post.findById(req.params.id);

  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });

  if (post.likedBy.includes(id)) {
   return res.json({ ok: true, alreadyLiked: true, likes: post.likes });
  }

  post.likedBy.push(id);
  post.likes = post.likedBy.length;
  await post.save();

  io.emit("post_like", { postId: post._id, likes: post.likes });

  res.json({ ok: true, likes: post.likes });
 } catch {
  res.status(500).json({ erro: "like_error" });
 }
});

/* SAVE */

app.post("/api/save/:id", optionalAuth, carregarPlano, verificarRecurso("podeSalvar"), async (req, res) => {
 try {
  const id = actor(req);
  const post = await Post.findById(req.params.id);

  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });

  if (post.savedBy.includes(id)) {
   return res.json({ ok: true, alreadySaved: true, saves: post.saves });
  }

  post.savedBy.push(id);
  post.saves = post.savedBy.length;
  await post.save();

  res.json({ ok: true, saves: post.saves });
 } catch {
  res.status(500).json({ erro: "save_error" });
 }
});

/* SHARE */

app.post("/api/share/:id", optionalAuth, carregarPlano, verificarRecurso("podeCompartilhar"), async (req, res) => {
 try {
  const post = await Post.findById(req.params.id);

  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });

  post.shares += 1;
  await post.save();

  res.json({ ok: true, shares: post.shares });
 } catch {
  res.status(500).json({ erro: "share_error" });
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

app.post("/api/comments", optionalAuth, carregarPlano, verificarRecurso("podeComentar"), async (req, res) => {
 try {
  const texto = cleanText(req.body.texto, 700);
  const postId = req.body.postId;
  const usuarioNome = cleanText(req.body.usuarioNome || req.user?.nome || "Usuário Flux", 80);

  if (!postId || !texto) return res.status(400).json({ erro: "comentario_invalido" });

  const comment = await Comment.create({
   postId,
   usuarioId: req.user?.id || "",
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
     text: "A Flux está lendo empresas, posts, views, likes e receita direto do banco."
    },
    {
     title: "Feed e Fluxo separados",
     text: "As métricas podem ser separadas por tipo de publicação."
    },
    {
     title: "Admin ativo",
     text: "O painel mestre já pode controlar a plataforma."
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

/* MODERAÇÃO */

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

/* FALLBACK */

app.use((req, res) => {
 res.redirect("/login");
});

/* ERROR */

app.use((err, req, res, next) => {
 console.log(err);

 if (err.message === "arquivo_invalido") {
  return res.status(400).json({ erro: "arquivo_invalido" });
 }

 res.status(500).json({ erro: "server_error" });
});

/* START */

server.listen(PORT, "0.0.0.0", () => {
 const ip = getLocalIP();

 console.log("\n🚀 FLUX ONLINE\n");
 console.log("Local:   http://localhost:" + PORT);
 console.log("Celular: http://" + ip + ":" + PORT);
 console.log("\n🔐 Admin senha:", ADMIN_PASSWORD);
 console.log("🔥 Feed + Fluxo + Admin + Planos + Stripe ativos\n");
});



