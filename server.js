0001  require("dotenv").config();
0002   
0003  const express = require("express");
0004  const mongoose = require("mongoose");
0005  const multer = require("multer");
0006  const bcrypt = require("bcryptjs");
0007  const jwt = require("jsonwebtoken");
0008  const cors = require("cors");
0009  const path = require("path");
0010  const fs = require("fs");
0011  const http = require("http");
0012  const os = require("os");
0013  const helmet = require("helmet");
0014  const rateLimit = require("express-rate-limit");
0015  const morgan = require("morgan");
0016  const compression = require("compression");
0017  const validator = require("validator");
0018  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
0019  const nodemailer = require("nodemailer");
0020  const { Server } = require("socket.io");
0021   
0022  const app = express();
0023  app.set("trust proxy", 1);
0024  
0025  app.get("/versao-flux",(req,res)=>{
0026    return res.json({
0027      ok:true,
0028      commit:"server-revisado-seguro",
0029      rota_ml:true,
0030      hora:new Date().toISOString()
0031    });
0032  });
0033  
0034  
0035  /* MERCADO LIVRE PUBLICO TOPO */
0036  app.get("/ml-buscar", async (req,res)=>{
0037   try{
0038    const q = String(req.query.q || "moda feminina").trim();
0039    const r = await fetch("https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(q) + "&limit=20");
0040    const data = await r.json();
0041  
0042    const produtos = ((Array.isArray(data.results) ? data.results : [])).map(p=>({
0043     mlId:p.id,
0044     titulo:p.title,
0045     preco:p.price,
0046     imagem:p.thumbnail,
0047     link:p.permalink,
0048     vendedor:p.seller || {},
0049     linkFlux:"/go-public/ml/" + p.id
0050    }));
0051  
0052    return res.json({ok:true,busca:q,produtos});
0053   }catch(err){
0054    return res.status(500).json({ok:false,erro:err.message});
0055   }
0056  });
0057  
0058  
0059  /* MERCADO LIVRE OFICIAL FLUX */
0060  app.get("/conectar-ml",(req,res)=>{
0061   const clientId = process.env.ML_CLIENT_ID;
0062   const redirectUri = process.env.ML_REDIRECT_URI || "https://flux-beta-production.up.railway.app/ml-callback";
0063  
0064   if(!clientId){
0065    return res.status(500).send("ML_CLIENT_ID_FALTANDO");
0066   }
0067  
0068   const url =
0069    "https://auth.mercadolivre.com.br/authorization" +
0070    "?response_type=code" +
0071    "&client_id=" + clientId +
0072    "&redirect_uri=" + encodeURIComponent(redirectUri);
0073  
0074   return res.redirect(url);
0075  });
0076  
0077  app.get("/ml-callback", async (req,res)=>{
0078   try{
0079    const code = req.query.code;
0080  
0081    if(!code){
0082     return res.status(400).send("Código Mercado Livre ausente");
0083    }
0084  
0085    const response = await fetch("https://api.mercadolibre.com/oauth/token",{
0086     method:"POST",
0087     headers:{ "Content-Type":"application/x-www-form-urlencoded" },
0088     body:new URLSearchParams({
0089      grant_type:"authorization_code",
0090      client_id:process.env.ML_CLIENT_ID,
0091      client_secret:process.env.ML_CLIENT_SECRET,
0092      code,
0093      redirect_uri:process.env.ML_REDIRECT_URI
0094     })
0095    });
0096  
0097    const data = await response.json();
0098  
0099    if(!response.ok){
0100     console.log("ML TOKEN ERRO:", data);
0101     return res.status(400).json(data);
0102    }
0103  
0104    console.log("ML CONECTADO:", data.user_id);
0105  
0106  await MLIntegration.findOneAndUpdate(
0107   { userId:String(data.user_id) },
0108   {
0109    userId:String(data.user_id),
0110    accessToken:data.access_token,
0111    refreshToken:data.refresh_token,
0112    expiresIn:data.expires_in,
0113    tokenType:data.token_type,
0114    ativo:true
0115   },
0116   { upsert:true, new:true }
0117  );
0118  
0119    return res.send("Mercado Livre conectado com sucesso na Flux. User ID: " + data.user_id);
0120  
0121   }catch(err){
0122    console.log("ERRO ML CALLBACK:",err);
0123    return res.status(500).send("Erro ao conectar Mercado Livre");
0124   }
0125  });
0126  
0127  
0128  const server = http.createServer(app);
0129   
0130  const corsOptions = {
0131  origin: (origin, callback) => {
0132  if (!origin) return callback(null, true);
0133  if (!IS_PRODUCTION) return callback(null, true);
0134  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
0135  return callback(new Error("cors_bloqueado"));
0136  },
0137  credentials: true
0138  };
0139   
0140  const io = new Server(server,{
0141  cors: corsOptions,
0142  maxHttpBufferSize: 1e6
0143  });
0144   
0145  const PORT = process.env.PORT || 3000;
0146  const MONGO_URI = process.env.MONGO_URI;
0147  const IS_PRODUCTION = process.env.NODE_ENV === "production";
0148  const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "flux-dev-secret-local");
0149  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? "" : "1234");
0150  const BASE_URL = process.env.BASE_URL || (IS_PRODUCTION ? "" : "http://localhost:3000");
0151  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || BASE_URL || "")
0152  .split(",")
0153  .map(origin => origin.trim())
0154  .filter(Boolean);
0155  const PRICE_IDS = {
0156  Basic:
0157  "price_1TCKeVJkqqOHdzIKsHKn3cc3",
0158  Pro:
0159  "price_1TCKfoJkqqOHdzIKXmr2BE73",
0160  Avancado:
0161  "price_1TCKggJkqqOHdzIKusyC8d3",
0162  Premium:
0163  "price_1TCKhPJkqqOHdzIKZHD1n0Ov"
0164  };
0165  const PLAN_VALUES = {
0166  Start: 0,
0167  Basic: 79.90,
0168  Pro: 149.90,
0169  Avancado: 199.90,
0170  Premium: 249.90
0171  };
0172  const PLAN_LABELS = {
0173  Start: "Start",
0174  Basic: "Básico",
0175  Pro: "Intermediário",
0176  Avancado: "Avançado",
0177  Premium: "Premium"
0178  };
0179  const users = new Set();
0180   
0181  if (IS_PRODUCTION) {
0182  const missingEnv = [];
0183  if (!MONGO_URI) missingEnv.push("MONGO_URI");
0184  if (!JWT_SECRET || JWT_SECRET.length < 32) missingEnv.push("JWT_SECRET_FORTE");
0185  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 24) missingEnv.push("ADMIN_PASSWORD_FORTE");
0186  if (!BASE_URL || BASE_URL.includes("localhost")) missingEnv.push("BASE_URL_PRODUCAO");
0187  if (missingEnv.length) {
0188  console.error("Variáveis de produção inválidas:", missingEnv.join(", "));
0189  process.exit(1);
0190  }
0191  }
0192  /* WEBHOOK STRIPE â€” TEM QUE VIR ANTES DO express.json */
0193  app.post(
0194  "/api/stripe/webhook",
0195  express.raw({ type: "application/json" }),
0196  async (req, res) => {
0197  const sig = req.headers["stripe-signature"];
0198  let event;
0199  try {
0200  event = stripe.webhooks.constructEvent(
0201  req.body,
0202  sig,
0203  process.env.STRIPE_WEBHOOK_SECRET
0204  );
0205  } catch (err) {
0206  console.log("Webhook inválido:", err.message);
0207  return res.status(400).send(`Webhook Error: ${err.message}`);
0208  }
0209  try {
0210  if (event.type === "checkout.session.completed") {
0211  const session = event.data.object;
0212  const empresaId = session.metadata?.empresaId;
0213  const plano = session.metadata?.plano;
0214  if (empresaId && plano) {
0215  const empresa = await Empresa.findByIdAndUpdate(
0216  empresaId,
0217  {
0218  plano,
0219  ativo: true,
0220  assinaturaStatus: "ativo",
0221  receita: PLAN_VALUES[plano] || 0,
0222  stripeCustomerId: session.customer,
0223  stripeSubscriptionId: session.subscription,
0224  ultimaAtividade: new Date()
0225  },
0226  { new: true }
0227  );
0228  await Pagamento.create({
0229  empresaId,
0230  empresa: empresa?.nome || "Empresa Flux",
0231  email: empresa?.email || session.customer_email || "",
0232  plano,
0233  valor: PLAN_VALUES[plano] || 0,
0234  metodo: "Stripe",
0235  status: "aprovado",
0236  ultimaCobranca: new Date(),
0237  stripeSessionId: session.id,
0238  stripeCustomerId: session.customer,
0239  stripeSubscriptionId: session.subscription
0240  });
0241  console.log(" Assinatura ativada:", plano, empresa?.email);
0242  }
0243  }
0244  if (event.type === "customer.subscription.deleted") {
0245  const subscription = event.data.object;
0246  const empresa = await Empresa.findOneAndUpdate(
0247  { stripeSubscriptionId: subscription.id },
0248  {
0249  plano: "Start",
0250  assinaturaStatus: "cancelado",
0251  ultimaAtividade: new Date()
0252  },
0253  { new: true }
0254  );
0255  if (empresa) {
0256  await Pagamento.create({
0257  empresaId: String(empresa._id),
0258  empresa: empresa.nome,
0259  email: empresa.email,
0260  plano: "Start",
0261  valor: 0,
0262  metodo: "Stripe",
0263  status: "recusado",
0264  ultimaCobranca: new Date(),
0265  stripeSubscriptionId: subscription.id
0266  });
0267  console.log("Assinatura cancelada:", empresa.email);
0268  }
0269  }
0270  res.json({ received: true });
0271  } catch (err) {
0272  console.log("Erro webhook:", err);
0273  res.status(500).json({ erro: "webhook_error" });
0274  }
0275  }
0276  );
0277  io.on("connection", socket => {
0278  users.add(socket.id);
0279  io.emit("online", users.size);
0280  socket.on("message:send", msg => {
0281  io.emit("message:receive", msg);
0282  });
0283  socket.on("disconnect", () => {
0284  users.delete(socket.id);
0285  io.emit("online", users.size);
0286  });
0287  });
0288  app.disable("x-powered-by");
0289   
0290  app.use(helmet({
0291  contentSecurityPolicy: false,
0292  crossOriginResourcePolicy: { policy: "cross-origin" },
0293  referrerPolicy: { policy: "no-referrer" },
0294  hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
0295  }));
0296   
0297  app.use((req, res, next) => {
0298  res.setHeader("X-Content-Type-Options", "nosniff");
0299  res.setHeader("X-Frame-Options", "DENY");
0300  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
0301  if (req.path.startsWith("/api/") || req.path.startsWith("/admin/")) {
0302  res.setHeader("Cache-Control", "no-store");
0303  }
0304  if (req.path.includes(".env") || req.path.includes(".git") || req.path.includes("package-lock.json")) {
0305  return res.status(404).json({ erro: "arquivo_bloqueado" });
0306  }
0307  next();
0308  });
0309   
0310  app.use(compression({
0311  level: 6,
0312  threshold: 1024
0313  }));
0314   
0315  const generalLimiter = rateLimit({
0316  windowMs: 15 * 60 * 1000,
0317  max: 500,
0318  standardHeaders: true,
0319  legacyHeaders: false,
0320  message: { erro: "muitas_requisicoes" }
0321  });
0322   
0323  const authLimiter = rateLimit({
0324  windowMs: 15 * 60 * 1000,
0325  max: 30,
0326  standardHeaders: true,
0327  legacyHeaders: false,
0328  message: { erro: "muitas_tentativas_login" }
0329  });
0330   
0331  const adminLimiter = rateLimit({
0332  windowMs: 15 * 60 * 1000,
0333  max: 12,
0334  standardHeaders: true,
0335  legacyHeaders: false,
0336  message: { erro: "admin_bloqueado_temporariamente" }
0337  });
0338   
0339  const writeLimiter = rateLimit({
0340  windowMs: 60 * 1000,
0341  max: 40,
0342  standardHeaders: true,
0343  legacyHeaders: false,
0344  message: { erro: "flood_bloqueado" }
0345  });
0346   
0347  const uploadLimiter = rateLimit({
0348  windowMs: 10 * 60 * 1000,
0349  max: 25,
0350  standardHeaders: true,
0351  legacyHeaders: false,
0352  message: { erro: "limite_upload" }
0353  });
0354   
0355  app.use(generalLimiter);
0356  app.use(cors(corsOptions));
0357  app.use(express.json({ limit: "5mb" }));
0358  app.use(express.urlencoded({ extended: true, limit: "5mb" }));
0359  app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));
0360   
0361  function sanitizeObject(obj) {
0362  if (!obj || typeof obj !== "object") return obj;
0363  if (Array.isArray(obj)) return obj.map(sanitizeObject);
0364  for (const key of Object.keys(obj)) {
0365  if (key.startsWith("$") || key.includes(".")) {
0366  delete obj[key];
0367  continue;
0368  }
0369  obj[key] = sanitizeObject(obj[key]);
0370  }
0371  return obj;
0372  }
0373   
0374  app.use((req, res, next) => {
0375  req.body = sanitizeObject(req.body);
0376  req.query = sanitizeObject(req.query);
0377  req.params = sanitizeObject(req.params);
0378  next();
0379  });
0380   
0381  app.use(["/login", "/api/login", "/cliente/login", "/empresa/login"], authLimiter);
0382  app.use("/admin/login", adminLimiter);
0383  app.use(["/api/comments", "/api/inbox/send", "/api/pedidos", "/api/produtos"], writeLimiter);
0384  app.use("/postar", uploadLimiter);
0385  function getLocalIP() {
0386  const nets = os.networkInterfaces();
0387  let ip = "localhost";
0388  for (const name of Object.keys(nets)) {
0389  for (const net of nets[name]) {
0390  if (net.family === "IPv4" && !net.internal) ip = net.address;
0391  }
0392  }
0393  return ip;
0394  }
0395  function actor(req) {
0396  if (req.user?.id) return String(req.user.id);
0397  return String(req.headers["x-forwarded-for"] || req.ip || "anon").split(",")[0].trim();
0398  }
0399  function cleanText(value, max = 1000) {
0400  return validator.escape(String(value || "").trim().slice(0, max));
0401  }
0402  function cleanEmail(value) {
0403  return String(value || "").toLowerCase().trim();
0404  }
0405  function escapeRegex(value) {
0406  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
0407  }
0408  function isValidObjectId(id) {
0409  return mongoose.Types.ObjectId.isValid(String(id || ""));
0410  }
0411  function mediaUrl(media) {
0412  if (!media) return "";
0413  if (String(media).startsWith("http")) return media;
0414  if (String(media).startsWith("/uploads/")) return media;
0415  return "/uploads/" + media;
0416  }
0417  function normalizePost(post) {
0418  const p = typeof post?.toObject === "function" ? post.toObject() : post;
0419  if (!p) return p;
0420  return {
0421  ...p,
0422  id: p._id,
0423  mediaUrl: mediaUrl(p.media),
0424  tipoMidia: p.media?.includes("videos/") ? "video" : "imagem"
0425  };
0426  }
0427  if (MONGO_URI) {
0428  mongoose.connect(MONGO_URI, {
0429  serverSelectionTimeoutMS: 30000,
0430  connectTimeoutMS: 30000,
0431  socketTimeoutMS: 45000,
0432  maxPoolSize: 20
0433  })
0434  .then(() => console.log(" Mongo conectado"))
0435  .catch(err => console.log("Mongo erro:", err.message));
0436  } else {
0437  console.log("MONGO_URI não definido.");
0438  }
0439  /* MODELS */
0440  const Empresa = mongoose.model("Empresa", new mongoose.Schema({
0441  nome: String,
0442  responsavel: String,
0443  telefone: String,
0444  whatsapp: String,
0445  cidade: String,
0446  segmento: String,
0447  interesses: { type: [String], default: [] },
0448  origemLead: { type: String, default: "" },
0449  email: {
0450  type: String,
0451  unique: true,
0452  lowercase: true,
0453  trim: true
0454  },
0455  senha: String,
0456  tipoConta: {
0457  type: String,
0458  enum: ["usuario", "empresa"],
0459  default: "empresa"
0460  },
0461  plano: {
0462  type: String,
0463  enum: ["Start", "Basic", "Pro", "Avancado", "Premium"],
0464  default: "Start"
0465  },
0466  ativo: { type: Boolean, default: true },
0467  online: { type: Boolean, default: false },
0468  logo: { type: String, default: "" },
0469  avatar: { type: String, default: "" },
0470  receita: { type: Number, default: 0 },
0471  stripeCustomerId: { type: String, default: "" },
0472  stripeSubscriptionId: { type: String, default: "" },
0473  assinaturaStatus: {
0474  type: String,
0475  enum: ["gratis", "pendente", "ativo", "cancelado", "recusado"],
0476  default: "gratis"
0477  },
0478  bio: { type: String, default: "" },
0479  site: { type: String, default: "" },
0480  capa: { type: String, default: "" },
0481  marketplaceAtivo: { type: Boolean, default: true },
0482  estoqueTotal: { type: Number, default: 0 },
0483  vendasTotal: { type: Number, default: 0 },
0484  endereco: {
0485  rua: { type: String, default: "" },
0486  numero: { type: String, default: "" },
0487  bairro: { type: String, default: "" },
0488  cidade: { type: String, default: "" },
0489  estado: { type: String, default: "" },
0490  cep: { type: String, default: "" }
0491  },
0492  ultimaAtividade: { type: Date, default: Date.now }
0493  }, { timestamps: true }));
0494  const Post = mongoose.model("Post", new mongoose.Schema({
0495  empresaId: String,
0496  empresaNome: String,
0497  empresaEmail: String,
0498  media: String,
0499  descricao: String,
0500  link: String,
0501  tipo: {
0502  type: String,
0503  enum: ["feed", "fluxo"],
0504  default: "feed"
0505  },
0506  status: {
0507  type: String,
0508  enum: ["pendente", "aprovada", "denunciada", "removida"],
0509  default: "aprovada"
0510  },
0511  motivoModeracao: { type: String, default: "" },
0512  riscoIA: { type: Number, default: 0 },
0513  likes: { type: Number, default: 0 },
0514  saves: { type: Number, default: 0 },
0515  shares: { type: Number, default: 0 },
0516  views: { type: Number, default: 0 },
0517  likedBy: { type: [String], default: [] },
0518  savedBy: { type: [String], default: [] },
0519  sharedBy: { type: [String], default: [] },
0520  viewedBy: { type: [String], default: [] }
0521  }, { timestamps: true }));
0522  const Comment = mongoose.model("Comment", new mongoose.Schema({
0523  postId: String,
0524  usuarioId: String,
0525  usuarioNome: String,
0526  texto: String
0527  }, { timestamps: true }));
0528  const Pagamento = mongoose.model("Pagamento", new mongoose.Schema({
0529  empresaId: String,
0530  empresa: String,
0531  email: String,
0532  plano: String,
0533  valor: { type: Number, default: 0 },
0534  metodo: { type: String, default: "PIX" },
0535  status: {
0536  type: String,
0537  enum: ["aprovado", "pendente", "recusado"],
0538  default: "pendente"
0539  },
0540  ultimaCobranca: { type: Date, default: Date.now },
0541  stripeSessionId: { type: String, default: "" },
0542  stripeCustomerId: { type: String, default: "" },
0543  stripeSubscriptionId: { type: String, default: "" }
0544  }, { timestamps: true }));
0545  const Lead = mongoose.model("Lead", new mongoose.Schema({
0546  clienteId: String,
0547  nome: String,
0548  email: String,
0549  telefone: String,
0550  whatsapp: String,
0551  cidade: String,
0552  interesses: { type: [String], default: [] },
0553  origem: { type: String, default: "cadastro_cliente" },
0554  status: { type: String, enum: ["novo", "contatado", "convertido"], default: "novo" }
0555  }, { timestamps: true }));
0556  const Produto = mongoose.model("Produto", new mongoose.Schema({
0557  empresaId: String,
0558  empresaNome: String,
0559  nome: String,
0560  descricao: String,
0561  preco: { type: Number, default: 0 },
0562  precoPromocional: { type: Number, default: 0 },
0563  custo: { type: Number, default: 0 },
0564  estoque: { type: Number, default: 0 },
0565  sku: { type: String, default: "" },
0566  categoria: { type: String, default: "geral" },
0567  imagem: { type: String, default: "" },
0568  video: { type: String, default: "" },
0569  link: { type: String, default: "" },
0570  tamanhos: { type: [String], default: [] },
0571  cores: { type: [String], default: [] },
0572  vendido: { type: Number, default: 0 },
0573  destaque: { type: Boolean, default: false },
0574  ativo: { type: Boolean, default: true }
0575  }, { timestamps: true }));
0576  const Pedido = mongoose.model("Pedido", new mongoose.Schema({
0577  empresaId: String,
0578  empresaNome: String,
0579  clienteId: { type: String, default: "" },
0580  clienteNome: { type: String, required: true },
0581  clienteEmail: { type: String, required: true },
0582  clienteWhatsapp: { type: String, default: "" },
0583  endereco: {
0584  rua: { type: String, default: "" },
0585  numero: { type: String, default: "" },
0586  bairro: { type: String, default: "" },
0587  cidade: { type: String, default: "" },
0588  estado: { type: String, default: "" },
0589  cep: { type: String, default: "" },
0590  complemento: { type: String, default: "" }
0591  },
0592  produtos: [{
0593  produtoId: String,
0594  nome: String,
0595  preco: Number,
0596  quantidade: Number,
0597  imagem: String,
0598  tamanho: String,
0599  cor: String
0600  }],
0601  subtotal: { type: Number, default: 0 },
0602  frete: { type: Number, default: 0 },
0603  total: { type: Number, required: true },
0604  status: {
0605  type: String,
0606  enum: ["pendente", "pago", "separando", "enviado", "entregue", "cancelado"],
0607  default: "pendente"
0608  },
0609  codigoRastreio: { type: String, default: "" },
0610  etiquetaEnvio: { type: String, default: "" },
0611  pagamento: { type: String, default: "pix" },
0612  pago: { type: Boolean, default: false }
0613  }, { timestamps: true }));
0614  const Follow = mongoose.model("Follow", new mongoose.Schema({
0615  clienteId: String,
0616  empresaId: String
0617  }, { timestamps: true }));
0618  const Mensagem = mongoose.model("Mensagem", new mongoose.Schema({
0619  fromId: String,
0620  toId: String,
0621  texto: String,
0622  lida: { type: Boolean, default: false }
0623  }, { timestamps: true }));
0624  /* AUTH */
0625  function auth(req, res, next) {
0626  const token = req.headers.authorization?.split(" ")[1];
0627  if (!token) return res.status(401).json({ erro: "sem_token" });
0628  try {
0629  req.user = jwt.verify(token, JWT_SECRET);
0630  next();
0631  } catch {
0632  return res.status(403).json({ erro: "token_invalido" });
0633  }
0634  }
0635  function optionalAuth(req, res, next) {
0636  const token = req.headers.authorization?.split(" ")[1];
0637  if (!token) return next();
0638  try {
0639  req.user = jwt.verify(token, JWT_SECRET);
0640  } catch {}
0641  next();
0642  }
0643  function adminAuth(req, res, next) {
0644  const token = req.headers.authorization?.split(" ")[1] || req.headers.authorization;
0645  if (!token) return res.status(401).json({ erro: "sem_token" });
0646  try {
0647  const decoded = jwt.verify(token, JWT_SECRET);
0648  if (!decoded.admin) {
0649  return res.status(403).json({ erro: "sem_permissao" });
0650  }
0651  req.admin = decoded;
0652  next();
0653  } catch {
0654  return res.status(403).json({ erro: "token_invalido" });
0655  }
0656  }
0657  /* PLANOS E PERMISSÕES */
0658  const PLANOS = {
0659  Visitante: {
0660  postsMes: 0,
0661  podeVerFeed: true,
0662  podeVerFluxo: "limitado",
0663  podeBuscar: "limitado",
0664  podeCurtir: false,
0665  podeComentar: false,
0666  podeSalvar: false,
0667  podeCompartilhar: false,
0668  podeSeguir: false,
0669  podeChat: false,
0670  podePostar: false,
0671  podePainel: false,
0672  analytics: false,
0673  ia: false,
0674  prioridade: false,
0675  leads: false
0676  },
0677  Usuario: {
0678  postsMes: 0,
0679  podeVerFeed: true,
0680  podeVerFluxo: true,
0681  podeBuscar: true,
0682  podeCurtir: true,
0683  podeComentar: true,
0684  podeSalvar: true,
0685  podeCompartilhar: true,
0686  podeSeguir: true,
0687  podeChat: false,
0688  podePostar: false,
0689  podePainel: false,
0690  analytics: false,
0691  ia: false,
0692  prioridade: false,
0693  leads: false
0694  },
0695  Start: {
0696  postsMes: 0,
0697  podeVerFeed: true,
0698  podeVerFluxo: "basico",
0699  podeBuscar: true,
0700  podeCurtir: true,
0701  podeComentar: true,
0702  podeSalvar: true,
0703  podeCompartilhar: true,
0704  podeSeguir: true,
0705  podeChat: false,
0706  podePostar: false,
0707  podePainel: false,
0708  podeProduto: false,
0709  analytics: false,
0710  ia: false,
0711  prioridade: false,
0712  leads: false
0713  },
0714  Basic: {
0715  postsMes: 50,
0716  podeVerFeed: true,
0717  podeVerFluxo: true,
0718  podeBuscar: true,
0719  podeCurtir: true,
0720  podeComentar: true,
0721  podeSalvar: true,
0722  podeCompartilhar: true,
0723  podeSeguir: true,
0724  podeChat: true,
0725  podePostar: true,
0726  podePainel: true,
0727  podeProduto: true,
0728  analytics: "basico",
0729  ia: false,
0730  prioridade: false,
0731  leads: "basico"
0732  },
0733  Pro: {
0734  postsMes: 150,
0735  podeVerFeed: true,
0736  podeVerFluxo: true,
0737  podeBuscar: true,
0738  podeCurtir: true,
0739  podeComentar: true,
0740  podeSalvar: true,
0741  podeCompartilhar: true,
0742  podeSeguir: true,
0743  podeChat: true,
0744  podePostar: true,
0745  podePainel: true,
0746  podeProduto: true,
0747  analytics: "avancado",
0748  ia: "basica",
0749  prioridade: "moderada",
0750  leads: "pro"
0751  },
0752  Avancado: {
0753  postsMes: 500,
0754  podeVerFeed: true,
0755  podeVerFluxo: true,
0756  podeBuscar: true,
0757  podeCurtir: true,
0758  podeComentar: true,
0759  podeSalvar: true,
0760  podeCompartilhar: true,
0761  podeSeguir: true,
0762  podeChat: true,
0763  podePostar: true,
0764  podePainel: true,
0765  podeProduto: true,
0766  analytics: "executivo",
0767  ia: "avancada",
0768  prioridade: "alta",
0769  leads: "avancado"
0770  },
0771  Premium: {
0772  postsMes: Infinity,
0773  podeVerFeed: true,
0774  podeVerFluxo: true,
0775  podeBuscar: true,
0776  podeCurtir: true,
0777  podeComentar: true,
0778  podeSalvar: true,
0779  podeCompartilhar: true,
0780  podeSeguir: true,
0781  podeChat: true,
0782  podePostar: true,
0783  podePainel: true,
0784  podeProduto: true,
0785  analytics: "supremo",
0786  ia: "completa",
0787  prioridade: "maxima",
0788  leads: "premium"
0789  }
0790  };
0791  async function carregarPlano(req, res, next) {
0792  try {
0793  if (!req.user?.id) {
0794  req.planoNome = "Visitante";
0795  req.permissoes = PLANOS.Visitante;
0796  return next();
0797  }
0798  if (req.user.admin) {
0799  req.planoNome = "Admin";
0800  req.permissoes = { admin: true, tudo: true };
0801  return next();
0802  }
0803  let empresa = null;
0804  try{
0805  empresa = await Empresa.findById(req.user.id);
0806  }catch{}
0807  if(!empresa && req.user.id === "demo"){
0808  empresa = {
0809  _id:"demo",
0810  nome:"Flux Demo",
0811  email:"demo@flux.com",
0812  tipoConta:"empresa",
0813  plano:"Premium",
0814  ativo:true,
0815  save: async () => {}
0816  };
0817  }
0818  if (!empresa) {
0819  req.planoNome = "Usuario";
0820  req.permissoes = PLANOS.Usuario;
0821  return next();
0822  }
0823  if (!empresa.ativo) {
0824  return res.status(403).json({ erro: "empresa_bloqueada" });
0825  }
0826  const plano = empresa.tipoConta === "usuario"
0827  ? "Usuario"
0828  : (empresa.assinaturaStatus === "ativo" ? (empresa.plano || "Start") : "Start");
0829  req.empresa = empresa;
0830  req.planoNome = plano;
0831  req.permissoes = PLANOS[plano] || PLANOS.Start;
0832  next();
0833  } catch (err) {
0834  console.log(err);
0835  res.status(500).json({ erro: "plano_error" });
0836  }
0837  }
0838  function verificarRecurso(recurso) {
0839  return (req, res, next) => {
0840  if (req.admin || req.permissoes?.tudo) return next();
0841  if (!req.permissoes) {
0842  return res.status(403).json({ erro: "sem_permissoes" });
0843  }
0844  if (!req.permissoes[recurso]) {
0845  return res.status(403).json({
0846  erro: "recurso_bloqueado",
0847  recurso,
0848  plano: req.planoNome,
0849  mensagem: "Seu plano não possui acesso a esse recurso."
0850  });
0851  }
0852  next();
0853  };
0854  }
0855  async function limitarPosts(req, res, next) {
0856  try {
0857  if (req.permissoes?.tudo) return next();
0858  const limite = req.permissoes.postsMes;
0859  if (limite === Infinity) return next();
0860  const inicioMes = new Date(
0861  new Date().getFullYear(),
0862  new Date().getMonth(),
0863  1
0864  );
0865  const total = await Post.countDocuments({
0866  empresaId: String(req.user.id),
0867  createdAt: { $gte: inicioMes },
0868  status: { $ne: "removida" }
0869  });
0870  if (total >= limite) {
0871  return res.status(403).json({
0872  erro: "limite_plano",
0873  plano: req.planoNome,
0874  limite,
0875  usados: total,
0876  mensagem: `Plano ${req.planoNome} atingiu o limite mensal de ${limite} posts.`
0877  });
0878  }
0879  next();
0880  } catch {
0881  res.status(500).json({ erro: "limite_posts_error" });
0882  }
0883  }
0884  function requireEmpresa(req, res, next) {
0885  if (req.empresa?.tipoConta !== "empresa") {
0886  return res.status(403).json({ erro: "somente_empresa" });
0887  }
0888  next();
0889  }
0890  function requireEmpresaPaga(req, res, next) {
0891  if (req.empresa?.tipoConta !== "empresa") {
0892  return res.status(403).json({ erro: "somente_empresa" });
0893  }
0894  if (req.empresa.assinaturaStatus !== "ativo" || !["Basic", "Pro", "Avancado", "Premium"].includes(req.empresa.plano)) {
0895  return res.status(402).json({
0896  erro: "pagamento_necessario",
0897  mensagem: "Escolha um plano e conclua o pagamento para liberar publicações, produtos e painel.",
0898  redirect: "/planos"
0899  });
0900  }
0901  next();
0902  }
0903  /* UPLOAD */
0904  const baseUpload = path.join(__dirname, "public", "uploads");
0905  const imageDir = path.join(baseUpload, "images");
0906  const videoDir = path.join(baseUpload, "videos");
0907  [baseUpload, imageDir, videoDir].forEach(dir => {
0908  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
0909  });
0910  const storage = multer.diskStorage({
0911  destination: (req, file, cb) => {
0912  cb(null, file.mimetype.startsWith("video") ? videoDir : imageDir);
0913  },
0914  filename: (req, file, cb) => {
0915  const ext = path.extname(file.originalname).toLowerCase();
0916  const safeExts = [".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov"];
0917  if (!safeExts.includes(ext)) return cb(new Error("extensao_invalida"));
0918  const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
0919  cb(null, unique + ext);
0920  }
0921  });
0922  const upload = multer({
0923  storage,
0924  limits: { fileSize: 80 * 1024 * 1024, files: 1 },
0925  fileFilter: (req, file, cb) => {
0926  const allowed = [
0927  "image/png",
0928  "image/jpeg",
0929  "image/jpg",
0930  "image/webp",
0931  "video/mp4",
0932  "video/webm",
0933  "video/quicktime"
0934  ];
0935  if (!allowed.includes(file.mimetype)) {
0936  return cb(new Error("arquivo_invalido"));
0937  }
0938  cb(null, true);
0939  }
0940  });
0941  /* STATIC */
0942  const publicPath = path.join(__dirname, "public");
0943  
0944  /* FORCE ML CONNECT ABSOLUTO */
0945  app.get("/conectar-mercado-livre-flux", (req,res)=>{
0946    const clientId = process.env.ML_CLIENT_ID;
0947    const redirectUri = process.env.ML_REDIRECT_URI || "https://flux-beta-production.up.railway.app/ml-callback";
0948  
0949    if(!clientId){
0950      return res.status(500).json({erro:"ML_CLIENT_ID_FALTANDO"});
0951    }
0952  
0953    const url = "https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=" + clientId + "&redirect_uri=" + encodeURIComponent(redirectUri);
0954  
0955    return res.redirect(url);
0956  });
0957  
0958  
0959  /* FIX ABSOLUTO NOTIFICACOES - ANTES DE QUALQUER ROTA */
0960  app.use((req,res,next)=>{
0961    if(req.path === "/notificacoes"){
0962      console.log("FIX NOTIFICACOES 200");
0963      return res.status(200).sendFile(path.join(publicPath,"notificacoes.html"));
0964    }
0965    if(req.path === "/notificacao" || req.path === "/notifications"){
0966      return res.redirect("/notificacoes");
0967    }
0968    next();
0969  });
0970  app.use(express.static(publicPath, {
0971  maxAge: IS_PRODUCTION ? "7d" : 0,
0972  etag: true,
0973  fallthrough: true,
0974  setHeaders: (res, filePath) => {
0975  if (/\.(html)$/i.test(filePath)) {
0976  res.setHeader("Cache-Control", "no-store");
0977  } else {
0978  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
0979  }
0980  }
0981  }));
0982   
0983  app.use("/uploads", express.static(baseUpload, {
0984  maxAge: IS_PRODUCTION ? "7d" : 0,
0985  etag: true,
0986  fallthrough: true,
0987  setHeaders: (res) => {
0988  res.setHeader("X-Content-Type-Options", "nosniff");
0989  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
0990  }
0991  }));
0992   
0993  /* NOTIFICACOES + ROTAS PUBLICAS SEGURAS */
0994  app.get("/notificacoes", (req, res) => {
0995    return res.sendFile(path.join(publicPath, "notificacoes.html"));
0996  });
0997   
0998  app.get("/notificacao", (req, res) => {
0999    return res.redirect("/notificacoes");
1000  });
1001   
1002  app.get("/notifications", (req, res) => {
1003    return res.redirect("/notificacoes");
1004  });
1005   
1006  app.get("/", (req, res) => {
1007    return res.sendFile(path.join(publicPath, "login.html"));
1008  });
1009   
1010  
1011  /* PRODUTO FLUX - pagina estatica com id por query ou path */
1012  app.get("/flux-produto.html", (req, res) => {
1013    return res.sendFile(path.join(publicPath, "flux-produto.html"));
1014  });
1015  
1016  app.get("/flux-produto/:id", (req, res) => {
1017    return res.sendFile(path.join(publicPath, "flux-produto.html"));
1018  });
1019  
1020  /* ROTAS DINAMICAS SEGURAS */
1021  app.get("/:page", (req, res, next) => {
1022    const page = String(req.params.page || "").trim();
1023   
1024    const bloqueadas = [
1025      "api",
1026      "uploads",
1027      "admin",
1028      "notificacoes",
1029      "notificacao",
1030      "notifications"
1031    ];
1032   
1033    if (bloqueadas.includes(page)) {
1034      return next();
1035    }
1036   
1037    if (!/^[a-zA-Z0-9._-]+$/.test(page)) {
1038      return next();
1039    }
1040   
1041    const file = path.join(publicPath, page + ".html");
1042   
1043    if (!file.startsWith(publicPath)) {
1044      return next();
1045    }
1046   
1047    if (fs.existsSync(file)) {
1048      return res.sendFile(file);
1049    }
1050   
1051    return next();
1052  });
1053   
1054  /* ROTAS PADRÁƒO FLUX - ALIASES */
1055  const pageAliases = {
1056   "/home": "/feed",
1057   "/inicio": "/feed",
1058   "/postar": "/painel",
1059   "/publicar": "/painel",
1060   "/meu-perfil": "/empresa.html",
1061   "/perfil": "/empresa.html",
1062   "/perfil-empresa": "/empresa.html",
1063   "/loja": "/empresa.html",
1064   "/vitrine": "/empresa.html",
1065   "/shop": "/marketplace",
1066   "/mercado": "/marketplace",
1067   "/compras": "/pedidos",
1068   "/mensagens": "/chat.html",
1069   "/chat": "/chat.html",
1070   "/ranking": "/ranking.html",
1071   "/trends": "/trends.html",
1072   "/posts": "/posts.html"
1073  };
1074   
1075  Object.entries(pageAliases).forEach(([from,to])=>{
1076   app.get(from,(req,res)=>res.redirect(to));
1077  });
1078   
1079  app.get("/api/notificacoes", auth, async (req,res)=>{
1080   res.json({
1081    ok:true,
1082    notificacoes:[
1083     {
1084      tipo:"sistema",
1085      titulo:"Bem-vindo à Flux",
1086      texto:"Suas notificações aparecerão aqui em tempo real.",
1087      createdAt:new Date()
1088     }
1089    ]
1090   });
1091  });
1092   
1093  app.get("/api/rotas", (req,res)=>{
1094   res.json({
1095    ok:true,
1096    paginas:{
1097     login:"/login",
1098     cadastroCliente:"/cliente-cadastro",
1099     cadastroEmpresa:"/cadastro",
1100     feed:"/feed",
1101     fluxo:"/fluxo",
1102     postar:"/painel",
1103     perfil:"/empresa.html",
1104     marketplace:"/marketplace",
1105     pedidos:"/pedidos",
1106     notificacoes:"/notificacoes",
1107     chat:"/chat",
1108     planos:"/planos",
1109     admin:"/admin"
1110    },
1111    apis:{
1112     feed:"/api/feed",
1113     fluxo:"/api/fluxo",
1114     produtos:"/api/produtos",
1115     pedidos:"/api/pedidos",
1116     permissoes:"/api/permissoes",
1117     online:"/online",
1118     health:"/api/health"
1119    }
1120   });
1121  });
1122   
1123  /* CLIENTE / EMPRESA CADASTRO */
1124  function parseInteresses(value) {
1125  if (Array.isArray(value)) return value.map(v => cleanText(v, 80)).filter(Boolean).slice(0, 20);
1126  return String(value || "")
1127  .split(/[;,]/)
1128  .map(v => cleanText(v, 80))
1129  .filter(Boolean)
1130  .slice(0, 20);
1131  }
1132  app.post(["/cliente/cadastro", "/api/cliente/cadastro"], async (req, res) => {
1133  try {
1134  const email = cleanEmail(req.body.email);
1135  const senhaLimpa = String(req.body.senha || "");
1136  if (!validator.isEmail(email)) return res.status(400).json({ erro: "email_invalido" });
1137  if (senhaLimpa.length < 6) return res.status(400).json({ erro: "senha_fraca", mensagem: "Use pelo menos 6 caracteres." });
1138  const exists = await Empresa.findOne({ email });
1139  if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail já está cadastrado. Faça login." });
1140  const senha = await bcrypt.hash(senhaLimpa, 10);
1141  const interesses = parseInteresses(req.body.interesses || req.body.interesse);
1142  const cliente = await Empresa.create({
1143  nome: cleanText(req.body.nome || req.body.responsavel || "Cliente Flux", 120),
1144  responsavel: cleanText(req.body.nome || "", 120),
1145  telefone: cleanText(req.body.telefone || req.body.whatsapp, 40),
1146  whatsapp: cleanText(req.body.whatsapp || req.body.telefone, 40),
1147  cidade: cleanText(req.body.cidade, 120),
1148  segmento: "Cliente",
1149  interesses,
1150  email,
1151  senha,
1152  tipoConta: "usuario",
1153  plano: "Start",
1154  assinaturaStatus: "gratis",
1155  ativo: true
1156  });
1157  await Lead.create({
1158  clienteId: String(cliente._id),
1159  nome: cliente.nome,
1160  email: cliente.email,
1161  telefone: cliente.telefone,
1162  whatsapp: cliente.whatsapp,
1163  cidade: cliente.cidade,
1164  interesses
1165  });
1166  res.json({ ok: true, tipoConta: "usuario", redirect: "/login" });
1167  } catch (err) {
1168  console.log("cliente cadastro:", err);
1169  if (err.code === 11000) return res.status(400).json({ erro: "email_existe" });
1170  res.status(500).json({ erro: "cadastro_cliente_error", mensagem: err.message });
1171  }
1172  });
1173  app.post(["/empresa/cadastro", "/api/empresa/cadastro"], async (req, res) => {
1174  try {
1175  const email = cleanEmail(req.body.email);
1176  const senhaLimpa = String(req.body.senha || "");
1177  if (!validator.isEmail(email)) return res.status(400).json({ erro: "email_invalido" });
1178  if (senhaLimpa.length < 6) return res.status(400).json({ erro: "senha_fraca", mensagem: "Use pelo menos 6 caracteres." });
1179  const exists = await Empresa.findOne({ email });
1180  if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail já está cadastrado. Faça login." });
1181  const senha = await bcrypt.hash(senhaLimpa, 10);
1182  const empresa = await Empresa.create({
1183  nome: cleanText(req.body.nome || req.body.empresa, 120),
1184  responsavel: cleanText(req.body.responsavel, 120),
1185  telefone: cleanText(req.body.telefone || req.body.whatsapp, 40),
1186  whatsapp: cleanText(req.body.whatsapp || req.body.telefone, 40),
1187  cidade: cleanText(req.body.cidade, 120),
1188  segmento: cleanText(req.body.segmento, 120),
1189  email,
1190  senha,
1191  tipoConta: "empresa",
1192  plano: "Start",
1193  assinaturaStatus: "pendente",
1194  ativo: true
1195  });
1196  res.json({
1197  ok: true,
1198  tipoConta: "empresa",
1199  empresaId: empresa._id,
1200  redirect: "/planos",
1201  mensagem: "Cadastro criado. Escolha um plano para liberar o painel empresarial."
1202  });
1203  } catch (err) {
1204  console.log("empresa cadastro:", err);
1205  if (err.code === 11000) return res.status(400).json({ erro: "email_existe" });
1206  res.status(500).json({ erro: "cadastro_empresa_error", mensagem: err.message });
1207  }
1208  });
1209  /* LOGIN CLIENTE / EMPRESA */
1210  app.post(["/login", "/api/login", "/cliente/login", "/empresa/login"], async (req, res) => {
1211  try {
1212  const email = cleanEmail(req.body.email);
1213  const user = await Empresa.findOne({ email });
1214  if (!user) return res.status(400).json({ erro: "nao_encontrado" });
1215  const ok = await bcrypt.compare(req.body.senha || "", user.senha);
1216  if (!ok) return res.status(401).json({ erro: "senha_invalida" });
1217  if (!user.ativo) return res.status(403).json({ erro: "conta_bloqueada" });
1218  user.online = true;
1219  user.ultimaAtividade = new Date();
1220  await user.save();
1221  const token = jwt.sign({
1222  id: user._id,
1223  nome: user.nome,
1224  email: user.email,
1225  tipoConta: user.tipoConta,
1226  empresa: user.tipoConta === "empresa"
1227  }, JWT_SECRET, { expiresIn: "7d" });
1228  const redirect = user.tipoConta === "empresa"
1229  ? (user.assinaturaStatus === "ativo" ? "/painel" : "/planos")
1230  : "/fluxo";
1231  res.json({
1232  ok: true,
1233  token,
1234  redirect,
1235  usuario: {
1236  id: user._id,
1237  nome: user.nome,
1238  email: user.email,
1239  plano: user.plano,
1240  tipoConta: user.tipoConta,
1241  assinaturaStatus: user.assinaturaStatus || "gratis"
1242  },
1243  empresa: {
1244  id: user._id,
1245  nome: user.nome,
1246  email: user.email,
1247  plano: user.plano,
1248  tipoConta: user.tipoConta,
1249  assinaturaStatus: user.assinaturaStatus || "gratis"
1250  }
1251  });
1252  } catch (err) {
1253  console.log("login:", err);
1254  res.status(500).json({ erro: "login_error", mensagem: err.message });
1255  }
1256  });
1257  /* LOGIN DEMO */
1258  app.post("/empresa/login-demo", (req, res) => {
1259  const token = jwt.sign({
1260  id: "demo",
1261  nome: "Flux Demo",
1262  empresa: true,
1263  tipoConta: "empresa"
1264  }, JWT_SECRET, { expiresIn: "7d" });
1265  res.json({
1266  ok: true,
1267  token,
1268  empresa: {
1269  id: "demo",
1270  nome: "Flux Demo",
1271  email: "demo@flux.com",
1272  plano: "Premium",
1273  tipoConta: "empresa"
1274  }
1275  });
1276  });
1277  /* ADMIN LOGIN */
1278  app.post("/admin/login", (req, res) => {
1279  try {
1280  const senha = String(req.body.senha || "");
1281  if (senha !== ADMIN_PASSWORD) {
1282  return res.status(401).json({ erro: "senha_invalida" });
1283  }
1284  const token = jwt.sign({
1285  admin: true,
1286  nome: "Flux Master"
1287  }, JWT_SECRET, { expiresIn: "12h" });
1288  res.json({ ok: true, token });
1289  } catch {
1290  res.status(500).json({ erro: "admin_error" });
1291  }
1292  });
1293  /* STRIPE CHECKOUT */
1294  app.post("/api/stripe/checkout", auth, carregarPlano, requireEmpresa, async (req, res) => {
1295  try {
1296  const plano = req.body.plano;
1297  if (!["Basic", "Pro", "Avancado", "Premium"].includes(plano)) {
1298  return res.status(400).json({ erro: "plano_invalido" });
1299  }
1300  if (!PRICE_IDS[plano] || PRICE_IDS[plano].includes("COLE_AQUI")) {
1301  return res.status(400).json({
1302  erro: "price_id_nao_configurado",
1303  mensagem: "Configure o PRICE_ID da Stripe no server.js."
1304  });
1305  }
1306  let empresa = null;
1307  try{
1308  empresa = await Empresa.findById(req.user.id);
1309  }catch{}
1310  if(!empresa && req.user.id === "demo"){
1311  empresa = {
1312  _id:"demo",
1313  nome:"Flux Demo",
1314  email:"demo@flux.com",
1315  tipoConta:"empresa",
1316  plano:"Premium",
1317  ativo:true,
1318  save: async () => {}
1319  };
1320  }
1321  if (!empresa) {
1322  return res.status(404).json({ erro: "empresa_nao_encontrada" });
1323  }
1324  const sessionBase = {
1325  mode: "subscription",
1326  customer_email: empresa.email,
1327  line_items: [
1328  {
1329  price: PRICE_IDS[plano],
1330  quantity: 1
1331  }
1332  ],
1333  metadata: {
1334  empresaId: String(empresa._id),
1335  plano
1336  },
1337  subscription_data: {
1338  metadata: {
1339  empresaId: String(empresa._id),
1340  plano
1341  }
1342  },
1343  success_url: `${BASE_URL}/obrigada.html?sucesso=true&plano=${plano}`,
1344  cancel_url: `${BASE_URL}/planos.html?cancelado=true`
1345  };
1346  let session;
1347  try {
1348  session = await stripe.checkout.sessions.create({
1349  ...sessionBase,
1350  payment_method_types: ["card", "pix"]
1351  });
1352  } catch (pixErr) {
1353  console.log("Stripe não aceitou PIX em assinatura. Voltando para cartão:", pixErr.message);
1354  session = await stripe.checkout.sessions.create({
1355  ...sessionBase,
1356  payment_method_types: ["card"]
1357  });
1358  }
1359  res.json({
1360  ok: true,
1361  url: session.url
1362  });
1363  } catch (err) {
1364  console.log("Stripe checkout erro:", err);
1365  res.status(500).json({
1366  erro: "stripe_checkout_error",
1367  mensagem: err.message
1368  });
1369  }
1370  });
1371  /* STRIPE PIX ÚNICO â€” CASO A STRIPE NÁO LIBERE PIX EM ASSINATURA */
1372  app.post("/api/stripe/checkout-pix-unico", auth, async (req, res) => {
1373  try {
1374  const plano = req.body.plano;
1375  if (!["Basic", "Pro", "Avancado", "Premium"].includes(plano)) {
1376  return res.status(400).json({ erro: "plano_invalido" });
1377  }
1378  if (!process.env.STRIPE_SECRET_KEY) {
1379  return res.status(400).json({
1380  erro: "stripe_nao_configurada",
1381  mensagem: "Configure STRIPE_SECRET_KEY no .env."
1382  });
1383  }
1384  let empresa = null;
1385  try {
1386  if (isValidObjectId(req.user.id)) {
1387  empresa = await Empresa.findById(req.user.id);
1388  }
1389  } catch {}
1390  if (!empresa) {
1391  return res.status(404).json({ erro: "empresa_nao_encontrada" });
1392  }
1393  const session = await stripe.checkout.sessions.create({
1394  mode: "payment",
1395  payment_method_types: ["pix", "card"],
1396  customer_email: empresa.email,
1397  line_items: [
1398  {
1399  price_data: {
1400  currency: "brl",
1401  product_data: {
1402  name: `Flux ${PLAN_LABELS[plano] || plano}`
1403  },
1404  unit_amount: Math.round((PLAN_VALUES[plano] || 0) * 100)
1405  },
1406  quantity: 1
1407  }
1408  ],
1409  metadata: {
1410  empresaId: String(empresa._id),
1411  plano,
1412  tipo: "pix_unico"
1413  },
1414  success_url: `${BASE_URL}/obrigada.html?sucesso=true&plano=${plano}`,
1415  cancel_url: `${BASE_URL}/planos.html?cancelado=true`
1416  });
1417  res.json({ ok: true, url: session.url });
1418  } catch (err) {
1419  console.log("Stripe PIX único erro:", err);
1420  res.status(500).json({
1421  erro: "stripe_pix_unico_error",
1422  mensagem: err.message
1423  });
1424  }
1425  });
1426  /* PORTAL DO CLIENTE STRIPE */
1427  app.post("/api/stripe/portal", auth, async (req, res) => {
1428  try {
1429  let empresa = null;
1430  try{
1431  empresa = await Empresa.findById(req.user.id);
1432  }catch{}
1433  if(!empresa && req.user.id === "demo"){
1434  empresa = {
1435  _id:"demo",
1436  nome:"Flux Demo",
1437  email:"demo@flux.com",
1438  tipoConta:"empresa",
1439  plano:"Premium",
1440  ativo:true,
1441  save: async () => {}
1442  };
1443  }
1444  if (!empresa || !empresa.stripeCustomerId) {
1445  return res.status(400).json({ erro: "cliente_stripe_nao_encontrado" });
1446  }
1447  const portalSession = await stripe.billingPortal.sessions.create({
1448  customer: empresa.stripeCustomerId,
1449  return_url: `${BASE_URL}/painel`
1450  });
1451  res.json({ ok: true, url: portalSession.url });
1452  } catch (err) {
1453  console.log(err);
1454  res.status(500).json({ erro: "stripe_portal_error" });
1455  }
1456  });
1457  /* PERFIL */
1458  app.get("/api/me", auth, async (req, res) => {
1459  try {
1460  const empresa = await Empresa.findById(req.user.id)
1461  .select("-senha")
1462  .lean();
1463  if (!empresa) {
1464  return res.status(404).json({
1465  erro: "empresa_nao_encontrada"
1466  });
1467  }
1468  res.json({
1469  ok: true,
1470  empresa
1471  });
1472  } catch (err) {
1473  console.log(err);
1474  res.status(500).json({
1475  erro: "perfil_error"
1476  });
1477  }
1478  });
1479  app.put("/api/me", auth, async (req, res) => {
1480  try {
1481  const updates = {
1482  nome: cleanText(req.body.nome, 120),
1483  responsavel: cleanText(req.body.responsavel, 120),
1484  telefone: cleanText(req.body.telefone, 40),
1485  segmento: cleanText(req.body.segmento, 120),
1486  bio: cleanText(req.body.bio, 500),
1487  site: cleanText(req.body.site, 200),
1488  whatsapp: cleanText(req.body.whatsapp, 40),
1489  avatar: cleanText(req.body.avatar, 500),
1490  logo: cleanText(req.body.logo, 500),
1491  capa: cleanText(req.body.capa, 500)
1492  };
1493  Object.keys(updates).forEach(key => {
1494  if (
1495  updates[key] === undefined ||
1496  updates[key] === null ||
1497  updates[key] === ""
1498  ) {
1499  delete updates[key];
1500  }
1501  });
1502  const empresa = await Empresa.findByIdAndUpdate(
1503  req.user.id,
1504  updates,
1505  {
1506  new: true
1507  }
1508  ).select("-senha");
1509  res.json({
1510  ok: true,
1511  empresa
1512  });
1513  } catch (err) {
1514  console.log(err);
1515  res.status(500).json({
1516  erro: "perfil_update_error"
1517  });
1518  }
1519  });
1520  app.get("/api/empresa.html/:id", async (req, res) => {
1521  try {
1522  if (!isValidObjectId(req.params.id)) return res.status(400).json({ erro: "id_invalido" });
1523  const empresa = await Empresa.findById(req.params.id).select("-senha -stripeCustomerId -stripeSubscriptionId").lean();
1524  if (!empresa || !empresa.ativo) return res.status(404).json({ erro: "perfil_nao_encontrado" });
1525  const posts = await Post.find({ empresaId: String(empresa._id), status: { $ne: "removida" } }).sort({ createdAt: -1 }).limit(30).lean();
1526  const produtos = await Produto.find({ empresaId: String(empresa._id), ativo: true }).sort({ createdAt: -1 }).limit(30).lean();
1527  res.json({ ok: true, perfil: empresa, posts: posts.map(normalizePost), produtos });
1528  } catch {
1529  res.status(500).json({ erro: "perfil_publico_error" });
1530  }
1531  });
1532  /* PERMISSÕES */
1533  app.get("/api/permissoes", optionalAuth, carregarPlano, async (req, res) => {
1534  res.json({
1535  ok: true,
1536  plano: req.planoNome,
1537  label: PLAN_LABELS[req.planoNome] || req.planoNome,
1538  permissoes: req.permissoes,
1539  empresa: req.empresa ? {
1540  id: req.empresa._id,
1541  nome: req.empresa.nome,
1542  email: req.empresa.email,
1543  plano: req.empresa.plano,
1544  tipoConta: req.empresa.tipoConta
1545  } : null
1546  });
1547  });
1548  /* FEED */
1549  app.get("/api/feed", optionalAuth, carregarPlano, verificarRecurso("podeVerFeed"), async (req, res) => {
1550  try {
1551  const posts = await Post.find({
1552  tipo: "feed",
1553  status: { $ne: "removida" }
1554  })
1555  .sort({ createdAt: -1 })
1556  .limit(50)
1557  .lean();
1558  res.json(posts.map(normalizePost));
1559  } catch {
1560  res.status(500).json({ erro: "feed_error" });
1561  }
1562  });
1563  /* FLUXO */
1564  app.get("/api/fluxo", optionalAuth, carregarPlano, verificarRecurso("podeVerFluxo"), async (req, res) => {
1565  try {
1566  const limit = req.planoNome === "Visitante" ? 10 : 50;
1567  const posts = await Post.find({
1568  tipo: "fluxo",
1569  status: { $ne: "removida" }
1570  })
1571  .sort({ createdAt: -1 })
1572  .limit(limit)
1573  .lean();
1574  res.json(posts.map(normalizePost));
1575  } catch {
1576  res.status(500).json({ erro: "fluxo_error" });
1577  }
1578  });
1579  /* POSTAR */
1580  app.post(
1581  "/postar",
1582  auth,
1583  carregarPlano,
1584  requireEmpresaPaga,
1585  verificarRecurso("podePostar"),
1586  limitarPosts,
1587  upload.single("media"),
1588  async (req, res) => {
1589  try {
1590  if (!req.file) return res.status(400).json({ erro: "sem_midia" });
1591  const filePath = req.file.mimetype.startsWith("video")
1592  ? "videos/" + req.file.filename
1593  : "images/" + req.file.filename;
1594  const tipoRecebido = req.body.tipo === "fluxo" ? "fluxo" : "feed";
1595  if (tipoRecebido === "fluxo" && !req.permissoes.podeVerFluxo) {
1596  return res.status(403).json({
1597  erro: "fluxo_bloqueado",
1598  mensagem: "Seu plano não permite publicar no Fluxo."
1599  });
1600  }
1601  const post = await Post.create({
1602  empresaId: String(req.empresa?._id || req.user.id),
1603  empresaNome: req.empresa?.nome || req.user.nome || "Empresa Flux",
1604  empresaEmail: req.empresa?.email || req.user.email || "",
1605  media: filePath,
1606  descricao: cleanText(req.body.descricao, 1500),
1607  link: cleanText(req.body.link, 500),
1608  tipo: tipoRecebido,
1609  status: "aprovada"
1610  });
1611  if (req.empresa) {
1612  req.empresa.ultimaAtividade = new Date();
1613  await req.empresa.save();
1614  }
1615  const normalized = normalizePost(post);
1616  io.emit("novo_post", normalized);
1617  io.emit(tipoRecebido === "fluxo" ? "novo_fluxo" : "novo_feed", normalized);
1618  res.json({
1619  ok: true,
1620  plano: req.planoNome,
1621  permissoes: req.permissoes,
1622  post: normalized
1623  });
1624  } catch (err) {
1625  console.log(err);
1626  res.status(500).json({ erro: "upload_error" });
1627  }
1628  }
1629  );
1630  /* LIKES */
1631  app.post("/api/like/:id", optionalAuth, carregarPlano, verificarRecurso("podeCurtir"), async (req, res) => {
1632  try {
1633  const id = actor(req);
1634  const post = await Post.findById(req.params.id);
1635  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });
1636  if (post.likedBy.includes(id)) {
1637  return res.json({ ok: true, alreadyLiked: true, likes: post.likes });
1638  }
1639  post.likedBy.push(id);
1640  post.likes = post.likedBy.length;
1641  await post.save();
1642  io.emit("post_like", { postId: post._id, likes: post.likes });
1643  res.json({ ok: true, likes: post.likes });
1644  } catch {
1645  res.status(500).json({ erro: "like_error" });
1646  }
1647  });
1648  /* SAVE */
1649  app.post("/api/save/:id", optionalAuth, carregarPlano, verificarRecurso("podeSalvar"), async (req, res) => {
1650  try {
1651  const id = actor(req);
1652  const post = await Post.findById(req.params.id);
1653  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });
1654  if (post.savedBy.includes(id)) {
1655  return res.json({ ok: true, alreadySaved: true, saves: post.saves });
1656  }
1657  post.savedBy.push(id);
1658  post.saves = post.savedBy.length;
1659  await post.save();
1660  res.json({ ok: true, saves: post.saves });
1661  } catch {
1662  res.status(500).json({ erro: "save_error" });
1663  }
1664  });
1665  /* SHARE */
1666  app.post("/api/share/:id", optionalAuth, carregarPlano, verificarRecurso("podeCompartilhar"), async (req, res) => {
1667  try {
1668  const post = await Post.findById(req.params.id);
1669  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });
1670  post.shares += 1;
1671  await post.save();
1672  res.json({ ok: true, shares: post.shares });
1673  } catch {
1674  res.status(500).json({ erro: "share_error" });
1675  }
1676  });
1677  /* VIEW */
1678  app.post("/api/view/:id", optionalAuth, async (req, res) => {
1679  try {
1680  const id = actor(req);
1681  const post = await Post.findById(req.params.id);
1682  if (!post) return res.status(404).json({ erro: "post_nao_encontrado" });
1683  if (post.viewedBy.includes(id)) {
1684  return res.json({ ok: true, alreadyViewed: true, views: post.views });
1685  }
1686  post.viewedBy.push(id);
1687  post.views = post.viewedBy.length;
1688  await post.save();
1689  res.json({ ok: true, views: post.views });
1690  } catch {
1691  res.status(500).json({ erro: "view_error" });
1692  }
1693  });
1694  /* COMMENTS */
1695  app.get("/api/comments/:postId", async (req, res) => {
1696  try {
1697  const comments = await Comment.find({ postId: req.params.postId })
1698  .sort({ createdAt: -1 })
1699  .limit(50)
1700  .lean();
1701  res.json(comments);
1702  } catch {
1703  res.status(500).json({ erro: "comment_error" });
1704  }
1705  });
1706  app.post("/api/comments", optionalAuth, carregarPlano, verificarRecurso("podeComentar"), async (req, res) => {
1707  try {
1708  const texto = cleanText(req.body.texto, 700);
1709  const postId = req.body.postId;
1710  const usuarioNome = cleanText(req.body.usuarioNome || req.user?.nome || "Usuário Flux", 80);
1711  if (!postId || !texto) return res.status(400).json({ erro: "comentario_invalido" });
1712  const comment = await Comment.create({
1713  postId,
1714  usuarioId: req.user?.id || "",
1715  usuarioNome,
1716  texto
1717  });
1718  io.emit("novo_comentario", comment);
1719  io.emit("comment:new", comment);
1720  res.json({ ok: true, comment });
1721  } catch {
1722  res.status(500).json({ erro: "comment_error" });
1723  }
1724  });
1725  /* BUSCA */
1726  app.get("/api/buscar", optionalAuth, carregarPlano, verificarRecurso("podeBuscar"), async (req, res) => {
1727  try {
1728  const q = String(req.query.q || "").trim();
1729  const limit = req.planoNome === "Visitante" ? 10 : 30;
1730  if (!q) {
1731  const empresas = await Empresa.find({ ativo: true }).limit(limit).lean();
1732  const posts = await Post.find({ status: { $ne: "removida" } }).sort({ createdAt: -1 }).limit(limit).lean();
1733  return res.json({ empresas, posts });
1734  }
1735  const regex = new RegExp(escapeRegex(q), "i");
1736  const empresas = await Empresa.find({
1737  ativo: true,
1738  $or: [
1739  { nome: regex },
1740  { email: regex },
1741  { segmento: regex }
1742  ]
1743  }).limit(limit).lean();
1744  const posts = await Post.find({
1745  status: { $ne: "removida" },
1746  $or: [
1747  { descricao: regex },
1748  { empresaNome: regex },
1749  { tipo: regex }
1750  ]
1751  }).limit(limit).lean();
1752  res.json({ empresas, posts });
1753  } catch {
1754  res.status(500).json({ erro: "buscar_error" });
1755  }
1756  });
1757  /* ANALYTICS EMPRESA */
1758  app.get("/api/empresa/analytics", auth, carregarPlano, verificarRecurso("analytics"), async (req, res) => {
1759  try {
1760  const posts = await Post.find({
1761  empresaId: String(req.user.id),
1762  status: { $ne: "removida" }
1763  });
1764  const views = posts.reduce((a, p) => a + Number(p.views || 0), 0);
1765  const likes = posts.reduce((a, p) => a + Number(p.likes || 0), 0);
1766  const saves = posts.reduce((a, p) => a + Number(p.saves || 0), 0);
1767  const shares = posts.reduce((a, p) => a + Number(p.shares || 0), 0);
1768  res.json({
1769  ok: true,
1770  plano: req.planoNome,
1771  analytics: req.permissoes.analytics,
1772  posts: posts.length,
1773  views,
1774  likes,
1775  saves,
1776  shares
1777  });
1778  } catch {
1779  res.status(500).json({ erro: "empresa_analytics_error" });
1780  }
1781  });
1782  /* IA EMPRESA */
1783  app.get("/api/empresa/ia", auth, carregarPlano, verificarRecurso("ia"), async (req, res) => {
1784  res.json({
1785  ok: true,
1786  plano: req.planoNome,
1787  ia: req.permissoes.ia,
1788  mensagem: "IA liberada para este plano."
1789  });
1790  });
1791  /* ANALYTICS ADMIN */
1792  app.get("/api/analytics", adminAuth, async (req, res) => {
1793  try {
1794  const empresas = await Empresa.countDocuments();
1795  const posts = await Post.countDocuments({ status: { $ne: "removida" } });
1796  const viewsData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]);
1797  const likesData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$likes" } } }]);
1798  const savesData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$saves" } } }]);
1799  const pagamentosData = await Pagamento.aggregate([
1800  { $match: { status: "aprovado" } },
1801  { $group: { _id: null, total: { $sum: "$valor" } } }
1802  ]);
1803  const empresasLista = await Empresa.find().sort({ createdAt: -1 }).limit(20).lean();
1804  res.json({
1805  views: viewsData[0]?.total || 0,
1806  seguidores: likesData[0]?.total || 0,
1807  posts,
1808  receita: pagamentosData[0]?.total || 0,
1809  changes: {
1810  views: 0,
1811  seguidores: 0,
1812  posts: 0,
1813  receita: 0
1814  },
1815  chart: [0, 0, viewsData[0]?.total || 0, likesData[0]?.total || 0, savesData[0]?.total || 0, posts, empresas],
1816  insights: [
1817  {
1818  title: "Dados reais conectados",
1819  text: "A Flux está lendo empresas, posts, views, likes e receita direto do banco."
1820  },
1821  {
1822  title: "Feed e Fluxo separados",
1823  text: "As métricas podem ser separadas por tipo de publicação."
1824  },
1825  {
1826  title: "Admin ativo",
1827  text: "O painel mestre já pode controlar a plataforma."
1828  }
1829  ],
1830  empresas: empresasLista.map(e => ({
1831  nome: e.nome,
1832  email: e.email,
1833  plano: e.plano,
1834  posts: 0,
1835  views: 0,
1836  receita: e.receita || 0,
1837  status: e.ativo ? "Ativo" : "Bloqueada",
1838  avatar: e.avatar || ""
1839  }))
1840  });
1841  } catch {
1842  res.status(500).json({ erro: "analytics_error" });
1843  }
1844  });
1845  /* ADMIN */
1846  app.get("/admin/stats", adminAuth, async (req, res) => {
1847  try {
1848  const empresas = await Empresa.countDocuments();
1849  const posts = await Post.countDocuments();
1850  const viewsData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]);
1851  const energiaData = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$likes" } } }]);
1852  res.json({
1853  empresas,
1854  posts,
1855  views: viewsData[0]?.total || 0,
1856  energia: energiaData[0]?.total || 0
1857  });
1858  } catch {
1859  res.status(500).json({ erro: "stats_error" });
1860  }
1861  });
1862  app.get("/admin/grafico", adminAuth, async (req, res) => {
1863  try {
1864  const dados = await Post.aggregate([
1865  {
1866  $group: {
1867  _id: { $dateToString: { format: "%d/%m", date: "$createdAt" } },
1868  energia: { $sum: "$likes" }
1869  }
1870  },
1871  { $sort: { _id: 1 } },
1872  { $limit: 7 }
1873  ]);
1874  res.json(dados);
1875  } catch {
1876  res.status(500).json({ erro: "grafico_error" });
1877  }
1878  });
1879  app.get("/admin/ranking", adminAuth, async (req, res) => {
1880  try {
1881  const dados = await Post.aggregate([
1882  {
1883  $group: {
1884  _id: "$empresaNome",
1885  energia: { $sum: "$likes" },
1886  views: { $sum: "$views" },
1887  posts: { $sum: 1 }
1888  }
1889  },
1890  { $sort: { energia: -1 } },
1891  { $limit: 10 }
1892  ]);
1893  res.json(dados);
1894  } catch {
1895  res.status(500).json({ erro: "ranking_error" });
1896  }
1897  });
1898  app.get("/admin/empresas", adminAuth, async (req, res) => {
1899  try {
1900  const empresas = await Empresa.find().sort({ createdAt: -1 }).lean();
1901  res.json(empresas);
1902  } catch {
1903  res.status(500).json({ erro: "empresas_error" });
1904  }
1905  });
1906  /* API EMPRESAS */
1907  app.get("/api/empresas", adminAuth, async (req, res) => {
1908  try {
1909  const lista = await Empresa.find().sort({ createdAt: -1 }).lean();
1910  const empresas = await Promise.all(lista.map(async e => {
1911  const posts = await Post.countDocuments({ empresaId: String(e._id) });
1912  const receitaData = await Pagamento.aggregate([
1913  { $match: { empresaId: String(e._id), status: "aprovado" } },
1914  { $group: { _id: null, total: { $sum: "$valor" } } }
1915  ]);
1916  return {
1917  id: e._id,
1918  nome: e.nome,
1919  email: e.email,
1920  responsavel: e.responsavel,
1921  segmento: e.segmento,
1922  plano: e.plano || "Start",
1923  status: !e.ativo ? "banida" : e.online ? "online" : "offline",
1924  posts,
1925  receita: receitaData[0]?.total || 0,
1926  ultimaAtividade: e.ultimaAtividade ? new Date(e.ultimaAtividade).toLocaleString("pt-BR") : "-",
1927  avatar: e.avatar || ""
1928  };
1929  }));
1930  res.json({
1931  resumo: {
1932  total: empresas.length,
1933  ativas: empresas.filter(e => e.status === "online").length,
1934  premium: empresas.filter(e => ["Premium", "Pro", "Basic"].includes(e.plano)).length,
1935  receita: empresas.reduce((acc, e) => acc + Number(e.receita || 0), 0)
1936  },
1937  empresas
1938  });
1939  } catch {
1940  res.status(500).json({ erro: "api_empresas_error" });
1941  }
1942  });
1943  app.put("/api/empresas/:id/plano", adminAuth, async (req, res) => {
1944  try {
1945  await Empresa.findByIdAndUpdate(req.params.id, {
1946  plano: req.body.plano || "Start"
1947  });
1948  res.json({ ok: true });
1949  } catch {
1950  res.status(500).json({ erro: "plano_error" });
1951  }
1952  });
1953  app.post("/api/empresas/:id/banir", adminAuth, async (req, res) => {
1954  try {
1955  await Empresa.findByIdAndUpdate(req.params.id, {
1956  ativo: false,
1957  online: false
1958  });
1959  res.json({ ok: true });
1960  } catch {
1961  res.status(500).json({ erro: "ban_error" });
1962  }
1963  });
1964  /* ADMIN POSTS */
1965  app.get("/admin/posts", adminAuth, async (req, res) => {
1966  try {
1967  const posts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();
1968  res.json(posts);
1969  } catch {
1970  res.status(500).json({ erro: "posts_error" });
1971  }
1972  });
1973  app.delete("/admin/post/:id", adminAuth, async (req, res) => {
1974  try {
1975  await Post.findByIdAndUpdate(req.params.id, { status: "removida" });
1976  io.emit("post_removido", { id: req.params.id });
1977  res.json({ ok: true });
1978  } catch {
1979  res.status(500).json({ erro: "delete_error" });
1980  }
1981  });
1982  /* MODERAÇÁO */
1983  app.get("/api/moderacao/posts", adminAuth, async (req, res) => {
1984  try {
1985  const lista = await Post.find({ status: { $ne: "removida" } })
1986  .sort({ createdAt: -1 })
1987  .limit(100)
1988  .lean();
1989  const posts = lista.map(p => ({
1990  id: p._id,
1991  empresa: p.empresaNome,
1992  email: p.empresaEmail || "",
1993  legenda: p.descricao,
1994  destino: p.tipo,
1995  tipo: p.media?.includes("videos/") ? "video" : "imagem",
1996  midia: "/uploads/" + p.media,
1997  status: p.status,
1998  risco: p.riscoIA || 0,
1999  motivo: p.motivoModeracao || "",
2000  criadoEm: p.createdAt ? new Date(p.createdAt).toLocaleString("pt-BR") : "agora"
2001  }));
2002  res.json({
2003  resumo: {
2004  pendentes: posts.filter(p => p.status === "pendente").length,
2005  denuncias: posts.filter(p => p.status === "denunciada").length,
2006  aprovados: posts.filter(p => p.status === "aprovada").length,
2007  riscoMedio: posts.length ? Math.round(posts.reduce((a, p) => a + Number(p.risco || 0), 0) / posts.length) : 0
2008  },
2009  posts
2010  });
2011  } catch {
2012  res.status(500).json({ erro: "moderacao_error" });
2013  }
2014  });
2015  app.post("/api/moderacao/posts/:id/aprovar", adminAuth, async (req, res) => {
2016  try {
2017  const post = await Post.findByIdAndUpdate(req.params.id, { status: "aprovada" }, { new: true });
2018  io.emit("post_aprovado", post);
2019  res.json({ ok: true });
2020  } catch {
2021  res.status(500).json({ erro: "aprovar_error" });
2022  }
2023  });
2024  app.delete("/api/moderacao/posts/:id/remover", adminAuth, async (req, res) => {
2025  try {
2026  await Post.findByIdAndUpdate(req.params.id, { status: "removida" });
2027  io.emit("post_removido", { id: req.params.id });
2028  res.json({ ok: true });
2029  } catch {
2030  res.status(500).json({ erro: "remover_error" });
2031  }
2032  });
2033  /* PAGAMENTOS */
2034  app.get("/api/pagamentos", adminAuth, async (req, res) => {
2035  try {
2036  const lista = await Pagamento.find().sort({ createdAt: -1 }).lean();
2037  res.json({
2038  resumo: {
2039  receitaTotal: lista.filter(p => p.status === "aprovado").reduce((a, p) => a + Number(p.valor || 0), 0),
2040  receitaChange: 0,
2041  aprovados: lista.filter(p => p.status === "aprovado").length,
2042  pendentes: lista.filter(p => p.status === "pendente").length,
2043  recusados: lista.filter(p => p.status === "recusado").length
2044  },
2045  pagamentos: lista.map(p => ({
2046  id: p._id,
2047  empresa: p.empresa,
2048  email: p.email,
2049  plano: p.plano,
2050  valor: p.valor,
2051  metodo: p.metodo,
2052  status: p.status,
2053  ultimaCobranca: p.ultimaCobranca ? new Date(p.ultimaCobranca).toLocaleString("pt-BR") : "-"
2054  }))
2055  });
2056  } catch {
2057  res.status(500).json({ erro: "pagamentos_error" });
2058  }
2059  });
2060  app.post("/api/pagamentos/nova", adminAuth, async (req, res) => {
2061  try {
2062  const pagamento = await Pagamento.create({
2063  empresaId: req.body.empresaId || "",
2064  empresa: validator.escape(req.body.empresa || "Empresa Flux"),
2065  email: validator.escape(req.body.email || ""),
2066  plano: validator.escape(req.body.plano || "Premium"),
2067  valor: Number(req.body.valor || 0),
2068  metodo: validator.escape(req.body.metodo || "PIX"),
2069  status: req.body.status || "pendente"
2070  });
2071  res.json({ ok: true, pagamento });
2072  } catch {
2073  res.status(500).json({ erro: "nova_cobranca_error" });
2074  }
2075  });
2076  app.post("/api/pagamentos/:id/aprovar", adminAuth, async (req, res) => {
2077  try {
2078  const pagamento = await Pagamento.findByIdAndUpdate(
2079  req.params.id,
2080  { status: "aprovado", ultimaCobranca: new Date() },
2081  { new: true }
2082  );
2083  if (pagamento?.empresaId) {
2084  await Empresa.findByIdAndUpdate(pagamento.empresaId, {
2085  plano: pagamento.plano,
2086  assinaturaStatus: "ativo",
2087  ativo: true,
2088  receita: Number(pagamento.valor || 0)
2089  });
2090  }
2091  res.json({ ok: true });
2092  } catch {
2093  res.status(500).json({ erro: "aprovar_pagamento_error" });
2094  }
2095  });
2096  app.post("/api/pagamentos/:id/cancelar", adminAuth, async (req, res) => {
2097  try {
2098  await Pagamento.findByIdAndUpdate(req.params.id, { status: "recusado" });
2099  res.json({ ok: true });
2100  } catch {
2101  res.status(500).json({ erro: "cancelar_pagamento_error" });
2102  }
2103  });
2104  /* PRODUTOS / MARKETPLACE */
2105  app.get("/api/produtos", async (req, res) => {
2106  try {
2107  const produtos = await Produto.find({ ativo: true }).sort({ createdAt: -1 }).limit(100).lean();
2108  res.json(produtos);
2109  } catch (err) {
2110  res.status(500).json({ erro: "produtos_error" });
2111  }
2112  });
2113  app.post("/api/produtos", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
2114  try {
2115  const produto = await Produto.create({
2116  empresaId: String(req.empresa._id),
2117  empresaNome: req.empresa.nome,
2118  nome: cleanText(req.body.nome, 120),
2119  descricao: cleanText(req.body.descricao, 500),
2120  preco: Number(req.body.preco || 0),
2121  precoPromocional: Number(req.body.precoPromocional || 0),
2122  custo: Number(req.body.custo || 0),
2123  estoque: Number(req.body.estoque || 0),
2124  sku: cleanText(req.body.sku, 80),
2125  categoria: cleanText(req.body.categoria || "geral", 120),
2126  imagem: cleanText(req.body.imagem, 500),
2127  video: cleanText(req.body.video, 500),
2128  link: cleanText(req.body.link, 500),
2129  tamanhos: Array.isArray(req.body.tamanhos) ? req.body.tamanhos.map(t => cleanText(t, 30)) : String(req.body.tamanhos || "").split(",").map(t => cleanText(t, 30)).filter(Boolean),
2130  cores: Array.isArray(req.body.cores) ? req.body.cores.map(c => cleanText(c, 30)) : String(req.body.cores || "").split(",").map(c => cleanText(c, 30)).filter(Boolean),
2131  destaque: Boolean(req.body.destaque),
2132  ativo: true
2133  });
2134  res.json({ ok: true, produto });
2135  } catch (err) {
2136  console.log(err);
2137  res.status(500).json({ erro: "produto_create_error" });
2138  }
2139  });
2140  app.put("/api/produtos/:id", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
2141  try {
2142  const produto = await Produto.findOneAndUpdate(
2143  { _id: req.params.id, empresaId: String(req.user.id) },
2144  {
2145  nome: cleanText(req.body.nome, 120),
2146  descricao: cleanText(req.body.descricao, 500),
2147  preco: Number(req.body.preco || 0),
2148  precoPromocional: Number(req.body.precoPromocional || 0),
2149  custo: Number(req.body.custo || 0),
2150  estoque: Number(req.body.estoque || 0),
2151  sku: cleanText(req.body.sku, 80),
2152  categoria: cleanText(req.body.categoria || "geral", 120),
2153  imagem: cleanText(req.body.imagem, 500),
2154  video: cleanText(req.body.video, 500),
2155  link: cleanText(req.body.link, 500),
2156  tamanhos: Array.isArray(req.body.tamanhos) ? req.body.tamanhos.map(t => cleanText(t, 30)) : String(req.body.tamanhos || "").split(",").map(t => cleanText(t, 30)).filter(Boolean),
2157  cores: Array.isArray(req.body.cores) ? req.body.cores.map(c => cleanText(c, 30)) : String(req.body.cores || "").split(",").map(c => cleanText(c, 30)).filter(Boolean),
2158  destaque: Boolean(req.body.destaque),
2159  ativo: req.body.ativo !== false
2160  },
2161  { new: true }
2162  );
2163  if (!produto) return res.status(404).json({ erro: "produto_nao_encontrado" });
2164  res.json({ ok: true, produto });
2165  } catch {
2166  res.status(500).json({ erro: "produto_update_error" });
2167  }
2168  });
2169  app.delete("/api/produtos/:id", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
2170  try {
2171  await Produto.findOneAndUpdate({ _id: req.params.id, empresaId: String(req.user.id) }, { ativo: false });
2172  res.json({ ok: true });
2173  } catch {
2174  res.status(500).json({ erro: "produto_delete_error" });
2175  }
2176  });
2177  /* PEDIDOS / ESTOQUE FLUX COMMERCE */
2178  app.get("/api/meus-produtos", auth, carregarPlano, requireEmpresaPaga, verificarRecurso("podeProduto"), async (req, res) => {
2179  try {
2180  const produtos = await Produto.find({ empresaId: String(req.user.id) }).sort({ createdAt: -1 }).lean();
2181  res.json({ ok: true, produtos });
2182  } catch {
2183  res.status(500).json({ erro: "meus_produtos_error" });
2184  }
2185  });
2186  app.post("/api/pedidos", optionalAuth, async (req, res) => {
2187  const session = await mongoose.startSession();
2188  session.startTransaction();
2189  try {
2190  const produtosRecebidos = Array.isArray(req.body.produtos) ? req.body.produtos : [];
2191  if (!produtosRecebidos.length) {
2192  await session.abortTransaction();
2193  return res.status(400).json({ erro: "pedido_sem_produtos" });
2194  }
2195  const itens = [];
2196  let subtotal = 0;
2197  let empresaId = "";
2198  let empresaNome = "Flux";
2199  for (const item of produtosRecebidos) {
2200  const produtoId = String(item.produtoId || item.id || "");
2201  const quantidade = Math.max(1, Number(item.quantidade || 1));
2202  if (!isValidObjectId(produtoId)) {
2203  throw new Error("produto_invalido");
2204  }
2205  const produto = await Produto.findOne({ _id: produtoId, ativo: true }).session(session);
2206  if (!produto) {
2207  throw new Error("produto_nao_encontrado");
2208  }
2209  if (Number(produto.estoque || 0) < quantidade) {
2210  throw new Error(`estoque_insuficiente:${produto.nome}`);
2211  }
2212  const precoFinal = Number(produto.precoPromocional || 0) > 0
2213  ? Number(produto.precoPromocional)
2214  : Number(produto.preco || 0);
2215  produto.estoque = Number(produto.estoque || 0) - quantidade;
2216  produto.vendido = Number(produto.vendido || 0) + quantidade;
2217  await produto.save({ session });
2218  empresaId = produto.empresaId || empresaId;
2219  empresaNome = produto.empresaNome || empresaNome;
2220  itens.push({
2221  produtoId: String(produto._id),
2222  nome: produto.nome,
2223  preco: precoFinal,
2224  quantidade,
2225  imagem: produto.imagem || "",
2226  tamanho: cleanText(item.tamanho, 30),
2227  cor: cleanText(item.cor, 30)
2228  });
2229  subtotal += precoFinal * quantidade;
2230  }
2231  const frete = Number(req.body.frete || 0);
2232  const total = subtotal + frete;
2233  const pedido = await Pedido.create([{
2234  empresaId,
2235  empresaNome,
2236  clienteId: req.user?.id || "",
2237  clienteNome: cleanText(req.body.clienteNome || req.body.nome, 120),
2238  clienteEmail: cleanEmail(req.body.clienteEmail || req.body.email),
2239  clienteWhatsapp: cleanText(req.body.clienteWhatsapp || req.body.whatsapp, 40),
2240  endereco: {
2241  rua: cleanText(req.body.rua, 120),
2242  numero: cleanText(req.body.numero, 30),
2243  bairro: cleanText(req.body.bairro, 120),
2244  cidade: cleanText(req.body.cidade, 120),
2245  estado: cleanText(req.body.estado, 40),
2246  cep: cleanText(req.body.cep, 20),
2247  complemento: cleanText(req.body.complemento, 120)
2248  },
2249  produtos: itens,
2250  subtotal,
2251  frete,
2252  total,
2253  pagamento: cleanText(req.body.pagamento || "pix", 30),
2254  status: "pendente",
2255  pago: false
2256  }], { session });
2257  await session.commitTransaction();
2258  io.emit("pedido:new", pedido[0]);
2259  res.json({ ok: true, pedido: pedido[0] });
2260  } catch (err) {
2261  await session.abortTransaction();
2262  console.log("pedido erro:", err.message);
2263  res.status(400).json({ erro: "pedido_error", mensagem: err.message });
2264  } finally {
2265  session.endSession();
2266  }
2267  });
2268  app.get("/api/pedidos", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
2269  try {
2270  const pedidos = await Pedido.find({ empresaId: String(req.user.id) }).sort({ createdAt: -1 }).limit(200).lean();
2271  res.json({ ok: true, pedidos });
2272  } catch {
2273  res.status(500).json({ erro: "pedidos_error" });
2274  }
2275  });
2276  app.put("/api/pedidos/:id/status", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
2277  try {
2278  const statusPermitidos = ["pendente", "pago", "separando", "enviado", "entregue", "cancelado"];
2279  const status = String(req.body.status || "pendente");
2280  if (!statusPermitidos.includes(status)) {
2281  return res.status(400).json({ erro: "status_invalido" });
2282  }
2283  const pedido = await Pedido.findOneAndUpdate(
2284  { _id: req.params.id, empresaId: String(req.user.id) },
2285  {
2286  status,
2287  codigoRastreio: cleanText(req.body.codigoRastreio, 120),
2288  etiquetaEnvio: cleanText(req.body.etiquetaEnvio, 500),
2289  pago: Boolean(req.body.pago)
2290  },
2291  { new: true }
2292  );
2293  if (!pedido) return res.status(404).json({ erro: "pedido_nao_encontrado" });
2294  io.emit("pedido:update", pedido);
2295  res.json({ ok: true, pedido });
2296  } catch {
2297  res.status(500).json({ erro: "pedido_status_error" });
2298  }
2299  });
2300  app.get("/api/estoque/resumo", auth, carregarPlano, requireEmpresaPaga, async (req, res) => {
2301  try {
2302  const produtos = await Produto.find({ empresaId: String(req.user.id), ativo: true }).lean();
2303  const pedidos = await Pedido.find({ empresaId: String(req.user.id) }).lean();
2304  const estoqueTotal = produtos.reduce((acc, p) => acc + Number(p.estoque || 0), 0);
2305  const vendidos = produtos.reduce((acc, p) => acc + Number(p.vendido || 0), 0);
2306  const baixoEstoque = produtos.filter(p => Number(p.estoque || 0) <= 3);
2307  const receitaPedidos = pedidos
2308  .filter(p => ["pago", "separando", "enviado", "entregue"].includes(p.status))
2309  .reduce((acc, p) => acc + Number(p.total || 0), 0);
2310  res.json({
2311  ok: true,
2312  resumo: {
2313  produtos: produtos.length,
2314  estoqueTotal,
2315  vendidos,
2316  baixoEstoque: baixoEstoque.length,
2317  pedidos: pedidos.length,
2318  receitaPedidos
2319  },
2320  baixoEstoque
2321  });
2322  } catch {
2323  res.status(500).json({ erro: "estoque_resumo_error" });
2324  }
2325  });
2326  /* SEGUIR EMPRESA */
2327  app.post("/api/follow/:empresaId", auth, carregarPlano, verificarRecurso("podeSeguir"), async (req, res) => {
2328  try {
2329  const empresaId = req.params.empresaId;
2330  if (!isValidObjectId(empresaId)) return res.status(400).json({ erro: "empresa_invalida" });
2331  const empresa = await Empresa.findOne({ _id: empresaId, tipoConta: "empresa", ativo: true });
2332  if (!empresa) return res.status(404).json({ erro: "empresa_nao_encontrada" });
2333  const exists = await Follow.findOne({ clienteId: String(req.user.id), empresaId });
2334  if (exists) return res.json({ ok: true, seguindo: true });
2335  await Follow.create({ clienteId: String(req.user.id), empresaId });
2336  res.json({ ok: true, seguindo: true });
2337  } catch {
2338  res.status(500).json({ erro: "follow_error" });
2339  }
2340  });
2341  /* INBOX SIMPLES */
2342  app.post("/api/inbox/send", auth, carregarPlano, async (req, res) => {
2343  try {
2344  const toId = String(req.body.toId || "");
2345  const texto = cleanText(req.body.texto, 1000);
2346  if (!isValidObjectId(toId) || !texto) return res.status(400).json({ erro: "mensagem_invalida" });
2347  const destino = await Empresa.findById(toId);
2348  if (!destino) return res.status(404).json({ erro: "destinatario_nao_encontrado" });
2349  const msg = await Mensagem.create({
2350  fromId: String(req.user.id),
2351  toId,
2352  texto
2353  });
2354  io.emit("inbox:new", msg);
2355  res.json({ ok: true, mensagem: msg });
2356  } catch (err) {
2357  console.log(err);
2358  res.status(500).json({ erro: "inbox_send_error" });
2359  }
2360  });
2361  app.get("/api/inbox", auth, async (req, res) => {
2362  try {
2363  const id = String(req.user.id);
2364  const mensagens = await Mensagem.find({ $or: [{ fromId: id }, { toId: id }] })
2365  .sort({ createdAt: -1 })
2366  .limit(100)
2367  .lean();
2368  res.json({ ok: true, mensagens });
2369  } catch {
2370  res.status(500).json({ erro: "inbox_error" });
2371  }
2372  });
2373  /* LEADS */
2374  app.get("/api/leads", adminAuth, async (req, res) => {
2375  try {
2376  const leads = await Lead.find().sort({ createdAt: -1 }).limit(300).lean();
2377  res.json({ ok: true, leads });
2378  } catch {
2379  res.status(500).json({ erro: "leads_error" });
2380  }
2381  });
2382  /* HEALTH */
2383  app.get("/api/health", (req, res) => {
2384  res.json({
2385  ok: true,
2386  app: "Flux",
2387  mongo: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
2388  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
2389  onlineUsers: users.size,
2390  horario: new Date()
2391  });
2392  });
2393  /* ONLINE */
2394  app.get("/online", (req, res) => {
2395  res.json({ onlineUsers: users.size });
2396  });
2397  app.get("/seed-demo-flux", async (req, res) => {
2398  try {
2399  const count = await Post.countDocuments();
2400  if (count > 0) {
2401  return res.json({ ok: true, mensagem: "Já existem posts no feed.", total: count });
2402  }
2403  await Post.create([
2404  {
2405  empresaNome: "Premium Soles",
2406  descricao: "Lançamento beta da Flux: moda, marketplace e vídeos em uma experiência mobile.",
2407  media: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900",
2408  tipo: "feed",
2409  status: "aprovada",
2410  likes: 12,
2411  views: 230
2412  },
2413  {
2414  empresaNome: "Flux",
2415  descricao: "Fluxo vertical ativo. Testando a experiência estilo app.",
2416  media: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900",
2417  tipo: "feed",
2418  status: "aprovada",
2419  likes: 34,
2420  views: 520
2421  }
2422  ]);
2423  res.json({ ok: true, mensagem: "Posts demo criados." });
2424  } catch (err) {
2425  console.error("ERRO SEED DEMO:", err);
2426  res.status(500).json({
2427  ok: false,
2428  erro: "seed_demo_error",
2429  detalhe: err.message
2430  });
2431  }
2432  });
2433  /* SEED ADMIN TESTE */
2434  app.post("/admin/seed", adminAuth, async (req, res) => {
2435  try {
2436  const count = await Empresa.countDocuments();
2437  if (count === 0) {
2438  await Empresa.create([
2439  {
2440  nome: "Premium Soles",
2441  responsavel: "Admin",
2442  telefone: "17992042563",
2443  email: "premium@email.com",
2444  senha: await bcrypt.hash("123456", 10),
2445  segmento: "Moda",
2446  tipoConta: "empresa",
2447  plano: "Premium",
2448  ativo: true,
2449  online: true
2450  },
2451  {
2452  nome: "Urban Vision",
2453  responsavel: "Admin",
2454  telefone: "17992042563",
2455  email: "urban@email.com",
2456  senha: await bcrypt.hash("123456", 10),
2457  segmento: "Moda",
2458  tipoConta: "empresa",
2459  plano: "Start",
2460  ativo: true,
2461  online: false
2462  }
2463  ]);
2464  }
2465  res.json({ ok: true });
2466  } catch {
2467  res.status(500).json({ erro: "seed_error" });
2468  }
2469  });
2470   
2471  /* ROTAS DE PÁGINAS */
2472  const pageRoutes = {
2473    "/": "login.html",
2474    "/login": "login.html",
2475    "/notificacoes": "notificacoes.html",
2476    "/notificacao": "notificacoes.html",
2477    "/notifications": "notificacoes.html",
2478    "/feed": "feed.html",
2479    "/fluxo": "fluxo.html",
2480    "/painel": "painel.html",
2481    "/marketplace": "marketplace.html",
2482    "/admin": "admin.html",
2483    "/cadastro": "cadastro.html",
2484    "/cadastro-cliente": "cadastro-cliente.html",
2485    "/cadastro-empresa": "cadastro-empresa.html",
2486    "/empresa": "empresa.html",
2487    "/empresa.html": "empresa.html",
2488    "/montar-perfil": "montar-perfil.html",
2489    "/editar-perfil": "editar-perfil.html",
2490    "/minha-loja": "minha-loja.html",
2491    "/minhas-compras": "minhas-compras.html",
2492    "/planos": "planos.html",
2493    "/posts": "posts.html",
2494    "/produtos": "produtos.html",
2495    "/pedidos": "pedidos.html",
2496    "/chat": "chat.html",
2497    "/buscar": "buscar.html",
2498    "/explorar": "explorar.html",
2499    "/analytics": "analytics.html",
2500    "/leads": "leads.html",
2501    "/ranking": "ranking.html",
2502    "/trends": "trends.html",
2503    "/notificacoes": "notificacoes.html",
2504    "/notificacao": "notificacao.html",
2505    "/obrigado": "obrigado.html",
2506    "/pagamento": "pagamento.html",
2507    "/recuperar-senha": "recuperar-senha.html",
2508    "/redefinir-senha": "redefinir-senha.html",
2509    "/admin-empresas": "admin-empresas.html",
2510    "/admin-moderacao": "admin-moderacao.html",
2511    "/admin-pagamentos": "admin-pagamentos.html",
2512    "/admin-relatorios": "admin-relatorios.html"
2513  };
2514   
2515  Object.entries(pageRoutes).forEach(([route, fileName]) => {
2516    app.get(route, (req, res) => {
2517      const filePath = path.join(publicPath, fileName);
2518      if (fs.existsSync(filePath)) {
2519        return res.sendFile(filePath);
2520      }
2521   
2522      if (route === "/") {
2523        return res.status(404).send("ROTA_NAO_EXISTE");
2524      }
2525   
2526      return res.status(404).send("Página não encontrada: " + fileName);
2527    });
2528  });
2529   
2530  /* RECUPERAÇÁƒO DE SENHA */
2531  function createMailTransporter() {
2532    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
2533      return null;
2534    }
2535   
2536    return nodemailer.createTransport({
2537      service: process.env.EMAIL_SERVICE || "gmail",
2538      auth: {
2539        user: process.env.EMAIL_USER,
2540        pass: process.env.EMAIL_PASS
2541      }
2542    });
2543  }
2544   
2545  app.post(["/api/recuperar-senha", "/empresa/recuperar"], async (req, res) => {
2546    try {
2547      const email = cleanEmail(req.body.email);
2548   
2549      if (!validator.isEmail(email)) {
2550        return res.status(400).json({
2551          erro: "email_invalido",
2552          mensagem: "Digite um e-mail válido."
2553        });
2554      }
2555   
2556      const user = await Empresa.findOne({ email });
2557   
2558      const respostaPadrao = {
2559        ok: true,
2560        mensagem: "Se o e-mail existir, enviaremos as instruções de recuperação."
2561      };
2562   
2563      if (!user) {
2564        return res.json(respostaPadrao);
2565      }
2566   
2567      const resetToken = jwt.sign(
2568        { id: String(user._id), email: user.email, tipo: "reset_senha" },
2569        JWT_SECRET,
2570        { expiresIn: "15m" }
2571      );
2572   
2573      const link = `${BASE_URL}/redefinir-senha?token=${encodeURIComponent(resetToken)}`;
2574   
2575      const transporter = createMailTransporter();
2576   
2577      if (transporter) {
2578        await transporter.sendMail({
2579          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
2580          to: email,
2581          subject: "Recuperação de senha FLUX",
2582          html: `
2583            <div style="background:#020617;color:white;padding:40px;font-family:Arial,sans-serif">
2584              <h1 style="margin:0 0 16px">FLUX</h1>
2585              <p>Recebemos uma solicitação para redefinir sua senha.</p>
2586              <p>Esse link expira em 15 minutos.</p>
2587              <a href="${link}" style="display:inline-block;padding:14px 22px;background:#00d9ff;color:#020617;text-decoration:none;border-radius:14px;font-weight:800">
2588                Redefinir senha
2589              </a>
2590            </div>
2591          `
2592        });
2593      } else {
2594        console.log("Link de recuperação gerado:", link);
2595      }
2596   
2597      return res.json(respostaPadrao);
2598    } catch (err) {
2599      console.log("recuperar senha:", err);
2600      return res.status(500).json({
2601        erro: "erro_recuperar_senha",
2602        mensagem: "Não foi possível processar a solicitação."
2603      });
2604    }
2605  });
2606   
2607  app.post(["/api/redefinir-senha", "/empresa/redefinir"], async (req, res) => {
2608    try {
2609      const token = String(req.body.token || req.query.token || "");
2610      const novaSenha = String(req.body.senha || req.body.novaSenha || "");
2611   
2612      if (!token) {
2613        return res.status(400).json({ erro: "token_obrigatorio" });
2614      }
2615   
2616      if (novaSenha.length < 6) {
2617        return res.status(400).json({
2618          erro: "senha_fraca",
2619          mensagem: "Use pelo menos 6 caracteres."
2620        });
2621      }
2622   
2623      let decoded;
2624   
2625      try {
2626        decoded = jwt.verify(token, JWT_SECRET);
2627      } catch {
2628        return res.status(403).json({
2629          erro: "token_invalido_ou_expirado"
2630        });
2631      }
2632   
2633      if (decoded.tipo !== "reset_senha" || !decoded.id) {
2634        return res.status(403).json({
2635          erro: "token_invalido"
2636        });
2637      }
2638   
2639      const senha = await bcrypt.hash(novaSenha, 10);
2640   
2641      const user = await Empresa.findByIdAndUpdate(
2642        decoded.id,
2643        { senha, ultimaAtividade: new Date() },
2644        { new: true }
2645      );
2646   
2647      if (!user) {
2648        return res.status(404).json({
2649          erro: "usuario_nao_encontrado"
2650        });
2651      }
2652   
2653      return res.json({
2654        ok: true,
2655        mensagem: "Senha redefinida com sucesso."
2656      });
2657    } catch (err) {
2658      console.log("redefinir senha:", err);
2659      return res.status(500).json({
2660        erro: "erro_redefinir_senha"
2661      });
2662    }
2663  });
2664   
2665  /* ERROR */
2666  app.use((err, req, res, next) => {
2667    const erro = err?.message || "server_error";
2668    console.log("Erro global:", erro);
2669   
2670    if (["arquivo_invalido", "extensao_invalida", "File too large"].includes(erro)) {
2671      return res.status(400).json({ erro: "upload_bloqueado" });
2672    }
2673   
2674    if (erro === "cors_bloqueado") {
2675      return res.status(403).json({ erro: "origem_bloqueada" });
2676    }
2677   
2678    return res.status(500).json({ erro: "server_error" });
2679  });
2680   
2681  /* FALLBACK */
2682  
2683  /* START */
2684  
2685  /* FORCE FIX NOTIFICACOES ANTES DO START */
2686  app.get("/notificacoes", (req,res) => {
2687    return res.status(200).sendFile(path.join(publicPath, "notificacoes.html"));
2688  });
2689  
2690  app.get("/notificacao", (req,res) => {
2691    return res.redirect("/notificacoes");
2692  });
2693  
2694  app.get("/notifications", (req,res) => {
2695    return res.redirect("/notificacoes");
2696  });
2697  
2698  /* MERCADO PAGO CHECKOUT */
2699  app.post("/api/mercadopago/checkout", async (req,res)=>{
2700  
2701   try{
2702  
2703     const { titulo, preco } = req.body;
2704  
2705     const preference = {
2706       items:[{
2707         title: titulo || "Plano Flux",
2708         quantity:1,
2709         currency_id:"BRL",
2710         unit_price:Number(preco || 29.90)
2711       }],
2712  
2713       back_urls:{
2714         success: process.env.BASE_URL + "/premium?success=1",
2715         failure: process.env.BASE_URL + "/premium?erro=1",
2716         pending: process.env.BASE_URL + "/premium?pending=1"
2717       },
2718  
2719       auto_return:"approved",
2720  
2721       notification_url:
2722        process.env.BASE_URL + "/api/mercadopago/webhook"
2723     };
2724  
2725     const response =
2726      await mercadopago.preferences.create(preference);
2727  
2728     res.json({
2729       ok:true,
2730       init_point: response.body.init_point
2731     });
2732  
2733   }catch(err){
2734  
2735     console.log("mercadopago:",err);
2736  
2737     res.status(500).json({
2738       erro:true,
2739       mensagem: err.message
2740     });
2741   }
2742  
2743  });
2744  
2745  /* WEBHOOK MERCADO PAGO */
2746  app.post("/api/mercadopago/webhook",(req,res)=>{
2747  
2748   console.log("WEBHOOK MP:", req.body);
2749  
2750   return res.sendStatus(200);
2751  
2752  });
2753  
2754  /* =========================
2755     CARTEIRA FLUX
2756  ========================= */
2757  
2758  const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", new mongoose.Schema({
2759  
2760   userId:String,
2761   tipoConta:String,
2762  
2763   saldoDisponivel:{
2764    type:Number,
2765    default:0
2766   },
2767  
2768   saldoPendente:{
2769    type:Number,
2770    default:0
2771   },
2772  
2773   totalRecebido:{
2774    type:Number,
2775    default:0
2776   },
2777  
2778   totalGasto:{
2779    type:Number,
2780    default:0
2781   },
2782  
2783   moeda:{
2784    type:String,
2785    default:"BRL"
2786   },
2787  
2788   ativa:{
2789    type:Boolean,
2790    default:true
2791   }
2792  
2793  },{timestamps:true}));
2794  
2795  
2796  const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", new mongoose.Schema({
2797  
2798   userId:String,
2799  
2800   tipo:String,
2801  
2802   descricao:String,
2803  
2804   valor:Number,
2805  
2806   status:{
2807    type:String,
2808    default:"pendente"
2809   },
2810  
2811   metodo:String,
2812  
2813   referencia:String
2814  
2815  },{timestamps:true}));
2816  
2817  
2818  /* CRIAR / PEGAR CARTEIRA */
2819  app.get("/api/wallet/:userId", async (req,res)=>{
2820  
2821   try{
2822  
2823    let wallet = await Wallet.findOne({
2824     userId:req.params.userId
2825    });
2826  
2827    if(!wallet){
2828  
2829     wallet = await Wallet.create({
2830      userId:req.params.userId,
2831      tipoConta:"usuario"
2832     });
2833  
2834    }
2835  
2836    return res.json({
2837     ok:true,
2838     wallet
2839    });
2840  
2841   }catch(err){
2842  
2843    console.log("wallet:",err);
2844  
2845    return res.status(500).json({
2846     erro:true,
2847     mensagem:err.message
2848    });
2849  
2850   }
2851  
2852  });
2853  
2854  
2855  /* HISTÓRICO */
2856  app.get("/api/wallet/:userId/transacoes", async (req,res)=>{
2857  
2858   try{
2859  
2860    const transacoes =
2861     await WalletTransaction
2862     .find({userId:req.params.userId})
2863     .sort({_id:-1})
2864     .limit(100);
2865  
2866    return res.json({
2867     ok:true,
2868     transacoes
2869    });
2870  
2871   }catch(err){
2872  
2873    console.log("wallet transacoes:",err);
2874  
2875    return res.status(500).json({
2876     erro:true
2877    });
2878  
2879   }
2880  
2881  });
2882  
2883  
2884  /* CREDITAR */
2885  app.post("/api/wallet/creditar", async (req,res)=>{
2886  
2887   try{
2888  
2889    const {
2890     userId,
2891     valor,
2892     descricao,
2893     metodo
2894    } = req.body;
2895  
2896    let wallet =
2897     await Wallet.findOne({userId});
2898  
2899    if(!wallet){
2900  
2901     wallet = await Wallet.create({
2902      userId
2903     });
2904  
2905    }
2906  
2907    wallet.saldoDisponivel += Number(valor || 0);
2908    wallet.totalRecebido += Number(valor || 0);
2909  
2910    await wallet.save();
2911  
2912    await WalletTransaction.create({
2913  
2914     userId,
2915  
2916     tipo:"credito",
2917  
2918     descricao:
2919      descricao || "Crédito carteira",
2920  
2921     valor:Number(valor || 0),
2922  
2923     status:"aprovado",
2924  
2925     metodo:
2926      metodo || "manual"
2927  
2928    });
2929  
2930    return res.json({
2931     ok:true,
2932     wallet
2933    });
2934  
2935   }catch(err){
2936  
2937    console.log("wallet credito:",err);
2938  
2939    return res.status(500).json({
2940     erro:true
2941    });
2942  
2943   }
2944  
2945  });
2946  
2947  
2948  /* DEBITAR */
2949  app.post("/api/wallet/debitar", async (req,res)=>{
2950  
2951   try{
2952  
2953    const {
2954     userId,
2955     valor,
2956     descricao,
2957     metodo
2958    } = req.body;
2959  
2960    const wallet =
2961     await Wallet.findOne({userId});
2962  
2963    if(!wallet){
2964  
2965     return res.status(404).json({
2966      erro:"wallet_nao_encontrada"
2967     });
2968  
2969    }
2970  
2971    if(wallet.saldoDisponivel < Number(valor || 0)){
2972  
2973     return res.status(400).json({
2974      erro:"saldo_insuficiente"
2975     });
2976  
2977    }
2978  
2979    wallet.saldoDisponivel -= Number(valor || 0);
2980    wallet.totalGasto += Number(valor || 0);
2981  
2982    await wallet.save();
2983  
2984    await WalletTransaction.create({
2985  
2986     userId,
2987  
2988     tipo:"debito",
2989  
2990     descricao:
2991      descricao || "Débito carteira",
2992  
2993     valor:Number(valor || 0),
2994  
2995     status:"aprovado",
2996  
2997     metodo:
2998      metodo || "manual"
2999  
3000    });
3001  
3002    return res.json({
3003     ok:true,
3004     wallet
3005    });
3006  
3007   }catch(err){
3008  
3009    console.log("wallet debito:",err);
3010  
3011    return res.status(500).json({
3012     erro:true
3013    });
3014  
3015   }
3016  
3017  });
3018  
3019  /* =========================
3020     MERCADO LIVRE LOGIN
3021  ========================= */
3022  
3023  
3024  
3025  
3026  
3027  
3028  /* MERCADO LIVRE IMPORTADOR DE PRODUTOS */
3029  const MLIntegration = mongoose.models.MLIntegration || mongoose.model("MLIntegration", new mongoose.Schema({
3030    userId:String,
3031    accessToken:String,
3032    refreshToken:String,
3033    expiresIn:Number,
3034    tokenType:String,
3035    ativo:{type:Boolean,default:true}
3036  },{timestamps:true}));
3037  
3038  app.get("/api/ml/produtos", async (req,res)=>{
3039   try{
3040    const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
3041  
3042    if(!ml || !ml.accessToken){
3043     return res.status(400).json({erro:"mercado_livre_nao_conectado"});
3044    }
3045  
3046    const userRes = await fetch("https://api.mercadolibre.com/users/me",{
3047     headers:{Authorization:"Bearer " + ml.accessToken}
3048    });
3049  
3050    const user = await userRes.json();
3051  
3052    const itemsRes = await fetch("https://api.mercadolibre.com/users/" + user.id + "/items/search",{
3053     headers:{Authorization:"Bearer " + ml.accessToken}
3054    });
3055  
3056    const itemsData = await itemsRes.json();
3057    const ids = (itemsData.results || []).slice(0,20);
3058  
3059    if(!ids.length){
3060     return res.json({ok:true, vendedor:user, produtos:[]});
3061    }
3062  
3063    const detailsRes = await fetch("https://api.mercadolibre.com/items?ids=" + ids.join(","),{
3064     headers:{Authorization:"Bearer " + ml.accessToken}
3065    });
3066  
3067    const details = await detailsRes.json();
3068  
3069    const produtos = details.map(x => x.body).filter(Boolean).map(item => ({
3070     mlId:item.id,
3071     titulo:item.title,
3072     preco:item.price,
3073     estoque:item.available_quantity,
3074     link:item.permalink,
3075     imagem:item.thumbnail,
3076     status:item.status,
3077     vendedor:{
3078      id:user.id,
3079      nickname:user.nickname,
3080      reputacao:user.seller_reputation || {}
3081     },
3082     linkFlux:"/go/ml/" + item.id
3083    }));
3084  
3085    return res.json({ok:true, vendedor:user, produtos});
3086  
3087   }catch(err){
3088    console.log("ML PRODUTOS ERRO:",err);
3089    return res.status(500).json({erro:err.message});
3090   }
3091  });
3092  
3093  app.get("/go/ml/:id", async (req,res)=>{
3094   try{
3095    const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
3096    if(!ml) return res.redirect("/marketplace");
3097  
3098    const itemRes = await fetch("https://api.mercadolibre.com/items/" + req.params.id,{
3099     headers:{Authorization:"Bearer " + ml.accessToken}
3100    });
3101  
3102    const item = await itemRes.json();
3103  
3104    return res.redirect(item.permalink || "/marketplace");
3105   }catch(e){
3106    return res.redirect("/marketplace");
3107   }
3108  });
3109  
3110  /* MERCADO LIVRE PUBLICO - SEM OAUTH */
3111  app.get("/api/ml/buscar", async (req,res)=>{
3112   try{
3113    const q = String(req.query.q || "moda feminina").trim();
3114  
3115    const r = await fetch("https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(q) + "&limit=20");
3116    const data = await r.json();
3117  
3118    const produtos = ((Array.isArray(data.results) ? data.results : [])).map(p=>({
3119     mlId:p.id,
3120     titulo:p.title,
3121     preco:p.price,
3122     imagem:p.thumbnail,
3123     link:p.permalink,
3124     vendedor:p.seller || {},
3125     linkFlux:"/go-public/ml/" + p.id
3126    }));
3127  
3128    return res.json({ok:true, busca:q, produtos});
3129   }catch(err){
3130    return res.status(500).json({ok:false, erro:err.message});
3131   }
3132  });
3133  
3134  app.get("/go-public/ml/:id", async (req,res)=>{
3135   try{
3136    const r = await fetch("https://api.mercadolibre.com/items/" + req.params.id);
3137    const item = await r.json();
3138  
3139    return res.redirect(item.permalink || "/marketplace");
3140   }catch(e){
3141    return res.redirect("/marketplace");
3142   }
3143  });
3144  
3145  
3146  
3147  /* IMPORTAR PRODUTOS ML */
3148  app.get("/api/ml/importar", async (req,res)=>{
3149   try{
3150    const ml = await MLIntegration.findOne({ativo:true}).sort({_id:-1});
3151  
3152    if(!ml || !ml.accessToken){
3153     return res.status(400).json({erro:"mercado_livre_nao_conectado"});
3154    }
3155  
3156    const userRes = await fetch("https://api.mercadolibre.com/users/me",{
3157     headers:{Authorization:"Bearer " + ml.accessToken}
3158    });
3159  
3160    const user = await userRes.json();
3161  
3162    const busca = await fetch("https://api.mercadolibre.com/users/" + user.id + "/items/search",{
3163     headers:{Authorization:"Bearer " + ml.accessToken}
3164    });
3165  
3166    const dadosBusca = await busca.json();
3167    const ids = dadosBusca.results || [];
3168    const produtos = [];
3169  
3170    for(const id of ids.slice(0,20)){
3171     const r = await fetch("https://api.mercadolibre.com/items/" + id,{
3172      headers:{Authorization:"Bearer " + ml.accessToken}
3173     });
3174  
3175     const p = await r.json();
3176  
3177     produtos.push({
3178      mlId:p.id,
3179      titulo:p.title,
3180      preco:p.price,
3181      imagem:p.thumbnail,
3182      link:p.permalink,
3183      loja:user.nickname,
3184      vendedorId:user.id,
3185      linkFlux:"/go/ml/" + p.id
3186     });
3187    }
3188  
3189    if(produtos.length){
3190     await mongoose.connection.db.collection("flux_produtos_ml").deleteMany({vendedorId:user.id});
3191     await mongoose.connection.db.collection("flux_produtos_ml").insertMany(produtos);
3192    }
3193  
3194    return res.json({ok:true,vendedor:user.nickname,total:produtos.length,produtos});
3195  
3196   }catch(err){
3197    return res.status(500).json({ok:false,erro:err.message});
3198   }
3199  });
3200  server.listen(PORT, "0.0.0.0", () => {
3201    const ip = getLocalIP();
3202   
3203    console.log("\nFLUX ONLINE\n");
3204    console.log("Local:   http://localhost:" + PORT);
3205    console.log("Celular: http://" + ip + ":" + PORT);
3206    console.log("\nAdmin seguro: senha protegida por variável de ambiente");
3207    console.log("Feed + Fluxo + Admin + Planos + Stripe + Estoque/Pedidos ativos\n");
3208  });