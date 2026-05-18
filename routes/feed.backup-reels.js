// public/feed.js
// FLUX • Feed global funcional

const API = "";

const FluxFeed = {
  posts: [],
  liked: new Set(JSON.parse(localStorage.getItem("flux_liked") || "[]")),
  saved: new Set(JSON.parse(localStorage.getItem("flux_saved") || "[]")),
  viewed: new Set(JSON.parse(localStorage.getItem("flux_viewed") || "[]")),
  token: localStorage.getItem("token") || "",
  socket: null
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

function compact(num){
  num = Number(num || 0);
  if(num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if(num >= 1000) return (num / 1000).toFixed(1) + "k";
  return String(num);
}

function initials(name){
  return String(name || "FX")
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0,2)
    .toUpperCase();
}

function headers(){
  return FluxFeed.token ? { Authorization:"Bearer " + FluxFeed.token } : {};
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
  },1600);
}

function mediaSrc(media){
  if(!media) return "";
  return media.startsWith("http") ? media : "/uploads/" + media;
}

function mediaCarousel(post){

  const medias = Array.isArray(post.medias) && post.medias.length
    ? post.medias
    : (post.media ? [post.media] : []);

  if(!medias.length) return "";

  return `
    <div class="flux-carousel">
      <div class="flux-carousel-track">
        ${medias.map(src=>{

          const video = /\.(mp4|webm|mov|m4v)/i.test(src);

          if(video){
            return `
              <div class="flux-slide">
                <video
                  src="${src}"
                  playsinline
                  muted
                  loop
                  controls
                ></video>
              </div>
            `;
          }

          return `
            <div class="flux-slide">
              <img src="${src}" loading="lazy">
            </div>
          `;

        }).join("")}
      </div>

      <div class="flux-dots">
        ${medias.map(()=>'<span></span>').join("")}
      </div>
    </div>
  `;
}

function postMedia(post){
  const src = mediaSrc(post.media || "");

  if(!src){
    return `
      <div class="visual">
        ${safe(initials(post.empresaNome))}
      </div>
    `;
  }

  const video = /\.(mp4|webm|mov|quicktime)$/i.test(src);

  if(video){
    return `
      <video
        src="${safe(src)}"
        autoplay
        muted
        loop
        playsinline
        preload="metadata">
      </video>
    `;
  }

  return `
    <img
      src="${safe(src)}"
      alt="${safe(post.empresaNome || "Flux")}"
      loading="lazy">
  `;
}

function postHTML(post,index){
  const id = String(post._id || post.id || "post-" + index);
  const liked = FluxFeed.liked.has(id);
  const saved = FluxFeed.saved.has(id);
  const name = post.empresaNome || "Empresa Flux";
  const desc = post.descricao || "Nova publicação na Flux.";
  const tipo = post.tipo || "feed";
  const plano = post.plano || post.empresaPlano || "Start";
  const ini = initials(name);

  return `
    <article class="post" data-id="${safe(id)}">
      <div class="post-head">
        <a class="company" href="/empresa?id=${safe(post.empresaId || "")}">
          <div class="avatar">${safe(ini)}</div>

          <div class="info">
            <h3>${safe(name)}</h3>
            <p>${safe(plano)} • ${safe(tipo)} • agora</p>
          </div>
        </a>

        <a class="more" href="/empresa?id=${safe(post.empresaId || "")}">•</a>
      </div>

      <div class="media real">
        ${mediaCarousel(post)}

        <div class="live">${safe(tipo.toUpperCase())}</div>

        <div class="score">
          ${compact(post.views || 0)} views
        </div>

        <div class="metrics">
          <div class="metric">
            <strong data-views>${compact(post.views || 0)}</strong>
            <span>views</span>
          </div>
        </div>

        <div class="live-comments" id="comments-${safe(id)}"></div>
      </div>

      <div class="post-body">
        <div class="actions">
          <button class="btn ${liked ? "active" : ""}" data-action="like">
            Curtir <span data-like-count>${compact(post.likes || 0)}</span>
          </button>

          <button class="btn ${saved ? "active" : ""}" data-action="save">
            ${saved ? "Salvo" : "Salvar"}
          </button>

          <button class="btn" data-action="share">
            Compartilhar
          </button>
        </div>

        <div class="caption">
          <strong>${safe(name)}</strong> ${safe(desc)}
        </div>

        <div class="meta">
          <span data-meta-views>${compact(post.views || 0)} views</span>
          <span data-meta-likes>${compact(post.likes || 0)} curtidas</span>
          <span data-meta-saves>${compact(post.saves || 0)} salvos</span>
        </div>

        <form class="comment-box" data-comment-form>
          <input placeholder="Comentar" maxlength="120">
          <button type="submit">Enviar</button>
        </form>

        <div class="typing">digitando...</div>
      </div>
    </article>
  `;
}

function renderFeed(){
  const feed = $("feed");

  if(!feed) return;

  if(!FluxFeed.posts.length){
    feed.innerHTML = `
      <div class="empty">
        Nenhum post encontrado. Publique no painel para aparecer aqui.
      </div>
    `;
    return;
  }

  feed.innerHTML = FluxFeed.posts.map(postHTML).join("");

  bindFeed();
  observeViews();
  hydrateComments();

  const loader = $("loader");
  if(loader) loader.style.display = "none";
}

function bindFeed(){
  document.querySelectorAll(".post").forEach(postEl=>{
    const id = postEl.dataset.id;

    postEl.querySelectorAll("[data-action]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const action = btn.dataset.action;

        if(action === "like"){
          await likePost(id,postEl,btn);
        }

        if(action === "save"){
          await savePost(id,postEl,btn);
        }

        if(action === "share"){
          await sharePost(id);
        }
      });
    });

    const form = postEl.querySelector("[data-comment-form]");
    if(!form) return;

    const input = form.querySelector("input");
    const typing = postEl.querySelector(".typing");

    input.addEventListener("input",()=>{
      typing.classList.toggle("show", input.value.trim().length > 0);
    });

    form.addEventListener("submit", async e=>{
      e.preventDefault();

      const text = input.value.trim();
      if(!text) return;

      addComment("comments-" + id,"Você",text);

      input.value = "";
      typing.classList.remove("show");

      await fetch(API + "/api/comments",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          ...headers()
        },
        body:JSON.stringify({
          postId:id,
          usuarioNome:"Usuário Flux",
          texto:text
        })
      }).catch(()=>{});
    });
  });
}

async function likePost(id,postEl,btn){
  if(FluxFeed.liked.has(id)){
    toast("Você já curtiu esse post");
    return;
  }

  FluxFeed.liked.add(id);
  localStorage.setItem("flux_liked",JSON.stringify([...FluxFeed.liked]));

  btn.classList.add("active");

  try{
    const res = await fetch(API + "/api/like/" + id,{
      method:"POST",
      headers:headers()
    });

    const data = await res.json();

    const count = postEl.querySelector("[data-like-count]");
    const metaLikes = postEl.querySelector("[data-meta-likes]");

    if(typeof data.likes !== "undefined"){
      if(count) count.textContent = compact(data.likes);
      if(metaLikes) metaLikes.textContent = compact(data.likes) + " curtidas";
    }

    toast("Curtida enviada");
  }catch{
    toast("Curtida salva localmente");
  }
}

async function savePost(id,postEl,btn){
  if(FluxFeed.saved.has(id)){
    toast("Esse post já está salvo");
    return;
  }

  FluxFeed.saved.add(id);
  localStorage.setItem("flux_saved",JSON.stringify([...FluxFeed.saved]));

  btn.classList.add("active");
  btn.textContent = "Salvo";

  try{
    const res = await fetch(API + "/api/save/" + id,{
      method:"POST",
      headers:headers()
    });

    const data = await res.json();

    const metaSaves = postEl.querySelector("[data-meta-saves]");

    if(typeof data.saves !== "undefined" && metaSaves){
      metaSaves.textContent = compact(data.saves) + " salvos";
    }

    toast("Post salvo");
  }catch{
    toast("Post salvo localmente");
  }
}

async function sharePost(id){
  const url = location.origin + "/feed#" + id;

  try{
    await fetch(API + "/api/share/" + id,{
      method:"POST",
      headers:headers()
    }).catch(()=>{});

    if(navigator.share){
      await navigator.share({
        title:"Flux",
        text:"Veja esse post na Flux",
        url
      });
    }else{
      await navigator.clipboard.writeText(url);
      toast("Link copiado");
    }
  }catch{}
}

function addComment(boxId,name,text){
  const box = $(boxId);
  if(!box) return;

  const item = document.createElement("div");
  item.innerHTML = `<strong>${safe(name)}</strong> ${safe(text)}`;

  box.appendChild(item);

  while(box.children.length > 4){
    box.removeChild(box.children[0]);
  }
}

async function hydrateComments(){
  document.querySelectorAll(".post").forEach(async postEl=>{
    const id = postEl.dataset.id;

    try{
      const res = await fetch(API + "/api/comments/" + id);
      const comments = await res.json();

      if(!Array.isArray(comments)) return;

      comments.slice(0,2).reverse().forEach(c=>{
        addComment("comments-" + id,c.usuarioNome || "Flux",c.texto || "");
      });
    }catch{}
  });
}

function observeViews(){
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(async entry=>{
      if(!entry.isIntersecting) return;

      const postEl = entry.target;
      const id = postEl.dataset.id;

      if(!id || FluxFeed.viewed.has(id)) return;

      FluxFeed.viewed.add(id);
      localStorage.setItem("flux_viewed",JSON.stringify([...FluxFeed.viewed]));

      try{
        const res = await fetch(API + "/api/view/" + id,{
          method:"POST",
          headers:headers()
        });

        const data = await res.json();

        if(typeof data.views !== "undefined"){
          const views = postEl.querySelector("[data-views]");
          const score = postEl.querySelector(".score");
          const metaViews = postEl.querySelector("[data-meta-views]");

          if(views) views.textContent = compact(data.views);
          if(score) score.textContent = compact(data.views) + " views";
          if(metaViews) metaViews.textContent = compact(data.views) + " views";
        }
      }catch{}
    });
  },{ threshold:.72 });

  document.querySelectorAll(".post").forEach(p=>observer.observe(p));
}

async function loadFeed(){
  const feed = $("feed");

  if(feed){
    feed.innerHTML = `<div class="empty">Carregando feed...</div>`;
  }

  try{
    const res = await fetch(API + "/api/feed");

    if(!res.ok) throw new Error("feed_off");

    const data = await res.json();

    FluxFeed.posts = Array.isArray(data) ? data : [];
  }catch{
    FluxFeed.posts = [];
  }

  renderFeed();
}

async function updateOnline(){
  const onlineCount = $("onlineCount");

  try{
    const res = await fetch(API + "/online");
    const data = await res.json();

    if(onlineCount){
      onlineCount.textContent = (data.onlineUsers || 0) + " online";
    }
  }catch{
    if(onlineCount) onlineCount.textContent = "0 online";
  }
}

function startFeedSocket(){
  try{
    FluxFeed.socket = io();

    FluxFeed.socket.on("online",total=>{
      const onlineCount = $("onlineCount");
      if(onlineCount) onlineCount.textContent = total + " online";
    });

    FluxFeed.socket.on("novo_post",post=>{
      if(post.tipo && post.tipo !== "feed") return;

      FluxFeed.posts.unshift(post);
      FluxFeed.posts = FluxFeed.posts.slice(0,40);

      renderFeed();
      toast("Novo post no Feed");
    });

    FluxFeed.socket.on("post_like",data=>{
      const post = document.querySelector(`[data-id="${data.postId}"]`);
      if(!post) return;

      const count = post.querySelector("[data-like-count]");
      const metaLikes = post.querySelector("[data-meta-likes]");

      if(count) count.textContent = compact(data.likes);
      if(metaLikes) metaLikes.textContent = compact(data.likes) + " curtidas";
    });

    FluxFeed.socket.on("novo_comentario",comment=>{
      addComment(
        "comments-" + comment.postId,
        comment.usuarioNome || "Flux",
        comment.texto || ""
      );
    });

    FluxFeed.socket.on("post_delete",data=>{
      FluxFeed.posts = FluxFeed.posts.filter(
        p => String(p._id) !== String(data.postId)
      );
      renderFeed();
    });

  }catch{}
}

function toggleTheme(){
  document.body.classList.toggle("light");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("light") ? "light" : "dark"
  );
}

function applyTheme(){
  if(localStorage.getItem("theme") === "light"){
    document.body.classList.add("light");
  }
}

function buscarFeedLocal(query){
  const q = String(query || "").toLowerCase();

  const filtrados = FluxFeed.posts.filter(p=>{
    return [
      p.empresaNome,
      p.descricao,
      p.tipo,
      p.plano
    ].join(" ").toLowerCase().includes(q);
  });

  const feed = $("feed");

  if(!feed) return;

  feed.innerHTML = filtrados.map(postHTML).join("");
  bindFeed();
  observeViews();
}

document.addEventListener("DOMContentLoaded",()=>{
  applyTheme();
  loadFeed();
  updateOnline();
  startFeedSocket();

  setInterval(updateOnline,5000);

  const search = $("search") || $("searchInput");

  if(search){
    search.addEventListener("input",()=>{
      buscarFeedLocal(search.value);
    });
  }
});

