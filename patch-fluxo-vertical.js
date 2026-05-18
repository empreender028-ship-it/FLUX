const fs = require("fs");

const file = "public/fluxo.html";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"public/fluxo.backup-vertical.html");

if(!s.includes("FLUXO VERTICAL MODE")){

s = s.replace("</style>", `

/* FLUXO VERTICAL MODE */

html,
body{
 scroll-behavior:smooth;
 overflow-x:hidden;
 background:#000;
}

.feed,
#feed,
.flux-feed{
 display:flex;
 flex-direction:column;
 gap:0!important;
}

.post,
.card,
.flux-card{
 min-height:100vh;
 width:100%;
 border-radius:0!important;
 margin:0!important;
 display:flex;
 flex-direction:column;
 justify-content:center;
 scroll-snap-align:start;
 position:relative;
 overflow:hidden;
 background:#000;
}

.post video,
.post img,
.card video,
.card img{
 width:100%;
 height:100vh;
 object-fit:cover;
 background:#000;
}

.post-content,
.post-info,
.overlay,
.content{
 position:absolute;
 left:0;
 right:0;
 bottom:0;
 z-index:5;
 padding:24px 18px 120px;
 background:linear-gradient(
  to top,
  rgba(0,0,0,.82),
  rgba(0,0,0,.35),
  transparent
 );
}

.actions,
.post-actions{
 position:absolute;
 right:12px;
 bottom:120px;
 z-index:8;
 display:flex;
 flex-direction:column;
 gap:14px;
}

.feed{
 scroll-snap-type:y mandatory;
}

::-webkit-scrollbar{
 width:0;
 height:0;
}

@media(min-width:900px){

 .feed,
 #feed,
 .flux-feed{
  max-width:520px;
  margin:auto;
 }

}

</style>`);

}

fs.writeFileSync(file,s,"utf8");

console.log("FLUXO VERTICAL TIKTOK APLICADO.");

