const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`const duplicado = await Comment.findOne({
  postId,
  usuarioId: userKey,
  texto`,
`const duplicado = await Comment.findOne({
  postId,
  usuarioId: userKey,
  texto
});`
);

s = s.replace(
`} catch (e) {
console.log("comment_error:", e);
}
});`,
`} catch (e) {
console.log("comment_error:", e);
return res.status(500).json({ erro: "comment_error" });
}
});`
);

fs.writeFileSync("server.js",s,"utf8");

console.log("COMMENTS SYNTAX CORRIGIDO.");
