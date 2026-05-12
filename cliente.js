const mongoose = require("mongoose");

const ClienteSchema = new mongoose.Schema({

  nome:{
    type:String,
    required:true
  },

  username:{
    type:String,
    unique:true,
    sparse:true,
    lowercase:true,
    trim:true
  },

  email:{
    type:String,
    required:true,
    unique:true,
    lowercase:true
  },

  senha:{
    type:String,
    required:true
  },

  avatar:{
    type:String,
    default:""
  },

  capa:{
    type:String,
    default:""
  },

  bio:{
    type:String,
    default:""
  },

  telefone:{
    type:String,
    default:""
  },

  whatsapp:{
    type:String,
    default:""
  },

  site:{
    type:String,
    default:""
  },

  cidade:{
    type:String,
    default:""
  },

  estado:{
    type:String,
    default:""
  },

  interesses:{
    type:[String],
    default:[]
  },

  endereco:{
    rua:String,
    numero:String,
    bairro:String,
    cidade:String,
    estado:String,
    cep:String
  },

  favoritos:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Produto",
    default:[]
  },

  curtidos:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Post",
    default:[]
  },

  salvos:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Post",
    default:[]
  },

  seguindoEmpresas:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Empresa",
    default:[]
  },

  seguindoClientes:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Cliente",
    default:[]
  },

  seguidores:{
    type:Number,
    default:0
  },

  seguindo:{
    type:Number,
    default:0
  },

  carrinho:[
    {
      produtoId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Produto"
      },

      nome:String,
      preco:Number,
      imagem:String,

      quantidade:{
        type:Number,
        default:1
      }
    }
  ],

  historicoCompras:{
    type:[mongoose.Schema.Types.ObjectId],
    ref:"Pedido",
    default:[]
  },

  notificacoes:[
    {
      titulo:String,

      mensagem:String,

      link:{
        type:String,
        default:""
      },

      imagem:{
        type:String,
        default:""
      },

      lida:{
        type:Boolean,
        default:false
      },

      criadaEm:{
        type:Date,
        default:Date.now
      }
    }
  ],

  visualizados:[
    {
      postId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Post"
      },

      data:{
        type:Date,
        default:Date.now
      }
    }
  ],

  premium:{
    type:Boolean,
    default:false
  },

  plano:{
    type:String,
    default:"free"
  },

  online:{
    type:Boolean,
    default:false
  },

  ultimoLogin:{
    type:Date,
    default:null
  },

  ultimoAcesso:{
    type:Date,
    default:Date.now
  },

  ultimoIp:{
    type:String,
    default:""
  },

  provider:{
    type:String,
    default:"local"
  },

  googleId:{
    type:String,
    default:""
  },

  appleId:{
    type:String,
    default:""
  },

  resetToken:{
    type:String,
    default:""
  },

  resetTokenExpira:{
    type:Date,
    default:null
  },

  verificado:{
    type:Boolean,
    default:false
  },

  banido:{
    type:Boolean,
    default:false
  },

  criadoEm:{
    type:Date,
    default:Date.now
  }

});

module.exports =
mongoose.model("Cliente", ClienteSchema);