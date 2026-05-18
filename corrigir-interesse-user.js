const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(/app\.post\("\/api\/interesse"[\s\S]*?app\.get\("\/api\/for-you"/, 'app.get("/api/for-you"');

const rota = `
app.post("/api/interesse", optionalAuth, async (req,res)=>{
  try{
    const userKey =
      req.user?.id ||
      req.body.userKey ||
      req.ip ||
      "anon";

    const categoria = String(req.body.categoria || "geral");
    const empresaId = String(req.body.empresaId || "");
    const produtoId = String(req.body.produtoId || "");
    const peso = Number(req.body.peso || 1);

    await UserInterest.updateOne(
      {userKey,categoria,empresaId,produtoId},
      {
        $inc:{peso},
        $set:{updatedAt:new Date()}
      },
      {upsert:true}
    );

    return res.json({ok:true});
  }catch(e){
    console.log("interesse:",e);
    return res.status(500).json({erro:"interesse_error"});
  }
});

`;

s = s.replace(
  'app.get("/api/for-you"',
  rota + 'app.get("/api/for-you"'
);

fs.writeFileSync("server.js",s,"utf8");

console.log("API INTERESSE REPOSICIONADA.");
