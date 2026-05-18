const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

if(!s.includes("UserInterest")){
  s = s.replace(
`const Follow = mongoose.model("Follow", new mongoose.Schema({`,
`const UserInterest = mongoose.models.UserInterest || mongoose.model("UserInterest", new mongoose.Schema({
  userKey:{type:String,index:true},
  categoria:{type:String,index:true},
  empresaId:{type:String,index:true},
  produtoId:{type:String,index:true},
  peso:{type:Number,default:1},
  updatedAt:{type:Date,default:Date.now}
}));

const Follow = mongoose.model("Follow", new mongoose.Schema({`
  );
}

if(!s.includes("/api/interesse")){
  s = s.replace(
`app.get("/api/for-you", optionalAuth, async (req,res)=>{`,
`app.post("/api/interesse", optionalAuth, async (req,res)=>{
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

    res.json({ok:true});
  }catch(e){
    console.log("interesse:",e);
    res.status(500).json({erro:"interesse_error"});
  }
});

app.get("/api/for-you", optionalAuth, async (req,res)=>{`
  );
}

fs.writeFileSync("server.js",s,"utf8");

console.log("API INTERESSE USUARIO CRIADA.");
