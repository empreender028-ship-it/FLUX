module.exports = function bloqueioPagamento(req, res, next) {
  if (!req.user.ativo || req.user.plano === "free") {
    return res.status(403).json({ erro: "paga pra usar" })
  }

  next()
}