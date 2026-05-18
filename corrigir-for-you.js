const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(/app\.get\("\/api\/for-you"[\s\S]*?\n\}\);\n/g, "");

const rota = `
app.get("/api/for-you", optionalAuth, async (req,res)=>{
  try{
    const limit = Math.min(Number(req.query.limit || 40),80);

    const posts = await Post.find({
      status:{ $ne:"removida" }
    }).sort({createdAt:-1}).limit(160).lean();

    const agora = Date.now();

    const ranking = posts.map(p=>{
      const n = normalizePost(p);

      const idadeHoras = Math.max(
        1,
        (agora - new Date(n.createdAt || Date.now()).getTime()) / 36e5
      );

      n.scoreViral =
        Number(n.views || 0) * 1 +
        Number(n.likes || 0) * 4 +
        Number(n.saves || 0) * 9 +
        Number(n.shares || 0) * 7 +
        (n.produtoId ? 12 : 0) +
        (n.tipo === "fluxo" ? 8 : 0);

      n.scoreForYou =
        n.scoreViral / Math.pow(idadeHoras,0.35);

      return n;
    })
    .sort((a,b)=>b.scoreForYou-a.scoreForYou)
    .slice(0,limit);

    return res.json({ok:true,posts:ranking});
  }catch(e){
    console.log("for you:",e);
    return res.status(500).json({erro:"for_you_error"});
  }
});

`;

s = s.replace(
  `app.get("/api/feed", optionalAuth, carregarPlano, verificarRecurso("podeVerFeed"), async (req, res) => {`,
  rota + `app.get("/api/feed", optionalAuth, carregarPlano, verificarRecurso("podeVerFeed"), async (req, res) => {`
);

fs.writeFileSync("server.js",s,"utf8");

console.log("API FOR YOU REPOSICIONADA.");
