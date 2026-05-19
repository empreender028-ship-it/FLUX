const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(/app\.post\("\/api\/comments\/:postId"[\s\S]*?\n\}\);\n/g, "");

const rota = `
app.post("/api/comments/:postId", optionalAuth, async (req,res)=>{
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
      texto
    });

    if(typeof io !== "undefined"){
      io.emit("novo_comentario", {
        postId:String(req.params.postId),
        comment
      });
    }

    return res.json({ok:true,comment});
  }catch(e){
    console.log("comments_post:",e);
    return res.status(500).json({erro:"comments_post_error"});
  }
});

`;

s = s.replace("/* VIEW */", rota + "\n/* VIEW */");

fs.writeFileSync("server.js",s,"utf8");

console.log("POST COMMENTS REPOSICIONADO.");
