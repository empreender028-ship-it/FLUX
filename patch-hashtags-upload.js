const fs = require("fs");

const file = "public/upload-commerce.html";
let s = fs.readFileSync(file,"utf8");

if(!s.includes('id="hashtags"')){
  s = s.replace(
    '<textarea id="descricao" placeholder="Descrição"></textarea>',
`<textarea id="descricao" placeholder="Descrição"></textarea>
<textarea id="hashtags" placeholder="Hashtags automáticas"></textarea>
<textarea id="postDescricao" placeholder="Legenda do post/reel"></textarea>`
  );

  s = s.replace(
    'fd.append("postDescricao", descricao.value);',
`fd.append("postDescricao", postDescricao.value || descricao.value);
fd.append("hashtags", hashtags.value);`
  );

  s = s.replace(
    'document.getElementById("descricao").value = texto;',
`document.getElementById("descricao").value = texto;
document.getElementById("hashtags").value = "#Flux #Achadinhos #ProdutoDoDia #Oferta #Marketplace #SocialCommerce #Promoção #ComprarOnline";
document.getElementById("postDescricao").value = "Achei esse produto na Flux e ele merece aparecer no seu feed 👀✨";`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("HASHTAGS E LEGENDA VIRAL ADICIONADAS.");
