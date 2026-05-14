const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace('  "/notificacao": "notificacao.html",\n', "");

s = s.replace(
`app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ erro: "rota_nao_encontrada" });
  }

  return res.redirect("/login");
});`,
`app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ erro: "rota_nao_encontrada" });
  }

  const fallbackPage = path.join(publicPath, "feed.html");

  if (fs.existsSync(fallbackPage)) {
    return res.sendFile(fallbackPage);
  }

  return res.status(404).send("Página não encontrada");
});`
);

fs.writeFileSync("server.js",s);

console.log("Fallback final corrigido.");