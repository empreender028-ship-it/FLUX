const fs = require("fs");

let html = fs.readFileSync("public/marketplace.html","utf8");

html = html.replace(
  /onclick="\$\{p\.externalUrl \? openExternalBuy\('\$\{safe\(p\.externalUrl\)\}'\) : uyNow\('\$\{safe\(p\.id\)\}'\)\}"/g,
  'onclick="openFluxProduct(\\'\\')"'
);

if(!html.includes("function openFluxProduct")){
  html = html.replace(
    "function openOwnerProfile(url){",
    unction openFluxProduct(id){
 location.href = "/flux-produto.html?id=" + encodeURIComponent(String(id).replace(/^ml-/,""));
}

function openOwnerProfile(url){
  );
}

fs.writeFileSync("public/marketplace.html",html);
console.log("Marketplace agora abre produto dentro da Flux");
