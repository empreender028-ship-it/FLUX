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
const compression = require("compression");
const validator = require("validator");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const nodemailer = require("nodemailer");
const { Server } = require("socket.io");
 
const app = express();
app.set("trust proxy", 1);
 
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
Basic: "BÃ¡sico",
Pro: "IntermediÃ¡rio",
Avancado: "AvanÃ§ado",
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
console.error("VariÃ¡veis de produÃ§Ã£o invÃ¡lidas:", missingEnv.join(", "));
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
console.log("Webhook invÃ¡lido:", err.message);
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
console.log("MONGO_URI nÃ£o definido.");
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
stripeSubscriptionId: { type: String, default: "" }
}, { timestamps: true }));
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
/* PLANOS E PERMISSÃ•ES */
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
mensagem: "Seu plano nÃ£o possui acesso a esse recurso."
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
function requireEmpresaPaga(req, res, next) {
if (req.empresa?.tipoConta !== "empresa") {
return res.status(403).json({ erro: "somente_empresa" });
}
if (req.empresa.assinaturaStatus !== "ativo" || !["Basic", "Pro", "Avancado", "Premium"].includes(req.empresa.plano)) {
return res.status(402).json({
erro: "pagamento_necessario",
mensagem: "Escolha um plano e conclua o pagamento para liberar publicaÃ§Ãµes, produtos e painel.",
redirect: "/planos"
});
}
next();
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
 
/* ROTAS PADRÃƒO FLUX - ALIASES */
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
    titulo:"Bem-vindo Ã  Flux",
    texto:"Suas notificaÃ§Ãµes aparecerÃ£o aqui em tempo real.",
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
if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail jÃ¡ estÃ¡ cadastrado. FaÃ§a login." });
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
if (exists) return res.status(400).json({ erro: "email_existe", mensagem: "Este e-mail jÃ¡ estÃ¡ cadastrado. FaÃ§a login." });
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
const redirect = user.tipoConta === "empresa"
? (user.assinaturaStatus === "ativo" ? "/painel" : "/planos")
: "/fluxo";
res.json({
ok: true,
token,
redirect,
usuario: {
id: user._id,
nome: user.nome,
email: user.email,
plano: user.plano,
tipoConta: user.tipoConta,
assinaturaStatus: user.assinaturaStatus || "gratis"
},
empresa: {
id: user._id,
nome: user.nome,
email: user.email,
plano: user.plano,
tipoConta: user.tipoConta,
assinaturaStatus: user.assinaturaStatus || "gratis"
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
console.log("Stripe nÃ£o aceitou PIX em assinatura. Voltando para cartÃ£o:", pixErr.message);
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
/* STRIPE PIX ÃšNICO â€” CASO A STRIPE NÃƒO LIBERE PIX EM ASSINATURA */
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
console.log("Stripe PIX Ãºnico erro:", err);
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
app.get("/api/empresa.html/:id", async (req, res) => {
try {
if (!isValidObjectId(req.params.id)) return res.status(400).json({ erro: "id_invalido" });
const empresa = await Empresa.findById(req.params.id).select("-senha -stripeCustomerId -stripeSubscriptionId").lean();
if (!empresa || !empresa.ativo) return res.status(404).json({ erro: "perfil_nao_encontrado" });
const posts = await Post.find({ empresaId: String(empresa._id), status: { $ne: "removida" } }).sort({ createdAt: -1 }).limit(30).lean();
const produtos = await Produto.find({ empresaId: String(empresa._id), ativo: true }).sort({ createdAt: -1 }).limit(30).lean();
res.json({ ok: true, perfil: empresa, posts: posts.map(normalizePost), produtos });
} catch {
res.status(500).json({ erro: "perfil_publico_error" });
}
});
/* PERMISSÃ•ES */
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
mensagem: "Seu plano nÃ£o permite publicar no Fluxo."
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
const usuarioNome = cleanText(req.body.usuarioNome || req.user?.nome || "UsuÃ¡rio Flux", 80);
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
text: "A Flux estÃ¡ lendo empresas, posts, views, likes e receita direto do banco."
},
{
title: "Feed e Fluxo separados",
text: "As mÃ©tricas podem ser separadas por tipo de publicaÃ§Ã£o."
},
{
title: "Admin ativo",
text: "O painel mestre jÃ¡ pode controlar a plataforma."
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
/* MODERAÃ‡ÃƒO */
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
return res.json({ ok: true, mensagem: "JÃ¡ existem posts no feed.", total: count });
}
await Post.create([
{
empresaNome: "Premium Soles",
descricao: "LanÃ§amento beta da Flux: moda, marketplace e vÃ­deos em uma experiÃªncia mobile.",
media: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900",
tipo: "feed",
status: "aprovada",
likes: 12,
views: 230
},
{
empresaNome: "Flux",
descricao: "Fluxo vertical ativo. Testando a experiÃªncia estilo app.",
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
 
/* ROTAS DE PÃGINAS */
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
      return res.sendFile(path.join(publicPath,"feed.html"));
    }
 
    return res.status(404).send("PÃ¡gina nÃ£o encontrada: " + fileName);
  });
});
 
/* RECUPERAÃ‡ÃƒO DE SENHA */
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
        mensagem: "Digite um e-mail vÃ¡lido."
      });
    }
 
    const user = await Empresa.findOne({ email });
 
    const respostaPadrao = {
      ok: true,
      mensagem: "Se o e-mail existir, enviaremos as instruÃ§Ãµes de recuperaÃ§Ã£o."
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
        subject: "RecuperaÃ§Ã£o de senha FLUX",
        html: `
          <div style="background:#020617;color:white;padding:40px;font-family:Arial,sans-serif">
            <h1 style="margin:0 0 16px">FLUX</h1>
            <p>Recebemos uma solicitaÃ§Ã£o para redefinir sua senha.</p>
            <p>Esse link expira em 15 minutos.</p>
            <a href="${link}" style="display:inline-block;padding:14px 22px;background:#00d9ff;color:#020617;text-decoration:none;border-radius:14px;font-weight:800">
              Redefinir senha
            </a>
          </div>
        `
      });
    } else {
      console.log("Link de recuperaÃ§Ã£o gerado:", link);
    }
 
    return res.json(respostaPadrao);
  } catch (err) {
    console.log("recuperar senha:", err);
    return res.status(500).json({
      erro: "erro_recuperar_senha",
      mensagem: "NÃ£o foi possÃ­vel processar a solicitaÃ§Ã£o."
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
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ erro: "rota_nao_encontrada" });
  }
 
  return res.sendFile(path.join(publicPath,"feed.html"));
});
 
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

/* MERCADO PAGO CHECKOUT */
app.post("/api/mercadopago/checkout", async (req,res)=>{

 try{

   const { titulo, preco } = req.body;

   const preference = {
     items:[{
       title: titulo || "Plano Flux",
       quantity:1,
       currency_id:"BRL",
       unit_price:Number(preco || 29.90)
     }],

     back_urls:{
       success: process.env.BASE_URL + "/premium?success=1",
       failure: process.env.BASE_URL + "/premium?erro=1",
       pending: process.env.BASE_URL + "/premium?pending=1"
     },

     auto_return:"approved",

     notification_url:
      process.env.BASE_URL + "/api/mercadopago/webhook"
   };

   const response =
    await mercadopago.preferences.create(preference);

   res.json({
     ok:true,
     init_point: response.body.init_point
   });

 }catch(err){

   console.log("mercadopago:",err);

   res.status(500).json({
     erro:true,
     mensagem: err.message
   });
 }

});

/* WEBHOOK MERCADO PAGO */
app.post("/api/mercadopago/webhook",(req,res)=>{

 console.log("WEBHOOK MP:", req.body);

 return res.sendStatus(200);

});
server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
 
  console.log("\nFLUX ONLINE\n");
  console.log("Local:   http://localhost:" + PORT);
  console.log("Celular: http://" + ip + ":" + PORT);
  console.log("\nAdmin seguro: senha protegida por variÃ¡vel de ambiente");
  console.log("Feed + Fluxo + Admin + Planos + Stripe + Estoque/Pedidos ativos\n");
});








