const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

if(!s.includes('"/upload-commerce.html"')){
  s = s.replace(
    'app.get("/flux-produto.html"',
`app.get("/upload-commerce.html", (req,res)=>{
  res.sendFile(path.join(publicPath,"upload-commerce.html"));
});

app.get("/upload-commerce", (req,res)=>{
  res.sendFile(path.join(publicPath,"upload-commerce.html"));
});

app.get("/flux-produto.html"`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("ROTA UPLOAD COMMERCE ADICIONADA.");
