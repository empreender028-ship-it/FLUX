const API = window.location.origin;

const token = localStorage.getItem("token");

const routes = {
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

function authHeader() {
return {
"Authorization": `Bearer ${token}`,
"Content-Type": "application/json"
};
}

async function api(path, options = {}) {
try {
const response = await fetch(`${API}${path}`, {
...options,
headers: {
...authHeader(),
...(options.headers || {})
}
});

```
if (!response.ok) {
  console.error("Erro API:", response.status);
  return null;
}

return await response.json();
```

} catch (error) {
console.error("Erro de conexão:", error);
return null;
}
}

async function getMe() {
if (!token) return null;

try {
return await api("/empresa/me");
} catch (error) {
console.error(error);
return null;
}
}

function navigate(route) {
if (!routes[route]) {
console.error("Rota não encontrada:", route);
return;
}

window.location.href = routes[route];
}

function logout() {
localStorage.removeItem("token");
localStorage.removeItem("user");
navigate("login");
}

function protectPage() {
if (!token) {
navigate("login");
}
}

function isMobile() {
return window.innerWidth <= 768;
}

function setupMobileMenu() {
const menuBtn = document.querySelector(".mobile-menu-btn");
const sidebar = document.querySelector(".sidebar");

if (!menuBtn || !sidebar) return;

menuBtn.addEventListener("click", () => {
sidebar.classList.toggle("active");
});
}

function loading(state = true) {
const loader = document.querySelector(".global-loader");

if (!loader) return;

loader.style.display = state ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
setupMobileMenu();

document.querySelectorAll("[data-route]").forEach(button => {
button.addEventListener("click", () => {
const route = button.dataset.route;
navigate(route);
});
});
});
