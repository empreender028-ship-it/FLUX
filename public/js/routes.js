const ROUTES = {
 home: "/index.html",
 login: "/login.html",
 cadastro: "/cadastro.html",
 feed: "/feed.html",
 fluxo: "/fluxo.html",
 painel: "/painel.html",
 admin: "/admin.html",
 perfil: "/perfil.html",
 marketplace: "/marketplace.html",
 analytics: "/analytics.html",
 trends: "/trends.html",
 lives: "/lives.html",
 empresa: "/empresa.html",
 assinatura: "/assinatura.html",
 planos: "/planos.html",
 notificacao: "/notificacao.html",
 explorar: "/explorar.html",
 ranking: "/ranking.html",
 produtos: "/produtos.html",
 upload: "/upload.html",
 config: "/config.html"
};

// ================= SAFE NAVIGATION (MOBILE + DESKTOP) =================
function go(route, options = {}) {

 const path = ROUTES[route];

 if (!path) {
  console.warn("rota não existe:", route);
  return;
 }

 // efeito visual leve (funciona no mobile também)
 document.body.style.opacity = "0.6";

 setTimeout(() => {

  if (options.replace) {
   window.location.replace(path);
  } else {
   window.location.href = path;
  }

 }, 120);
}

// ================= BACK SAFE =================
function back(fallback = "feed") {
 if (window.history.length > 1) {
  window.history.back();
 } else {
  go(fallback);
 }
}

// ================= MOBILE SAFE BUTTON BIND =================
function bindRoutes() {

 // pega TODOS os botões com data-route
 const buttons = document.querySelectorAll("[data-route]");

 buttons.forEach(btn => {

  const route = btn.dataset.route;

  // CLICK desktop
  btn.addEventListener("click", (e) => {
   e.preventDefault();
   go(route);
  });

  // TOUCH mobile (ESSENCIAL)
  btn.addEventListener("touchstart", (e) => {
   e.preventDefault();
   go(route);
  }, { passive: false });

 });

}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
 bindRoutes();
});