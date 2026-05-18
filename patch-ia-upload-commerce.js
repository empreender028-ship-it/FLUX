const fs = require("fs");

const file = "public/upload-commerce.html";
let s = fs.readFileSync(file,"utf8");

if(!s.includes("gerarIA()")){
  s = s.replace(
    '<button onclick="enviar()">Publicar na Flux</button>',
`<button onclick="gerarIA()" type="button">Gerar descrição com IA</button>
<button onclick="enviar()">Publicar na Flux</button>`
  );

  s = s.replace(
    "async function enviar(){",
`function gerarIA(){
 const n = document.getElementById("nome").value || "produto incrível";
 const precoV = document.getElementById("preco").value;

 const texto =
\`\${n} é uma escolha perfeita para quem busca estilo, praticidade e desejo de compra imediato. Produto selecionado para a vitrine Flux com visual atrativo, descrição clara e chamada forte para conversão.

✨ Destaques:
• Produto com alto potencial de interesse
• Ideal para descoberta no feed
• Perfeito para compra rápida
• Oferta apresentada em formato social commerce

#Flux #Achadinhos #ProdutoDoDia #Oferta #Marketplace #SocialCommerce\`;

 document.getElementById("descricao").value = texto;
 document.getElementById("status").textContent = "Descrição gerada automaticamente.";
}

async function enviar(){`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("IA DE DESCRICAO NO UPLOAD COMMERCE APLICADA.");
