const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

s = s.replace(
`const posts = await Post.find({
      status:{ $ne:"removida" }
    }).sort({createdAt:-1}).limit(160).lean();`,

`const userKey =
      req.user?.id ||
      req.ip ||
      "anon";

    const interesses = await UserInterest.find({
      userKey
    }).lean();

    const mapaInteresse = {};

    interesses.forEach(i=>{
      mapaInteresse[i.categoria] =
        (mapaInteresse[i.categoria] || 0) +
        Number(i.peso || 0);
    });

    const posts = await Post.find({
      status:{ $ne:"removida" }
    }).sort({createdAt:-1}).limit(160).lean();`
);

s = s.replace(
`n.scoreForYou =
        n.scoreViral / Math.pow(idadeHoras,0.35);`,

`const categoriaPost =
        n.categoria ||
        n.segmento ||
        "geral";

      const interesseBoost =
        Number(mapaInteresse[categoriaPost] || 0);

      n.scoreForYou =
        (
          n.scoreViral +
          (interesseBoost * 18)
        ) / Math.pow(idadeHoras,0.35);`
);

fs.writeFileSync("server.js",s,"utf8");

console.log("FOR YOU PERSONALIZADO APLICADO.");
