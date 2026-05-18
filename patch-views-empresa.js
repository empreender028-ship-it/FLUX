const fs = require("fs");

let s = fs.readFileSync("public/empresa.html","utf8");

if(!s.includes("registrarViewsEmpresa")){

s = s.replace(
`function renderPosts(data){`,
`function registrarViewsEmpresa(){

 const posts = document.querySelectorAll("[data-post-id]");

 const observer = new IntersectionObserver(entries=>{

  entries.forEach(entry=>{

   if(entry.isIntersecting && entry.intersectionRatio > .65){

    const el = entry.target;
    const id = el.dataset.postId;

    if(!id || el.dataset.viewed === "1") return;

    el.dataset.viewed = "1";

    fetch("/api/view/" + id,{method:"POST"}).catch(()=>{});

   }

  });

 },{threshold:[.65]});

 posts.forEach(p=>observer.observe(p));
}

function renderPosts(data){`
);

s = s.replace(
`<article class="post">`,
`<article class="post" data-post-id="\${safe(post._id || post.id || "")}">`
);

s = s.replace(
` }).join("");`,
` }).join("");

 setTimeout(registrarViewsEmpresa,300);`
);

}

fs.writeFileSync("public/empresa.html",s,"utf8");

console.log("VIEWS AUTOMATICAS NO PERFIL APLICADAS.");
