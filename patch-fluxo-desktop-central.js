const fs = require("fs");

const file = "public/fluxo.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/fluxo.backup-desktop-central.html");

s = s.replace("</style>", `
/* FLUXO DESKTOP CENTRAL IGUAL APP */
@media(min-width:900px){
  body{
    background:#050505!important;
    display:flex;
    justify-content:center;
  }

  .feed,
  #feed,
  .flux-feed{
    width:430px!important;
    max-width:430px!important;
    margin:0 auto!important;
    min-height:100vh;
    overflow:hidden;
    border-left:1px solid rgba(255,255,255,.08);
    border-right:1px solid rgba(255,255,255,.08);
    background:#000;
  }

  .post,
  .card,
  .flux-card{
    width:430px!important;
    max-width:430px!important;
    min-height:100vh!important;
    margin:0 auto!important;
    border-radius:0!important;
  }

  .post video,
  .post img,
  .card video,
  .card img{
    width:430px!important;
    max-width:430px!important;
    height:100vh!important;
    object-fit:cover!important;
  }
}
</style>`);

fs.writeFileSync(file,s,"utf8");
console.log("FLUXO DESKTOP CENTRALIZADO APLICADO.");
