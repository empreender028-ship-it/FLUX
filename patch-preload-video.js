const fs = require("fs");

const file = "public/fluxo.html";

let s = fs.readFileSync(file,"utf8");

if(!s.includes("preloadNextVideo")){

s = s.replace(
`function setupVideos(){`,
`
function preloadNextVideo(currentCard){

 try{

   const next =
    currentCard?.nextElementSibling;

   if(!next) return;

   const nextVideo =
    next.querySelector("video");

   if(!nextVideo) return;

   nextVideo.preload = "auto";

   if(nextVideo.dataset.preloaded) return;

   nextVideo.dataset.preloaded = "1";

   nextVideo.load();

 }catch(e){}

}

function setupVideos(){`
);

s = s.replace(
`observer.observe(card);`,
`observer.observe(card);

const vid = card.querySelector("video");

if(vid){

 vid.addEventListener("play",()=>{
   preloadNextVideo(card);
 });

}`
);

}

fs.writeFileSync(file,s,"utf8");

console.log("PRELOAD VIDEO APLICADO.");
