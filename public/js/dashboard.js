// ========================================
// FLUX REALTIME ENGINE 2030
// ========================================

const API =
 "http://localhost:3000/api"

const socket =
 io("http://localhost:3000",{

  transports:["websocket"],

  reconnection:true,

  reconnectionAttempts:999,

  reconnectionDelay:1200

 })

// ========================================
// GLOBAL STATE
// ========================================

const FluxState = {

 posts:new Map(),

 rendered:new Set(),

 empresa:null,

 loading:false,

 feedPage:1,

 hasMore:true,

 realtimeQueue:[],

 cache:new Map()

}

// ========================================
// INIT
// ========================================

window.addEventListener(
 "DOMContentLoaded",
 async ()=>{

  await boot()

 }
)

async function boot(){

 try{

  loading(true)

  await Promise.all([

   carregarEmpresa(),

   carregarFeed()

  ])

  setupRealtime()

  infiniteFeed()

 }catch(error){

  console.error(error)

  toast("Erro ao iniciar")

 }finally{

  loading(false)

 }

}

// ========================================
// SOCKET
// ========================================

function setupRealtime(){

 socket.on("connect",()=>{

  console.log(
   "⚡ realtime online"
  )

 })

 socket.on("disconnect",()=>{

  toast("Reconectando...")
 })

 // ONLINE

 socket.on("online",(count)=>{

  updateText(
   "onlineCount",
   count
  )

 })

 // VIEW

 socket.on("view",(data)=>{

  queueRealtime(()=>{

   increaseViews(
    data.postId
   )

  })

 })

 // LEAD

 socket.on("lead",(data)=>{

  queueRealtime(()=>{

   animateLead(
    data.postId
   )

  })

 })

}

// ========================================
// REALTIME QUEUE
// ========================================

function queueRealtime(callback){

 FluxState.realtimeQueue.push(
  callback
 )

 if(
  FluxState.realtimeQueue.length === 1
 ){

  processQueue()
 }

}

function processQueue(){

 if(
  !FluxState.realtimeQueue.length
 ) return

 const fn =
  FluxState.realtimeQueue[0]

 requestAnimationFrame(()=>{

  fn()

  FluxState.realtimeQueue.shift()

  processQueue()

 })

}

// ========================================
// EMPRESA
// ========================================

async function carregarEmpresa(){

 const token =
  localStorage.getItem("token")

 if(!token){

  location.href =
   "/login.html"

  return
 }

 const data =
  await api("/empresa/me",{

   headers:{
    Authorization:
     `Bearer ${token}`
   }

  })

 if(!data) return

 FluxState.empresa = data

 updateText(
  "empresaNome",
  data.nome || "Flux"
 )

 updateText(
  "empresaPlano",
  data.plano || "Premium"
 )

}

// ========================================
// FEED
// ========================================

async function carregarFeed(){

 if(
  FluxState.loading ||
  !FluxState.hasMore
 ) return

 FluxState.loading = true

 skeletonFeed()

 const data =
  await api(
   `/feed?page=${FluxState.feedPage}`
  )

 removeSkeleton()

 if(!data?.length){

  FluxState.hasMore = false

  return
 }

 data.forEach(post=>{

  FluxState.posts.set(
   post._id,
   post
  )

 })

 renderFeed(data)

 FluxState.feedPage++

 FluxState.loading = false

}

// ========================================
// RENDER
// ========================================

function renderFeed(posts){

 const feed =
  document.getElementById(
   "feed"
  )

 if(!feed) return

 const fragment =
  document.createDocumentFragment()

 posts.forEach(post=>{

  if(
   FluxState.rendered.has(post._id)
  ) return

  FluxState.rendered.add(post._id)

  const card =
   createPost(post)

  fragment.appendChild(card)

 })

 feed.appendChild(fragment)

}

// ========================================
// POST CARD
// ========================================

function createPost(post){

 const card =
  document.createElement("article")

 card.className =
  "post-card"

 card.dataset.id =
  post._id

 const media =
  sanitize(
   post.media || ""
  )

 const desc =
  sanitize(
   post.descricao ||
   "Sem descrição"
  )

 card.innerHTML = `

  <div class="post-media">

   <img
    loading="lazy"
    src="/uploads/${media}"
    onerror="
     this.src='/img/fallback.png'
    "
   >

  </div>

  <div class="post-content">

   <div class="post-top">

    <h3>${desc}</h3>

   </div>

   <div class="post-stats">

    <span>
     👁
     <b id="views-${post._id}">
      ${post.views || 0}
     </b>
    </span>

   </div>

   <div class="post-actions">

    <button
     onclick="verPost('${post._id}')"
    >
     Ver
    </button>

    <button
     onclick="darLead('${post._id}')"
    >
     Lead
    </button>

   </div>

  </div>

 `

 return card

}

// ========================================
// VIEW
// ========================================

async function verPost(id){

 increaseViews(id)

 navigator.vibrate?.(10)

 await api(`/view/${id}`,{
  method:"POST"
 })

}

// ========================================
// LEAD
// ========================================

async function darLead(id){

 pulseCard(id)

 await api("/lead",{

  method:"POST",

  body:JSON.stringify({
   postId:id
  })

 })

}

// ========================================
// UPDATE
// ========================================

function increaseViews(id){

 const el =
  document.getElementById(
   `views-${id}`
  )

 if(!el) return

 el.innerText =
  parseInt(el.innerText || 0) + 1

}

function animateLead(id){

 const card =
  document.querySelector(
   `[data-id="${id}"]`
  )

 if(!card) return

 card.animate([

  {
   transform:"scale(1)"
  },

  {
   transform:"scale(1.02)"
  },

  {
   transform:"scale(1)"
  }

 ],{

  duration:320

 })

}

// ========================================
// INFINITE FEED
// ========================================

function infiniteFeed(){

 const observer =
  new IntersectionObserver(entries=>{

   if(entries[0].isIntersecting){

    carregarFeed()

   }

  },{

   threshold:.1

  })

 const trigger =
  document.getElementById(
   "feed-trigger"
  )

 if(trigger){

  observer.observe(trigger)

 }

}

// ========================================
// HELPERS
// ========================================

function updateText(id,text){

 const el =
  document.getElementById(id)

 if(el){

  el.innerText = text
 }

}

function pulseCard(id){

 const card =
  document.querySelector(
   `[data-id="${id}"]`
  )

 if(card){

  card.classList.add("pulse")

  setTimeout(()=>{

   card.classList.remove(
    "pulse"
   )

  },400)

 }

}

// ========================================
// SECURITY
// ========================================

function sanitize(text=""){

 return text
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")

}

// ========================================
// LOADING
// ========================================

function loading(show=true){

 document.body.classList.toggle(
  "loading",
  show
 )

}

function skeletonFeed(){

 const feed =
  document.getElementById("feed")

 if(!feed) return

 feed.innerHTML += `

  <div class="skeleton-post"></div>
  <div class="skeleton-post"></div>

 `

}

function removeSkeleton(){

 document
 .querySelectorAll(".skeleton-post")
 .forEach(el=>el.remove())

}

// ========================================
// API
// ========================================

async function api(
 url,
 options={}
){

 try{

  const response =
   await fetch(
    API + url,
    options
   )

  return await response.json()

 }catch(error){

  console.error(error)

  return null

 }

}

// ========================================
// LOGOUT
// ========================================

function logout(){

 localStorage.clear()

 location.href =
  "/login.html"

}

