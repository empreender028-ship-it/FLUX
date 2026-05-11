const mongoose = require("mongoose");

const PedidoSchema = new mongoose.Schema({

  clienteNome: {
    type: String,
    required: true
  },

  clienteEmail: {
    type: String,
    required: true
  },

  clienteWhatsapp: {
    type: String,
    default: ""
  },

  endereco: {
    type: String,
    default: ""
  },

  produtos: [
    {
      nome: String,
      preco: Number,
      quantidade: Number,
      imagem: String,
      tamanho: String,
      cor: String
    }
  ],

  total: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    default: "pendente"
  },

  codigoRastreio: {
    type: String,
    default: ""
  },

  etiquetaEnvio: {
    type: String,
    default: ""
  },

  pagamento: {
    type: String,
    default: "pix"
  },

  pago: {
    type: Boolean,
    default: false
  },

  criadoEm: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Pedido", PedidoSchema);