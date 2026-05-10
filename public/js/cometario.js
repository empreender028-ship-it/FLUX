/* ================= FLUX COMMENTS CORE ================= */

const API = "http://localhost:3000/api";
const token = localStorage.getItem("token");

// fake postId (depois você pega da URL)
const postId = new URLSearchParams(window.location.search).get("post") || null;

let comments = [];

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    carregarComentarios();
});

// ================= HEADERS =================
function headers() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    };
}

// ================= CARREGAR COMMENTS =================
async function carregarComentarios() {

    if (!postId) return;

    try {

        const res = await fetch(API + "/comments/" + postId);
        comments = await res.json();

        renderComentarios();

    } catch (err) {
        console.log("Erro comments:", err);
    }
}

// ================= RENDER =================
function renderComentarios() {

    const container = document.getElementById("listaComentarios");

    if (!container) return;

    container.innerHTML = "";

    comments.forEach(c => {

        const div = document.createElement("div");

        div.className = "comment";

        div.innerHTML = `
            <div class="comment-top">

                <div class="comment-user">

                    <div class="comment-avatar">
                        ${getInitials(c.usuarioNome)}
                    </div>

                    <div>

                        <div class="comment-name">
                            ${c.usuarioNome}
                        </div>

                        <div class="comment-time">
                            agora
                        </div>

                    </div>

                </div>

            </div>

            <div class="comment-text">
                ${c.texto}
            </div>
        `;

        container.appendChild(div);

    });
}

// ================= ENVIAR =================
async function enviarComentario() {

    const input = document.getElementById("comentario");

    const texto = input.value.trim();

    if (!texto) return;

    try {

        const res = await fetch(API + "/comments", {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
                postId,
                texto
            })
        });

        const data = await res.json();

        if (!data.ok) return;

        // adiciona na tela instantâneo
        comments.unshift({
            usuarioNome: "Você",
            texto
        });

        renderComentarios();

        input.value = "";

    } catch (err) {
        console.log("Erro enviar:", err);
    }
}

// ================= HELPERS =================
function getInitials(name) {

    if (!name) return "U";

    return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

}

// ================= ENTER =================
document.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
        enviarComentario();
    }

});