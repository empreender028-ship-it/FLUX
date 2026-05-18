const fs = require("fs");

const file = "public/fluxo.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/fluxo.backup-central-force.html");

s = s.replace("</style>", `
/* FORCE DESKTOP APP CENTER */
@media(min-width:900px){
  html,body{
    width:100%!important;
    min-height:100%!important;
    margin:0!important;
    background:#050505!important;
    overflow-x:hidden!important;
  }

  body::before{
    content:"";
    position:fixed;
    inset:0;
    background:radial-gradient(circle at center, rgba(0,217,255,.08), transparent 45%);
    pointer-events:none;
    z-index:-1;
  }

  main,
  section,
  #app,
  #feed,
  .feed,
  .fluxo,
  .flux-feed,
  .timeline,
  .container{
    width:430px!important;
    max-width:430px!important;
    margin-left:auto!important;
    margin-right:auto!important;
  }

  article,
  .post,
  .card,
  .flux-card,
  .item,
  .reel{
    width:430px!important;
    max-width:430px!important;
    margin-left:auto!important;
    margin-right:auto!important;
  }

  video,
  img.media,
  .media,
  .post-media img,
  .post-media video{
    max-width:430px!important;
  }
}
</style>`);

fs.writeFileSync(file,s,"utf8");
console.log("FLUXO CENTRAL FORCADO NO DESKTOP.");
