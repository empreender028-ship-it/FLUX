require("dotenv").config();
const mongoose = require("mongoose");

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const produtos = await db.collection("produtos").find({ativo:true}).toArray();

  for(const p of produtos){
    await db.collection("posts").updateMany(
      {
        empresaId: String(p.empresaId),
        $or: [
          { media: p.imagem },
          { descricao: { $regex: p.nome, $options: "i" } },
          { descricao: { $regex: (p.descricao || "").slice(0,30), $options: "i" } }
        ]
      },
      {
        $set: {
          produtoId: String(p._id),
          produtoNome: p.nome,
          produtoPreco: Number(p.precoPromocional || p.preco || 0),
          produtoImagem: p.imagem || "",
          produtoLink: p.link || "/flux-produto/" + p._id
        }
      }
    );
  }

  const posts = await db.collection("posts").find({produtoId:{$exists:true}}).limit(10).toArray();
  console.log(posts.map(p=>({
    descricao:p.descricao,
    produtoId:p.produtoId,
    produtoNome:p.produtoNome,
    produtoPreco:p.produtoPreco
  })));

  process.exit();
}

main();
