const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

const nova = `
/* SAVES */
app.post("/api/save/:id", optionalAuth, async (req,res)=>{
  try{
    const userKey = String(req.user?.id || req.body?.userKey || req.headers["x-user-key"] || req.ip || "anon");
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    post.savedBy = Array.isArray(post.savedBy) ? post.savedBy : [];

    if(post.savedBy.includes(userKey)){
      return res.json({
        ok:true,
        alreadySaved:true,
        saves:post.savedBy.length
      });
    }

    post.savedBy.push(userKey);
    post.saves = post.savedBy.length;

    await post.save();

    return res.json({
      ok:true,
      saves:post.saves
    });

  }catch(e){
    console.log("save_error:", e);
    return res.status(500).json({erro:"save_error", detalhe:String(e.message || e)});
  }
});

`;

s = s.replace(/\/\* SAVES \*\/[\s\S]*?\/\* COMMENTS \*\//, nova + "\n/* COMMENTS */");

fs.writeFileSync("server.js",s,"utf8");
console.log("ROTA SAVE REESCRITA.");
