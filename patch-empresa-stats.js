const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

if(!s.includes("/api/empresa-stats/:empresaId")){
  s = s.replace("/* SEGUIR EMPRESA */", `
app.get("/api/empresa-stats/:empresaId", async (req,res)=>{
  try{
    const empresaId = String(req.params.empresaId);

    const posts = await Post.find({
      empresaId,
      status:{ $ne:"removida" }
    }).lean();

    const views = posts.reduce((a,p)=>a + Number(p.views || 0),0);
    const likes = posts.reduce((a,p)=>a + Number(p.likes || 0),0);
    const saves = posts.reduce((a,p)=>a + Number(p.saves || 0),0);
    const shares = posts.reduce((a,p)=>a + Number(p.shares || 0),0);

    return res.json({
      ok:true,
      empresaId,
      posts:posts.length,
      views,
      likes,
      saves,
      shares
    });
  }catch(e){
    return res.status(500).json({erro:"empresa_stats_error"});
  }
});

 /* SEGUIR EMPRESA */`);
}

fs.writeFileSync("server.js",s,"utf8");
console.log("API STATS EMPRESA CRIADA.");
