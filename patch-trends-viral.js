const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"server.backup-trends-viral.js");

if(!s.includes("/api/trends-viral")){
  s = s.replace(
    "/* PRODUTOS / MARKETPLACE */",
`app.get("/api/trends-viral", async (req,res)=>{
  try{
    const posts = await Post.find({ status:{ $ne:"removida" } }).sort({createdAt:-1}).limit(100).lean();

    const ranking = posts.map(p=>{
      const n = normalizePost(p);
      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 3 +
        Number(n.saves || 0) * 8 +
        Number(n.shares || 0) * 5;
      return n;
    }).sort((a,b)=>b.scoreViral-a.scoreViral).slice(0,20);

    res.json({ok:true,ranking});
  }catch(e){
    res.status(500).json({erro:"trends_viral_error"});
  }
});

 /* PRODUTOS / MARKETPLACE */`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("API TRENDS VIRAL CRIADA.");
