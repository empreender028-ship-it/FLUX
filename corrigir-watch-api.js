const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(/app\.post\("\/api\/watch\/:id"[\s\S]*?\/\* VIEW \*\//, "/* VIEW */");

const rota = `
app.post("/api/watch/:id", optionalAuth, async (req,res)=>{
  try{
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    const seconds = Math.max(0, Number(req.body.seconds || 0));
    const percent = Math.max(0, Math.min(100, Number(req.body.percent || 0)));

    post.watchSeconds = Number(post.watchSeconds || 0) + seconds;
    post.watchCount = Number(post.watchCount || 0) + 1;
    post.retentionAvg = Math.round(
      ((Number(post.retentionAvg || 0) * (post.watchCount - 1)) + percent) / post.watchCount
    );

    await post.save();

    return res.json({
      ok:true,
      watchSeconds:post.watchSeconds,
      watchCount:post.watchCount,
      retentionAvg:post.retentionAvg
    });
  }catch(e){
    console.log("watch:",e);
    return res.status(500).json({erro:"watch_error"});
  }
});

`;

s = s.replace("/* VIEW */", rota + "\n/* VIEW */");

fs.writeFileSync("server.js",s,"utf8");

console.log("WATCH API REPOSICIONADA.");
