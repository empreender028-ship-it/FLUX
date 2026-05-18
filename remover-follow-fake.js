const fs = require("fs");
let s = fs.readFileSync("public/empresa.html","utf8");

s = s.replace(/const baseFollowers[\s\S]*?;/g, "const baseFollowers = followersCount;");
s = s.replace(/8200\s*\+\s*\(following\s*\?\s*1\s*:\s*0\)/g, "followersCount");
s = s.replace(/document\.getElementById\("followers"\)\.innerText\s*=\s*compact\([^)]*\);/g,
`document.getElementById("followers").innerText = compact(followersCount);`);

fs.writeFileSync("public/empresa.html",s,"utf8");
console.log("SEGUIDORES FAKE REMOVIDOS FORCADO.");
