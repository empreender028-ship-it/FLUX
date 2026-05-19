const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

if(!s.includes('app.get("/api/ml/debug-expandir"')){
const rota = `

app.get("/api/ml/debug-expandir", async (req,res)=>{
  try{
    const url = String(req.query.url || "");
    const r = await fetch(url,{
      method:"GET",
      redirect:"follow",
      headers:{
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":"Mozilla/5.0 FluxDebug/1.0"
      }
    });

    const html = await r.text();

    return res.json({
      ok:true,
      status:r.status,
      finalUrl:r.url,
      temMLB:/MLB-?\\d+/i.test(r.url + " " + html),
      match:(r.url + " " + html).match(/MLB-?\\d+/i)?.[0] || "",
      wid:(r.url + " " + html).match(/[?&]wid=(MLB\\d+)/i)?.[1] || "",
      trecho:html.slice(0,800)
    });
  }catch(e){
    return res.status(500).json({ok:false,erro:String(e.message || e)});
  }
});

`;

s = s.replace("const app = express();", "const app = express();\n" + rota);
}

fs.writeFileSync("server.js",s,"utf8");
console.log("DEBUG EXPANDIR ML CRIADO.");
