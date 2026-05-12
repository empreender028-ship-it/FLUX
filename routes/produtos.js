<input id="search">
<select id="type"></select>
<main id="grid"></main>

<strong id="totalProducts">0</strong>
<strong id="totalBrands">0</strong>
<strong id="onlineCount">0</strong>
<strong id="cartStat">0</strong>

<button onclick="abrirCarrinho()">Carrinho <span id="cartCount">0</span></button>

<div id="cartModal" class="cart-modal">
  <div class="cart-box">
    <div id="cartList"></div>
    <span id="subtotal"></span>
    <span id="fee"></span>
    <span id="total"></span>
    <button onclick="criarPedidoCarrinho()">Gerar pedido</button>
    <button onclick="checkoutWhatsApp()">WhatsApp</button>
  </div>
</div>

<div id="toast" class="toast"></div>