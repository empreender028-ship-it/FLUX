const fs = require("fs");

const file = "public/fluxo.html";

let s = fs.readFileSync(file,"utf8");

if(!s.includes("skeleton-card")){

s = s.replace(
"</style>",
`
.skeleton-wrap{
  display:flex;
  flex-direction:column;
  gap:18px;
  padding:20px;
}

.skeleton-card{
  height:88vh;
  border-radius:28px;
  position:relative;
  overflow:hidden;
  background:#111;
}

.skeleton-card::before{
  content:"";
  position:absolute;
  inset:0;
  transform:translateX(-100%);
  background:linear-gradient(
    90deg,
    transparent,
    rgba(255,255,255,.08),
    transparent
  );
  animation:skeleton 1.2s infinite;
}

@keyframes skeleton{
  100%{
    transform:translateX(100%);
  }
}
</style>`
);

s = s.replace(
`<div id="feed"></div>`,
`
<div id="skeletons" class="skeleton-wrap">
  <div class="skeleton-card"></div>
  <div class="skeleton-card"></div>
</div>

<div id="feed"></div>`
);

s = s.replace(
`async function carregarFeed(){`,
`async function carregarFeed(){

const skeletons =
 document.getElementById("skeletons");

if(skeletons){
 skeletons.style.display = "flex";
}`
);

s = s.replace(
`renderFeed(posts);`,
`
if(skeletons){
 skeletons.style.display = "none";
}

renderFeed(posts);`
);

}

fs.writeFileSync(file,s,"utf8");

console.log("SKELETON LOADING APLICADO.");
