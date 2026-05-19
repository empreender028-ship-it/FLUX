const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

const helper = `
function actorKey(req){
  return String(
    req.user?.id ||
    req.body.userKey ||
    req.headers["x-user-key"] ||
    req.ip ||
    "anon"
  );
}
`;

if(!s.includes("function actorKey(req)")){
  s = s.replace("function actor(req)", helper + "\nfunction actor(req)");
}

/* BLOQUEIA COMENTÁRIO DUPLICADO */
s = s.replace(
`const comment = await Comment.create({`,
`const userKey = actorKey(req);

    const duplicado = await Comment.findOne({
      postId,
      usuarioId:userKey,
      texto
    });

    if(duplicado){
      return res.json({
        ok:true,
        duplicate:true,
        comment:duplicado
      });
    }

    const comment = await Comment.create({`
);

s = s.replace(
`usuarioId: String(req.user?.id || "visitante"),`,
`usuarioId:userKey,`
);

s = s.replace(
`usuarioId: req.user?.id || "",`,
`usuarioId:userKey,`
);

/* CURTIDA ÚNICA */
s = s.replace(
/app\.post\("\/api\/like\/:id"[\s\S]*?\n\}\);\n/,
`app.post("/api/like/:id", optionalAuth, async (req,res)=>{
  try{
    const userKey = actorKey(req);
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({erro:"post_nao_encontrado"});
    }

    post.likedBy = post.likedBy || [];

    if(post.likedBy.includes(userKey)){
      return res.json({
        ok:true,
        alreadyLiked:true,
        likes:post.likes || post.likedBy.length
      });
    }

    post.likedBy.push(userKey);
    post.likes = post.likedBy.length;

    await post.save();

    return res.json({
      ok:true,
      likes:post.likes
    });

  }catch(e){
    console.log("like:",e);
    return res.status(500).json({erro:"like_error"});
  }
});
`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("ANTI DUPLICADO COMENTARIO + LIKE UNICO APLICADO.");
