const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

if(!s.includes('/api/comentar/:postId')){
const rota = `
app.post("/api/comentar/:postId", optionalAuth, async (req,res)=>{
  try{
    const texto = String(req.body.texto || "").trim();

    if(!texto){
      return res.status(400).json({erro:"texto_obrigatorio"});
    }

    const comment = await Comment.create({
      postId:String(req.params.postId),
      userId:String(req.user?.id || "anon"),
      nome:req.user?.nome || "Flux User",
      avatar:req.user?.avatar || "",
      texto,
      createdAt:new Date()
    });

    if(typeof io !== "undefined"){
      io.emit("novo_comentario", {
        postId:String(req.params.postId),
        comment
      });
    }

    return res.json({ok:true,comment});
  }catch(e){
    console.log("comentar:",e);
    return res.status(500).json({erro:"comentar_error"});
  }
});

`;

s = s.replace('app.get("/api/feed"', rota + 'app.get("/api/feed"');
}

fs.writeFileSync("server.js",s,"utf8");
console.log("ROTA /api/comentar CRIADA ANTES DO FEED.");
