const fs = require("fs");

const file = "routes/feed.js";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"routes/feed.backup-reels.js");

if(!s.includes("function initReelsMode()")){

s += `

function initReelsMode(){

  const videos = [...document.querySelectorAll("video")];

  if(!videos.length) return;

  const observer = new IntersectionObserver(entries=>{

    entries.forEach(entry=>{

      const video = entry.target;

      if(entry.isIntersecting && entry.intersectionRatio >= 0.72){

        videos.forEach(v=>{
          if(v !== video){
            v.pause();
          }
        });

        video.muted = true;
        video.playsInline = true;

        const playPromise = video.play();

        if(playPromise){
          playPromise.catch(()=>{});
        }

      }else{

        video.pause();

      }

    });

  },{
    threshold:[0.25,0.5,0.72,1]
  });

  videos.forEach(video=>{

    video.setAttribute("playsinline","");
    video.setAttribute("webkit-playsinline","");
    video.setAttribute("muted","");
    video.setAttribute("loop","");
    video.preload = "metadata";

    observer.observe(video);

    video.addEventListener("click",()=>{

      video.muted = !video.muted;

      if(video.muted){
        toast("Som desativado");
      }else{
        toast("Som ativado");
      }

    });

  });

}

`;

}

if(!s.includes("initReelsMode();")){

s = s.replace(
"renderFeed();",
`renderFeed();
    setTimeout(initReelsMode,200);`
);

}

if(!s.includes("scroll-snap-type:y mandatory")){

s += `

const reelsStyle = document.createElement("style");

reelsStyle.innerHTML = \`

.feed{
  scroll-snap-type:y mandatory;
}

.post{
  scroll-snap-align:start;
}

.flux-slide video{
  background:#000;
}

@media(max-width:768px){

  .post{
    min-height:100vh;
  }

}

\`;

document.head.appendChild(reelsStyle);

`;

}

fs.writeFileSync(file,s,"utf8");

console.log("MODO REELS TIKTOK APLICADO.");

