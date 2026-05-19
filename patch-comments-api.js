const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

if(!s.includes("const Comment")){

s = s.replace(
`const Follow = mongoose.model("Follow", new mongoose.Schema({`,
`const Comment = mongoose.models.Comment || mongoose.model("Comment", new mongoose.Schema({
  postId:{type:String,index:true},
  userId:{type:String,index:true},
  nome:String,
  avatar:String,
  texto:String,
  likes:{type:Number,default:0},
  createdAt:{type:Date,default:Date.now}
}));

const Follow = mongoose.model("Follow", new mongoose.Schema({`
);

}

if(!s.includes("/api/comments/:postId")){

s = s.replace(
`/* VIEW */`,
`
app.get("/api/comments/:postId", async (req,res)=>{
  try{

    const comments = await Comment.find({
      postId:String(req.params.postId)
    })
    .sort({createdAt:-1})
    .limit(120)
    .lean();

    res.json({
      ok:true,
      comments
    });

  }catch(e){
    console.log("comments_get:",e);
    res.status(500).json({erro:"comments_get_error"});
  }
});

app.post("/api/comments/:postId", optionalAuth, async (req,res)=>{
  try{

    const texto =
      String(req.body.texto || "").trim();

    if(!texto){
      return res.status(400).json({
        erro:"texto_obrigatorio"
      });
    }

    const comment = await Comment.create({
      postId:String(req.params.postId),
      userId:String(req.user?.id || "anon"),
      nome:req.user?.nome || "Flux User",
      avatar:req.user?.avatar || "",
      texto
    });

    res.json({
      ok:true,
      comment
    });

  }catch(e){
    console.log("comments_post:",e);
    res.status(500).json({erro:"comments_post_error"});
  }
});

 /* VIEW */`
);

}

fs.writeFileSync("server.js",s,"utf8");

console.log("API COMENTARIOS CRIADA.");
