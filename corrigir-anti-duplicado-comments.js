const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

if(!s.includes("function actorKey(req)")){
s = s.replace(
`function actor(req)`,
`function actorKey(req){
  return String(
    req.user?.id ||
    req.body.userKey ||
    req.body.leadId ||
    req.body.email ||
    req.body.telefone ||
    req.headers["x-user-key"] ||
    req.ip ||
    "anon"
  );
}

function actor(req)`
);
}

/* força userKey na rota POST /api/comments */
s = s.replace(
`const texto = cleanText(req.body.texto, 700);
const postId = req.body.postId;`,
`const texto = cleanText(req.body.texto, 700);
const postId = req.body.postId;
const userKey = actorKey(req);`
);

s = s.replace(
`if (!postId || !texto) return res.status(400).json({ erro: "comentario_invalido" });`,
`if (!postId || !texto) return res.status(400).json({ erro: "comentario_invalido" });

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
}`
);

s = s.replace(
`usuarioId: req.user?.id || "",`,
`usuarioId:userKey,`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("ANTI DUPLICADO COM USERKEY REAL APLICADO.");
