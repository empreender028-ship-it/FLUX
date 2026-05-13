const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname,"public");

function walk(dir){
 let results = [];

 fs.readdirSync(dir).forEach(file=>{

  const full = path.join(dir,file);

  if(fs.statSync(full).isDirectory()){
   results = results.concat(walk(full));
  }else if(full.endsWith(".html")){
   results.push(full);
  }

 });

 return results;
}

const cleaner = `
<script>
(function(){

function limpar(t){

 return String(t || "")
 .replace(/Ã¡/g,"á")
 .replace(/Ã©/g,"é")
 .replace(/Ã­/g,"í")
 .replace(/Ã³/g,"ó")
 .replace(/Ãº/g,"ú")
 .replace(/Ã£/g,"ã")
 .replace(/Ãµ/g,"õ")
 .replace(/Ã§/g,"ç")
 .replace(/Ãª/g,"ê")
 .replace(/Ã´/g,"ô")
 .replace(/Â/g,"")
 .replace(/â€¢/g,"•")
 .replace(/â€"/g,"-")
 .replace(/â€"/g,"-")
 .replace(/™/g,"")
 .replace(/TM/g,"")
 .replace(/ðŸ/g,"")
 .trim();

}

function limparTudo(){

 document.querySelectorAll("*").forEach(el=>{

  if(el.children.length === 0){

   const txt = limpar(el.innerText);

   if(txt !== el.innerText){
    el.innerText = txt;
   }

  }

 });

}

document.addEventListener("DOMContentLoaded",limparTudo);

setTimeout(limparTudo,500);

})();
</script>
`;

const files = walk(publicDir);

files.forEach(file=>{

 let html = fs.readFileSync(file,"utf8");

 if(!html.includes("function limpar(")){

  if(html.includes("</body>")){
   html = html.replace("</body>", cleaner + "\\n</body>");
  }else{
   html += cleaner;
  }

  fs.writeFileSync(file,html,"utf8");

 }

});

console.log("HTML LIMPOS");


