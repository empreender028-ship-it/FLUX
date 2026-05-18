const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

s = s.replace(/app\.get\("\/api\/follow-status\/:empresaId"[\s\S]*?\n\}\);\n/g, "");

const rota = `
app.get("/api/follow-status/:empresaId", optionalAuth, async (req,res)=>{
  try{
    const empresaId = String(req.params.empresaId);
    const seguidores = await Follow.countDocuments({empresaId});

    let seguindo = false;

    if(req.user && req.user.id){
      seguindo = !!(await Follow.findOne({
        clienteId:String(req.user.id),
        empresaId
      }));
    }

    return res.json({ok:true,empresaId,seguidores,seguindo});
  }catch(e){
    console.log("follow status:",e);
    return res.status(500).json({erro:"follow_status_error"});
  }
});

`;

s = s.replace("/* SEGUIR EMPRESA */", rota + "\n/* SEGUIR EMPRESA */");

fs.writeFileSync(file,s,"utf8");
console.log("ROTA FOLLOW STATUS REPOSICIONADA.");
