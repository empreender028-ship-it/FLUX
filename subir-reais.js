require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function main(){
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const empresa = await db.collection("empresas").findOneAndUpdate(
    { email: "premiumsolesshop@gmail.com" },
    {
      $set: {
        nome: "Premium Soles",
        responsavel: "Premium Soles",
        email: "premiumsolesshop@gmail.com",
        whatsapp: "5517992042563",
        telefone: "5517992042563",
        cidade: "Olímpia",
        segmento: "Moda feminina streetwear",
        tipoConta: "empresa",
        plano: "Premium",
        assinaturaStatus: "ativo",
        ativo: true,
        marketplaceAtivo: true,
        bio: "Moda feminina streetwear premium. Looks modernos, exclusivos e cheios de atitude.",
        site: "https://www.premiumsoles.com.br",
        avatar: "",
        logo: "",
        capa: "",
        ultimaAtividade: new Date()
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  const docEmpresa = empresa.value || empresa; const empresaId = String(docEmpresa._id);

  const produtos = [
    {
      nome: "Look Street Premium",
      descricao: "Peça feminina streetwear premium da Premium Soles.",
      preco: 149.90,
      categoria: "Moda feminina",
      imagem: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1200&auto=format&fit=crop",
      estoque: 5,
      destaque: true
    },
    {
      nome: "Cropped Urban Premium",
      descricao: "Cropped moderno para compor looks estilosos.",
      preco: 89.90,
      categoria: "Streetwear feminino",
      imagem: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1200&auto=format&fit=crop",
      estoque: 8,
      destaque: true
    }
  ];

  for (const p of produtos) {
    await db.collection("produtos").findOneAndUpdate(
      { empresaId, nome: p.nome },
      {
        $set: {
          ...p,
          empresaId,
          empresaNome: "Premium Soles",
          ativo: true,
          vendido: 0,
          video: "",
          tamanhos: ["P","M","G"],
          cores: ["Preto","Branco","Azul"],
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    await db.collection("posts").findOneAndUpdate(
      { empresaId, descricao: p.descricao },
      {
        $set: {
          empresaId,
          empresaNome: "Premium Soles",
          empresaEmail: "premiumsolesshop@gmail.com",
          media: p.imagem,
          descricao: p.descricao,
          link: "https://www.premiumsoles.com.br",
          tipo: "feed",
          status: "aprovada",
          likes: 0,
          saves: 0,
          shares: 0,
          views: 0,
          likedBy: [],
          savedBy: [],
          sharedBy: [],
          viewedBy: [],
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  console.log("PERFIL REAL CRIADO:", {
    empresaId,
    perfil: "https://flux-beta-production.up.railway.app/empresa.html?id=" + empresaId,
    marketplace: "https://flux-beta-production.up.railway.app/marketplace"
  });

  await mongoose.disconnect();
}

main().catch(async err=>{
  console.error(err);
  await mongoose.disconnect();
});
