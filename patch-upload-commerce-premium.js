const fs = require("fs");

const file = "public/upload-commerce.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/upload-commerce.backup-premium.html");

s = s.replace("</style>", `
.drop{
  border:2px dashed rgba(0,217,255,.35);
  border-radius:22px;
  padding:22px;
  text-align:center;
  margin:12px 0;
  background:rgba(0,217,255,.06);
  cursor:pointer;
  font-weight:900;
}
.drop.drag{
  background:rgba(0,217,255,.14);
}
.preview{
  display:grid!important;
  grid-template-columns:repeat(auto-fill,minmax(110px,1fr));
}
.preview img,.preview video{
  width:100%!important;
  height:160px!important;
  object-fit:cover;
  border-radius:18px;
  background:#000;
}
.preview-item{
  position:relative;
}
.preview-item span{
  position:absolute;
  top:6px;
  left:6px;
  background:#00d9ff;
  color:#001018;
  border-radius:999px;
  padding:4px 8px;
  font-size:11px;
  font-weight:900;
}
.progress{
  height:10px;
  background:#111;
  border-radius:999px;
  overflow:hidden;
  margin:12px 0;
}
.progress div{
  height:100%;
  width:0%;
  background:#00d9ff;
  transition:.2s;
}
</style>`);

s = s.replace(
`<input id="medias" type="file" multiple accept="image/*,video/*">
<div class="preview" id="preview"></div>`,
`<div class="drop" id="drop">
  Arraste fotos/vídeos aqui ou clique para selecionar
</div>
<input id="medias" type="file" multiple accept="image/*,video/*" style="display:none">
<div class="preview" id="preview"></div>
<div class="progress"><div id="bar"></div></div>`
);

s = s.replace(
`const medias = document.getElementById("medias");
const preview = document.getElementById("preview");`,
`const medias = document.getElementById("medias");
const preview = document.getElementById("preview");
const drop = document.getElementById("drop");
const bar = document.getElementById("bar");

drop.onclick = () => medias.click();

drop.ondragover = e => {
 e.preventDefault();
 drop.classList.add("drag");
};

drop.ondragleave = () => drop.classList.remove("drag");

drop.ondrop = e => {
 e.preventDefault();
 drop.classList.remove("drag");
 medias.files = e.dataTransfer.files;
 medias.onchange();
};`
);

s = s.replace(
` preview.innerHTML = "";
 [...medias.files].forEach(file=>{
  const url = URL.createObjectURL(file);
  const el = file.type.startsWith("video") ? document.createElement("video") : document.createElement("img");
  el.src = url;
  if(el.tagName==="VIDEO") el.controls = true;
  preview.appendChild(el);
 });`,
` preview.innerHTML = "";
 [...medias.files].forEach((file,i)=>{
  const url = URL.createObjectURL(file);
  const wrap = document.createElement("div");
  wrap.className = "preview-item";

  const badge = document.createElement("span");
  badge.textContent = i === 0 ? "CAPA" : (file.type.startsWith("video") ? "VÍDEO" : "FOTO");

  const el = file.type.startsWith("video") ? document.createElement("video") : document.createElement("img");
  el.src = url;

  if(el.tagName==="VIDEO"){
   el.controls = true;
   el.muted = true;
   el.playsInline = true;
  }

  wrap.appendChild(el);
  wrap.appendChild(badge);
  preview.appendChild(wrap);
 });`
);

s = s.replace(
` status.textContent = "Enviando...";`,
` status.textContent = "Enviando...";
 bar.style.width = "35%";`
);

s = s.replace(
` const data = await res.json();`,
` bar.style.width = "75%";
 const data = await res.json();
 bar.style.width = "100%";`
);

fs.writeFileSync(file,s,"utf8");

console.log("UPLOAD COMMERCE PREMIUM APLICADO.");
