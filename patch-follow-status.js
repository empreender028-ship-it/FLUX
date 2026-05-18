const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file,"utf8");

fs.copyFileSync(file,"server.backup-follow-status.js");

if(!s.includes("/api/follow-status/:empresaId")){
  s = s.replace(
    "/* SEGUIR EMPRESA */",
`app.get("/api/follow-status/:empresaId", optionalAuth, async (req,res)=>{
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

    res.json({ok:true,empresaId,seguidores,seguindo});
  }catch(e){
    res.status(500).json({erro:"follow_status_error"});
  }
});

 /* SEGUIR EMPRESA */`
  );
}

fs.writeFileSync(file,s,"utf8");
console.log("FOLLOW STATUS ADICIONADO.");
