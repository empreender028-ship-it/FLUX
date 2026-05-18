const fs = require("fs");

const file = "public/fluxo.html";

let s = fs.readFileSync(file,"utf8");

if(!s.includes("registrarWatchTime")){

s = s.replace(
`function setupVideos(){`,
`
function registrarWatchTime(video,postId){

 if(!video || !postId) return;

 let sent = false;

 video.addEventListener("timeupdate",()=>{

  if(sent) return;

  if(!video.duration) return;

  const percent = Math.round(
   (video.currentTime / video.duration) * 100
  );

  if(percent >= 35){

   sent = true;

   fetch("/api/watch/" + postId,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      seconds:Math.round(video.currentTime),
      percent
    })
   }).catch(()=>{});

  }

 });

}

function setupVideos(){`
);

s = s.replace(
`const currentVideo = card.querySelector("video");`,
`const currentVideo = card.querySelector("video");

const postId =
 card.dataset.postId ||
 card.getAttribute("data-post-id");

if(currentVideo && postId){
 registrarWatchTime(currentVideo,postId);
}`
);

}

fs.writeFileSync(file,s,"utf8");

console.log("WATCH TIME AUTOMATICO APLICADO.");
