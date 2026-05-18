const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

s = s.replace(/app\.get\("\/api\/trends-viral"[\s\S]*?\n\}\);\n/g, "");

const rota = `
app.get("/api/trends-viral", async (req,res)=>{
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

    return res.json({ok:true,ranking});
  }catch(e){
    console.log("trends viral:",e);
    return res.status(500).json({erro:"trends_viral_error"});
  }
});

`;

s = s.replace("/* PERFIL */", rota + "\n/* PERFIL */");

fs.writeFileSync(file,s,"utf8");
console.log("ROTA TRENDS VIRAL REPOSICIONADA.");
