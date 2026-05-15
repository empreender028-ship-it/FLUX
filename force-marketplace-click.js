const fs = require("fs");

let html = fs.readFileSync("public/marketplace.html","utf8");

if(!html.includes("function openFluxProduct")){

html += 

<script>
function openFluxProduct(id){
 location.href = "/flux-produto.html?id=" + String(id).replace(/^ml-/,"");
}

document.addEventListener("click",(e)=>{

 const btn = e.target.closest(".buy");

 if(!btn) return;

 e.preventDefault();
 e.stopPropagation();

 const card = btn.closest("[data-id]");

 if(!card) return;

 const id = card.dataset.id;

 if(id && id.startsWith("ml-")){
   openFluxProduct(id);
 }

},true);
</script>

;

}

fs.writeFileSync("public/marketplace.html",html);

console.log("CLICK FLUX ATIVADO");
