const mongoose = require("mongoose");

const ClienteSchema = new mongoose.Schema({

  nome: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  senha: {
    type: String,
    required: true
  },

  whatsapp: {
    type: String,
    default: ""
  },

  endereco: {
    rua: String,
    numero: String,
    bairro: String,
    cidade: String,
    estado: String,
    cep: String
  },

  favoritos: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Produto",
    default: []
  },

  historicoCompras: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Pedido",
    default: []
  },

  notificacoes: [
    {
      titulo: String,
      mensagem: String,
      lida: {
        type: Boolean,
        default: false
      },
      criadaEm: {
        type: Date,
        default: Date.now
      }
    }
  ],

  criadoEm: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Cliente", ClienteSchema);