const fs = require("fs");

const file = "public/empresa.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/empresa.backup-vitrine-premium.html");

if(!s.includes("function carregarVitrinePremium")){
s += `

<script>
async function carregarVitrinePremium(){
  try{
    const params = new URLSearchParams(location.search);
    const id = params.get("id");

    let url = id ? "/api/empresa.html/" + id : "/api/produtos";
    const res = await fetch(url,{cache:"no-store"});
    const data = await res.json();

    const perfil = data.perfil || {};
    const produtos = data.produtos || (Array.isArray(data) ? data : []);
    const posts = data.posts || [];

    const bio = document.getElementById("bio");
    if(bio && perfil.bio) bio.innerText = perfil.bio;

    const total = document.getElementById("produtos");
    if(total) total.innerText = produtos.length + " produto(s)";

    const box = document.querySelector("#produtosGrid, .products, .produtos-grid, [data-produtos]");
    if(box){
      box.innerHTML = produtos.length ? produtos.map(p=>\`
        <a class="produto-card premium-vitrine-card" href="\${p.link || "/flux-produto/" + p._id}" target="\${p.link ? "_blank" : "_self"}">
          <img src="\${p.imagem || (p.imagens && p.imagens[0]) || ""}" onerror="this.style.display='none'">
          <div>
            <strong>\${p.nome || "Produto Flux"}</strong>
            <span>\${Number(p.precoPromocional || p.preco || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
          </div>
        </a>
      \`).join("") : "<p>Nenhum produto cadastrado ainda.</p>";
    }
  }catch(e){
    console.log("vitrine premium erro",e);
  }
}

carregarVitrinePremium();
</script>
`;
}

if(!s.includes(".premium-vitrine-card")){
s = s.replace("</style>", `
.premium-vitrine-card{
  display:block;
  text-decoration:none;
  color:white;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
  border-radius:18px;
  overflow:hidden;
  margin-bottom:12px;
}
.premium-vitrine-card img{
  width:100%;
  height:180px;
  object-fit:cover;
  background:#111;
}
.premium-vitrine-card div{
  padding:12px;
}
.premium-vitrine-card strong{
  display:block;
  font-size:14px;
}
.premium-vitrine-card span{
  display:block;
  color:#00d9ff;
  font-weight:900;
  margin-top:4px;
}
</style>`);
}

fs.writeFileSync(file,s,"utf8");
console.log("PERFIL VITRINE PREMIUM APLICADO.");
