const fs = require("fs");

const data = {
  produtos:[
    {
      id:"MLB4519183065",
      titulo:"Tenis Olympikus Voa 2",
      seller:"olympikus",
      afiliado:true,
      url:"https://www.mercadolivre.com.br/tenis-esportivo-masculino-voa-2-olympikus/up/MLBU2977604675?pdp_filters=item_id%3AMLB4519183065&matt_tool=38524122#origin=share&sid=share&wid=MLB4519183065&action=copy"
    },
    {
      id:"MLB6419665772",
      titulo:"Smart TV Philips 50 4K",
      seller:"philips",
      afiliado:true,
      url:"https://www.mercadolivre.com.br/smart-tv-philips-50-4k-50pug7300-comando-de-voz-bluetooth/p/MLB57723340?pdp_filters=item_id%3AMLB6419665772&matt_tool=38524122#origin=share&sid=share&wid=MLB6419665772&action=copy"
    }
  ]
};

if(!fs.existsSync("data")){
 fs.mkdirSync("data");
}

if(!fs.existsSync("data/afiliados")){
 fs.mkdirSync("data/afiliados");
}

fs.writeFileSync(
 "data/afiliados/produtos-afiliados.json",
 JSON.stringify(data,null,2)
);

console.log("BANCO AFILIADO FLUX CRIADO");
console.log("data/afiliados/produtos-afiliados.json");
