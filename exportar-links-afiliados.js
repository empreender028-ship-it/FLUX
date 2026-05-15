const fs = require("fs");

const produtos = [
 {
  id:"MLB1",
  titulo:"Produto teste 1",
  url:"https://www.mercadolivre.com.br/"
 },
 {
  id:"MLB2",
  titulo:"Produto teste 2",
  url:"https://www.mercadolivre.com.br/"
 }
];

const linhas = produtos.map(p => p.url).join("\n");

fs.writeFileSync(
 "data/afiliados/urls-afiliados.txt",
 linhas
);

console.log("URLs exportadas:");
console.log("data/afiliados/urls-afiliados.txt");