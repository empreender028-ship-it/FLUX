const fs = require("fs");

const file = "public/upload-commerce.html";
let s = fs.readFileSync(file,"utf8");

if(!s.includes("compressImageFile")){

s = s.replace(
`async function enviar(){`,
`
async function compressImageFile(file, quality = 0.72, maxWidth = 1280){
 return new Promise(resolve=>{
  if(!file.type.startsWith("image/")) return resolve(file);

  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = ()=>{
   const scale = Math.min(1, maxWidth / img.width);
   const canvas = document.createElement("canvas");
   canvas.width = Math.round(img.width * scale);
   canvas.height = Math.round(img.height * scale);

   const ctx = canvas.getContext("2d");
   ctx.drawImage(img,0,0,canvas.width,canvas.height);

   canvas.toBlob(blob=>{
    if(!blob) return resolve(file);
    const compressed = new File(
     [blob],
     file.name.replace(/\\.[^.]+$/,"") + ".jpg",
     {type:"image/jpeg"}
    );
    resolve(compressed);
   },"image/jpeg",quality);
  };

  img.onerror = ()=>resolve(file);
  img.src = url;
 });
}

async function enviar(){`
);

s = s.replace(
`[...medias.files].forEach(f=>fd.append("medias", f));`,
`for(const f of [...medias.files]){
  const finalFile = await compressImageFile(f);
  fd.append("medias", finalFile);
}`
);

s = s.replace(
`status.textContent = "Enviando...";`,
`status.textContent = "Otimizando mídia e enviando...";`
);

}

fs.writeFileSync(file,s,"utf8");
console.log("COMPRESSAO DE IMAGEM NO UPLOAD APLICADA.");
