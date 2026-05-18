const fs = require("fs");

const file = "routes/feed.js";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"routes/feed.backup-carrossel.js");

if(!s.includes("function mediaCarousel(post)")){

s = s.replace(
"function postMedia(post){",
`function mediaCarousel(post){

  const medias = Array.isArray(post.medias) && post.medias.length
    ? post.medias
    : (post.media ? [post.media] : []);

  if(!medias.length) return "";

  return \`
    <div class="flux-carousel">
      <div class="flux-carousel-track">
        \${medias.map(src=>{

          const video = /\\.(mp4|webm|mov|m4v)/i.test(src);

          if(video){
            return \`
              <div class="flux-slide">
                <video
                  src="\${src}"
                  playsinline
                  muted
                  loop
                  controls
                ></video>
              </div>
            \`;
          }

          return \`
            <div class="flux-slide">
              <img src="\${src}" loading="lazy">
            </div>
          \`;

        }).join("")}
      </div>

      <div class="flux-dots">
        \${medias.map(()=>'<span></span>').join("")}
      </div>
    </div>
  \`;
}

function postMedia(post){`
);

}

if(!s.includes("flux-carousel")){

s += `

const carouselStyle = document.createElement("style");

carouselStyle.innerHTML = \`

.flux-carousel{
 position:relative;
 overflow:hidden;
 border-radius:22px;
 margin-top:12px;
 background:#050505;
}

.flux-carousel-track{
 display:flex;
 overflow-x:auto;
 scroll-snap-type:x mandatory;
 -webkit-overflow-scrolling:touch;
 scrollbar-width:none;
}

.flux-carousel-track::-webkit-scrollbar{
 display:none;
}

.flux-slide{
 min-width:100%;
 scroll-snap-align:center;
 position:relative;
}

.flux-slide img,
.flux-slide video{
 width:100%;
 max-height:78vh;
 object-fit:cover;
 display:block;
 background:#000;
}

.flux-dots{
 position:absolute;
 left:50%;
 bottom:10px;
 transform:translateX(-50%);
 display:flex;
 gap:6px;
 z-index:5;
}

.flux-dots span{
 width:7px;
 height:7px;
 border-radius:999px;
 background:rgba(255,255,255,.45);
 backdrop-filter:blur(8px);
}

\`;

document.head.appendChild(carouselStyle);
`;

}

s = s.replace(
"${postMedia(post)}",
"${mediaCarousel(post)}"
);

fs.writeFileSync(file,s,"utf8");

console.log("CARROSSEL FLUX APLICADO.");

