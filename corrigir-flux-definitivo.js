const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");

function walk(dir){
  let files = [];
  for(const item of fs.readdirSync(dir)){
    const full = path.join(dir, item);
    if(fs.statSync(full).isDirectory()){
      files = files.concat(walk(full));
    }else if(full.endsWith(".html")){
      files.push(full);
    }
  }
  return files;
}

function rep(s, codes, to){
  const from = String.fromCharCode(...codes);
  return s.split(from).join(to);
}

const cleaner = `
<script>
(function(){
function limparTexto(txt){
 txt = String(txt || "");

 txt = txt.replace(/\\u00C3\\u00A1/g,"á");
 txt = txt.replace(/\\u00C3\\u00A9/g,"é");
 txt = txt.replace(/\\u00C3\\u00AD/g,"í");
 txt = txt.replace(/\\u00C3\\u00B3/g,"ó");
 txt = txt.replace(/\\u00C3\\u00BA/g,"ú");
 txt = txt.replace(/\\u00C3\\u00A3/g,"ã");
 txt = txt.replace(/\\u00C3\\u00B5/g,"õ");
 txt = txt.replace(/\\u00C3\\u00A7/g,"ç");
 txt = txt.replace(/\\u00C3\\u00AA/g,"ê");
 txt = txt.replace(/\\u00C3\\u00B4/g,"ô");

 txt = txt.replace(/[\\u0080-\\u009F]/g,"");
 txt = txt.replace(/[\\u00C2\\u00E2\\u2122\\u00A5\\u00A1\\u2020\\u201D\\u201C\\u2013\\u2014\\uFFFD]/g,"");
 txt = txt.replace(/TM/g,"");
 txt = txt.replace(/\\s+/g," ").trim();

 return txt;
}

function limparPagina(){
 document.querySelectorAll("*").forEach(function(el){
   if(el.children.length === 0){
     var old = el.innerText || "";
     var novo = limparTexto(old);

     if(novo === "" && old.trim().length <= 4){
       el.style.display = "none";
       return;
     }

     if(novo === "T" || novo === "TM" || novo === "+" || novo === "-"){
       el.style.display = "none";
       return;
     }

     if(novo !== old){
       el.innerText = novo;
     }
   }

   ["placeholder","alt","title","aria-label"].forEach(function(a){
     if(el.hasAttribute && el.hasAttribute(a)){
       el.setAttribute(a, limparTexto(el.getAttribute(a)));
     }
   });
 });
}

document.addEventListener("DOMContentLoaded",limparPagina);
setTimeout(limparPagina,300);
setTimeout(limparPagina,1000);
setInterval(limparPagina,2000);
})();
</script>
`;

const files = walk(publicDir);

for(const file of files){
  let html = fs.readFileSync(file, "utf8");

  html = rep(html,[0x00C3,0x00A1],"á");
  html = rep(html,[0x00C3,0x00A9],"é");
  html = rep(html,[0x00C3,0x00AD],"í");
  html = rep(html,[0x00C3,0x00B3],"ó");
  html = rep(html,[0x00C3,0x00BA],"ú");
  html = rep(html,[0x00C3,0x00A3],"ã");
  html = rep(html,[0x00C3,0x00B5],"õ");
  html = rep(html,[0x00C3,0x00A7],"ç");
  html = rep(html,[0x00C3,0x00AA],"ê");
  html = rep(html,[0x00C3,0x00B4],"ô");

  html = html.replace(/[\u0080-\u009F]/g,"");
  html = html.replace(/[\u00C2\uFFFD]/g,"");

  if(!html.includes("function limparTexto(txt)")){
    html = html.includes("</body>")
      ? html.replace("</body>", cleaner + "\\n</body>")
      : html + cleaner;
  }

  fs.writeFileSync(file, html, "utf8");
}

console.log("FLUX limpa: textos e botoes corrigidos.");


