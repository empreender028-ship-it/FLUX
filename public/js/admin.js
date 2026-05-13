/* ================= FLUX ADMIN PANEL ================= */

const API = "http://localhost:3000/admin";
const token = localStorage.getItem("token");

// proteção
if (!token) {
    window.location.href = "/login.html";
}

// headers padrão
function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    };
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    carregarStats();
    carregarEmpresas();
    carregarRanking();
    carregarGrafico();
});

// ================= STATS =================
async function carregarStats() {
    try {
        const res = await fetch(API + "/stats", {
            headers: authHeaders()
        });

        const data = await res.json();

        setText("empresasCount", data.empresas);
        setText("postsCount", data.posts);
        setText("viewsCount", data.views);
        setText("energiaCount", data.energia);

    } catch (err) {
        console.log("Erro stats", err);
    }
}

// ================= EMPRESAS =================
async function carregarEmpresas() {
    try {

        const res = await fetch(API + "/empresas", {
            headers: authHeaders()
        });

        const empresas = await res.json();

        const container = document.getElementById("listaEmpresas");
        if (!container) return;

        container.innerHTML = "";

        empresas.forEach(e => {

            const div = document.createElement("div");

            div.className = "empresa-card";

            div.innerHTML = `
                <div>
                    <h3>${e.nome}</h3>
                    <p>${e.email}</p>
                    <small>${e.plano}</small>
                </div>

                <button onclick="bloquear('${e._id}')">
                    Bloquear
                </button>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.log("Erro empresas", err);
    }
}

// ================= RANKING =================
async function carregarRanking() {
    try {

        const res = await fetch(API + "/ranking", {
            headers: authHeaders()
        });

        const ranking = await res.json();

        const container = document.getElementById("ranking");

        if (!container) return;

        container.innerHTML = "";

        ranking.forEach((r, i) => {

            const div = document.createElement("div");

            div.className = "ranking-item";

            div.innerHTML = `
                <span>#${i + 1}</span>
                <span>Empresa ID: ${r._id}</span>
                <strong>${r.energia}</strong>
            `;

            container.appendChild(div);

        });

    } catch (err) {
        console.log("Erro ranking", err);
    }
}

// ================= GRÁFICO SIMPLES =================
async function carregarGrafico() {
    try {

        const res = await fetch(API + "/grafico", {
            headers: authHeaders()
        });

        const data = await res.json();

        const container = document.getElementById("grafico");

        if (!container) return;

        container.innerHTML = "";

        data.forEach(item => {

            const bar = document.createElement("div");

            bar.className = "bar";

            bar.style.height = item.energia + "px";

            bar.title = item._id;

            container.appendChild(bar);

        });

    } catch (err) {
        console.log("Erro grafico", err);
    }
}

// ================= BLOQUEIO =================
async function bloquear(id) {

    try {

        await fetch(API + "/empresas/" + id + "/bloquear", {
            method: "POST",
            headers: authHeaders()
        });

        alert("Empresa bloqueada");

        carregarEmpresas();

    } catch (err) {
        console.log("Erro bloquear", err);
    }
}

// ================= HELPERS =================
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ================= LOGOUT =================
function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
}

