const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

if(!s.includes('app.post("/api/save/:id"')){

const rota = `

/* SAVES */
app.post("/api/save/:id", optionalAuth, async (req,res)=>{

  try{

    const userKey = actorKey(req);

    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({
        erro:"post_nao_encontrado"
      });
    }

    post.savedBy = post.savedBy || [];

    if(post.savedBy.includes(userKey)){
      return res.json({
        ok:true,
        alreadySaved:true,
        saves:post.saves || post.savedBy.length
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

    console.log("save:",e);

    return res.status(500).json({
      erro:"save_error"
    });

  }

});

`;

s = s.replace("/* COMMENTS */", rota + "\n/* COMMENTS */");

}

fs.writeFileSync("server.js",s,"utf8");

console.log("API SAVE UNICO CRIADA.");
