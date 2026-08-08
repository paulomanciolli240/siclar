"use strict";

function abrirMontagemPedido(numeroPedidoComplemento = null) {
    pedidoComplementoNumero = numeroPedidoComplemento;
    modoPedidoAtual = numeroPedidoComplemento ? 'COMPLEMENTO' : 'NOVO';
    carrinhoPedido = [];

    formaPagamentoPedido = numeroPedidoComplemento
        ? normalizarFormaPagamento(pedidoVisualizadoAtual?.FORMA_PAGAMENTO || "A VISTA")
        : "A VISTA";

    const cpfSalvo = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
    const nomeCliente = obterValorCliente(clientePedidoAtual, 'NOME_COMPLETO') || 'CLIENTE SICLAR';

    document.getElementById('pedidoClienteChip').textContent = numeroPedidoComplemento
        ? `${nomeCliente} • Complemento do pedido ${numeroPedidoComplemento}`
        : `${nomeCliente} • CPF ${formatarCpf(cpfSalvo)}`;

    document.getElementById('telaCadastroCliente').classList.remove('ativa');
    document.getElementById('moduloCarrossel').style.display = 'none';
    document.getElementById('moduloAdministrativo').style.display = 'none';
    document.getElementById('moduloPedidos').style.display = 'block';

    carrosselAtivo = false;
    if (timerCarrossel) clearTimeout(timerCarrossel);

    if (!numeroPedidoComplemento && produtoSelecionadoParaCompra && carrinhoPedido.length === 0) {
        adicionarProdutoInicialAoPedido(produtoSelecionadoParaCompra.codigo);
    }

    paginaPedidoAtual = 0;
    document.getElementById('pedidoPesquisaProduto').value = '';
    const seletorVendedor = document.getElementById('pedidoVendedor');
    if (seletorVendedor) {
        seletorVendedor.disabled = Boolean(numeroPedidoComplemento);
        if (!numeroPedidoComplemento) {
            seletorVendedor.value = '';
        } else if (pedidoVisualizadoAtual?.VENDEDOR) {
            seletorVendedor.value = String(pedidoVisualizadoAtual.VENDEDOR).toUpperCase();
        }
    }

    sincronizarSeletorFormaPagamento(Boolean(numeroPedidoComplemento));
    document.querySelector('.pedido-carrinho-topo h3').textContent = numeroPedidoComplemento
        ? 'Complemento do pedido'
        : 'Seu pedido';
    document.getElementById('btnFinalizarPedido').textContent = numeroPedidoComplemento
        ? 'Salvar complemento'
        : 'Finalizar pedido';
    renderizarProdutosPedido();
    renderizarCarrinhoPedido();
}

function voltarAoCarrosselDoPedido() {
    document.getElementById('moduloPedidos').style.display = 'none';
    document.getElementById('moduloCarrossel').style.display = 'flex';
    pausaPorHover = false;
    iniciarCarrossel();
}

function adicionarProdutoInicialAoPedido(codigo) {
    const cab = obterCabecalhosProduto();
    const produto = dadosGlobais.find(
        item => String(item[cab.codigo] || '') === String(codigo || '')
    );

    if (produto) adicionarAoCarrinhoPedido(produto, false);
}

function produtosFiltradosPedido() {
    const termo = document
        .getElementById('pedidoPesquisaProduto')
        .value
        .trim();

    const cab = obterCabecalhosProduto();

    const camposPesquisa = [
        cab.codigo,
        cab.descricao,
        cab.marca
    ].filter(Boolean);

    return ordenarProdutosPorPesquisa(
        filtrarProdutosPorModoCatalogo(dadosGlobais),
        termo,
        camposPesquisa
    );
}

function renderizarProdutosPedido() {
    const cab = obterCabecalhosProduto();
    const produtos = produtosFiltradosPedido();
    const totalPaginas = Math.max(1, Math.ceil(produtos.length / itensPorPaginaPedido));

    if (paginaPedidoAtual >= totalPaginas) paginaPedidoAtual = totalPaginas - 1;
    if (paginaPedidoAtual < 0) paginaPedidoAtual = 0;

    const inicio = paginaPedidoAtual * itensPorPaginaPedido;
    const pagina = produtos.slice(inicio, inicio + itensPorPaginaPedido);

    let html = '';

    if (pagina.length === 0) {
        html = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;">
            Nenhum produto encontrado.
        </div>`;
    } else {
        pagina.forEach(produto => {
            const codigo = String(produto[cab.codigo] || '');
            const descricao = String(produto[cab.descricao] || '');
            const marca = String(produto[cab.marca] || '');
            const precoPrazo = moedaParaNumero(produto[cab.preco]);
            const precoSelecionado = obterPrecoPorForma(precoPrazo);
            const foto = cab.foto && produto[cab.foto]
                ? `<img src="${resolverUrlImagem(String(produto[cab.foto]))}" alt="Produto" onerror="this.style.display='none'">`
                : '<span style="color:#94a3b8;font-size:11px;">Sem imagem</span>';

            html += `
                <article class="pedido-card-produto ${produtoEhEntregaFutura(produto) ? "pedido-card-futuro" : ""}">
                    ${produtoEhEntregaFutura(produto) ? '<div class="selo-pedido-futuro">🚚 Sob encomenda</div>' : ''}
                    <div class="pedido-card-foto">${foto}</div>
                    <div class="pedido-card-marca">${marca}</div>
                    <div class="pedido-card-descricao">${descricao}</div>
                    <div class="pedido-card-rodape">
                        <div>
                            <div class="pedido-card-precos">
                                <div class="pedido-card-preco-principal">${formatarMoeda(precoSelecionado)}</div>
                                <span class="pedido-card-forma">${rotuloFormaPagamento()}</span>
                                <div class="pedido-card-preco-secundario">
                                    Prazo: ${formatarMoeda(precoPrazo)} • Vista: ${formatarMoeda(calcularPrecoAVista(precoPrazo))}
                                </div>
                            </div>
                            <span class="pedido-card-codigo">Cód. ${codigo}</span>
                        </div>
                        <button
                            class="btn-adicionar-pedido"
                            type="button"
                            title="Adicionar ao pedido"
                            onclick='adicionarProdutoPorCodigo(${JSON.stringify(codigo)})'
                        >+</button>
                    </div>
                </article>
            `;
        });
    }

    document.getElementById('pedidoGradeProdutos').innerHTML = html;
    document.getElementById('pedidoContadorPagina').textContent =
        `Página ${paginaPedidoAtual + 1} de ${totalPaginas} • ${produtos.length} produto(s)`;
}

function mudarPaginaPedido(direcao) {
    const total = produtosFiltradosPedido().length;
    const totalPaginas = Math.max(1, Math.ceil(total / itensPorPaginaPedido));
    paginaPedidoAtual = (paginaPedidoAtual + direcao + totalPaginas) % totalPaginas;
    renderizarProdutosPedido();
}

function adicionarProdutoPorCodigo(codigo) {
    const cab = obterCabecalhosProduto();
    const produto = dadosGlobais.find(
        item => String(item[cab.codigo] || '') === String(codigo)
    );

    if (produto) adicionarAoCarrinhoPedido(produto, true);
}

function adicionarAoCarrinhoPedido(produto, mostrarFeedback = true) {
    const cab = obterCabecalhosProduto();
    const codigo = String(produto[cab.codigo] || '');
    const existente = carrinhoPedido.find(item => item.codigo === codigo);

    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinhoPedido.push({
            codigo,
            descricao: String(produto[cab.descricao] || ''),
            marca: String(produto[cab.marca] || ''),
            precoPrazo: moedaParaNumero(produto[cab.preco]),
            entregaFutura: produtoEhEntregaFutura(produto),
            quantidade: 1
        });
    }

    renderizarCarrinhoPedido();

    if (mostrarFeedback) {
        const botao = document.getElementById('btnFinalizarPedido');
        botao.textContent = 'Produto adicionado ✓';
        setTimeout(() => botao.textContent = modoPedidoAtual === 'COMPLEMENTO' ? 'Salvar complemento' : 'Finalizar pedido', 700);
    }
}

function sincronizarSeletorFormaPagamento(bloquear = false) {
    const grupo = document.getElementById('pedidoFormaPagamentoGrupo');
    const radios = document.querySelectorAll('input[name="pedidoFormaPagamento"]');

    radios.forEach(radio => {
        radio.checked = normalizarFormaPagamento(radio.value) === formaPagamentoPedido;
        radio.disabled = bloquear;
    });

    if (grupo) grupo.classList.toggle('bloqueada', bloquear);
}

function alterarFormaPagamentoPedido(valor) {
    formaPagamentoPedido = normalizarFormaPagamento(valor);
    renderizarProdutosPedido();
    renderizarCarrinhoPedido();
}

function precoUnitarioAtualItem(item) {
    return obterPrecoPorForma(item.precoPrazo, formaPagamentoPedido);
}

function alterarQuantidadePedido(codigo, variacao) {
    const item = carrinhoPedido.find(produto => produto.codigo === codigo);
    if (!item) return;

    item.quantidade += variacao;

    if (item.quantidade <= 0) {
        carrinhoPedido = carrinhoPedido.filter(produto => produto.codigo !== codigo);
    }

    renderizarCarrinhoPedido();
}

function removerItemPedido(codigo) {
    carrinhoPedido = carrinhoPedido.filter(item => item.codigo !== codigo);
    renderizarCarrinhoPedido();
}

function renderizarCarrinhoPedido() {
    const container = document.getElementById('pedidoItens');

    if (carrinhoPedido.length === 0) {
        container.innerHTML = `
            <div class="pedido-vazio">
                <div style="font-size:38px;margin-bottom:10px;">🛍️</div>
                <strong>Seu pedido está vazio</strong>
                <p style="font-size:12px;">Clique no botão + de um produto para adicioná-lo.</p>
            </div>
        `;
    } else {
        container.innerHTML = carrinhoPedido.map(item => `
            <div class="item-carrinho">
                <div class="item-carrinho-titulo">${item.descricao}</div>
                <div class="item-carrinho-codigo">Cód. ${item.codigo} • ${formatarMoeda(precoUnitarioAtualItem(item))} cada</div>
                <div class="item-carrinho-forma">${rotuloFormaPagamento()}</div>
                ${item.entregaFutura ? '<div class="item-entrega-futura">🚚 Produto sob encomenda</div>' : ''}

                <div class="item-carrinho-linha">
                    <div class="controle-quantidade">
                        <button type="button" onclick='alterarQuantidadePedido(${JSON.stringify(item.codigo)}, -1)'>−</button>
                        <span>${item.quantidade}</span>
                        <button type="button" onclick='alterarQuantidadePedido(${JSON.stringify(item.codigo)}, 1)'>+</button>
                    </div>

                    <div class="item-carrinho-subtotal">
                        ${formatarMoeda(precoUnitarioAtualItem(item) * item.quantidade)}
                    </div>
                </div>

                <button class="btn-remover-item" type="button" onclick='removerItemPedido(${JSON.stringify(item.codigo)})'>
                    Remover item
                </button>
            </div>
        `).join('');
    }

    const quantidadeTotal = carrinhoPedido.reduce((soma, item) => soma + item.quantidade, 0);
    const valorTotal = carrinhoPedido.reduce(
        (soma, item) => soma + (precoUnitarioAtualItem(item) * item.quantidade),
        0
    );

    const possuiEntregaFutura = carrinhoPedido.some(item => item.entregaFutura);

    document.getElementById('pedidoQuantidadeResumo').textContent =
        quantidadeTotal === 0
            ? 'Nenhum item adicionado'
            : possuiEntregaFutura
                ? `${quantidadeTotal} unidade(s) • possui item sob encomenda`
                : `${quantidadeTotal} unidade(s) no pedido`;

    document.getElementById('pedidoQtdTotal').textContent = quantidadeTotal;
    document.getElementById('pedidoItensDiferentes').textContent = carrinhoPedido.length;
    document.getElementById('pedidoValorTotal').textContent = formatarMoeda(valorTotal);

    const valorMobile = document.getElementById('pedidoValorTotalMobile');
    if (valorMobile) {
        valorMobile.textContent = formatarMoeda(valorTotal);
    }

    const semItens = carrinhoPedido.length === 0;
    document.getElementById('btnFinalizarPedido').disabled = semItens;

    const botaoMobile = document.getElementById('btnIrFinalizacaoMobile');
    if (botaoMobile) {
        botaoMobile.disabled = semItens;
    }
}

function irParaFinalizacaoPedido() {
    const checkout = document.querySelector(".pedido-checkout-principal");

    if (!checkout) return;

    checkout.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    checkout.classList.add("pedido-checkout-destaque");

    setTimeout(() => {
        checkout.classList.remove("pedido-checkout-destaque");
    }, 1400);
}

async function finalizarPedido() {
    if (carrinhoPedido.length === 0) return;

    const cpf = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
    const botao = document.getElementById('btnFinalizarPedido');
    const itensEnviados = carrinhoPedido.map(item => {
        const precoUnitario = precoUnitarioAtualItem(item);
        return {
            codigo: item.codigo,
            descricao: item.descricao,
            marca: item.marca,
            quantidade: item.quantidade,
            precoPrazo: item.precoPrazo,
            precoUnitario,
            subtotal: precoUnitario * item.quantidade,
            entregaFutura: Boolean(item.entregaFutura)
        };
    });
    const observacao = document.getElementById('pedidoObservacao').value.trim().toUpperCase();
    const seletorVendedor = document.getElementById('pedidoVendedor');
    const vendedor = modoPedidoAtual === 'COMPLEMENTO'
        ? ''
        : String(seletorVendedor?.value || '').trim().toUpperCase();

    if (modoPedidoAtual !== 'COMPLEMENTO' && !vendedor) {
        alert('Escolha o vendedor que receberá o pedido.');
        seletorVendedor?.focus();
        return;
    }

    botao.disabled = true;
    botao.textContent = 'Registrando pedido...';

    try {
        const resultado = await enviarParaGAS({
            acao: modoPedidoAtual === 'COMPLEMENTO' ? 'salvarComplemento' : 'salvarPedido',
            cpf,
            numeroPedido: pedidoComplementoNumero,
            observacao,
            vendedor,
            formaPagamento: formaPagamentoPedido,
            itens: itensEnviados
        });

        const statusPedido = modoPedidoAtual === 'COMPLEMENTO'
            ? 'AGUARDANDO CONFERÊNCIA'
            : (resultado.status || 'AGUARDANDO CONFERÊNCIA');

        pedidoConcluidoAtual = criarDadosDocumentoPedido({
            numeroPedido: resultado.numeroPedido,
            dataPedido: resultado.dataPedido || new Date().toLocaleString('pt-BR'),
            status: statusPedido,
            observacao,
            valorTotal: resultado.valorTotal,
            quantidadeTotal: resultado.quantidadeTotal,
            vendedor: resultado.vendedor || vendedor,
            whatsappVendedor: resultado.whatsappVendedor || "",
            formaPagamento: resultado.formaPagamento || formaPagamentoPedido
        }, itensEnviados, obterClienteDoPedido());

        document.getElementById('mensagemPedidoSucesso').textContent = modoPedidoAtual === 'COMPLEMENTO'
            ? `Complemento incluído no pedido ${resultado.numeroPedido}.`
            : `Pedido ${resultado.numeroPedido} salvo com sucesso.`;

        document.getElementById('resumoPedidoConcluido').innerHTML = `
            <div><span>Pedido</span><strong>${pedidoConcluidoAtual.numeroPedido}</strong></div>
            <div><span>Status</span><strong>${pedidoConcluidoAtual.status}</strong></div>
            <div><span>Vendedor</span><strong>${pedidoConcluidoAtual.vendedor || ""}</strong></div>
            <div><span>Pagamento</span><strong>${pedidoConcluidoAtual.formaPagamento || ""}</strong></div>
            <div><span>Quantidade</span><strong>${pedidoConcluidoAtual.quantidadeTotal}</strong></div>
            <div><span>Valor total</span><strong>${formatarMoeda(pedidoConcluidoAtual.valorTotal)}</strong></div>
        `;

        const modalSucesso = document.getElementById('modalPedidoSucesso');
        modalSucesso.classList.add('ativo');

        requestAnimationFrame(() => {
            modalSucesso.scrollTop = 0;

            const cardSucesso = modalSucesso.querySelector('.pedido-sucesso-card');
            const corpoSucesso = modalSucesso.querySelector('.pedido-sucesso-corpo');

            if (cardSucesso) cardSucesso.scrollTop = 0;
            if (corpoSucesso) corpoSucesso.scrollTop = 0;
        });

        carrinhoPedido = [];
        document.getElementById('pedidoObservacao').value = '';
        renderizarCarrinhoPedido();
    } catch (erro) {
        alert('Erro ao salvar o pedido: ' + erro.message);
    } finally {
        botao.disabled = carrinhoPedido.length === 0;
        botao.textContent = modoPedidoAtual === 'COMPLEMENTO' ? 'Salvar complemento' : 'Finalizar pedido';
    }
}

function fecharPedidoConcluido() {
    document.getElementById('modalPedidoSucesso').classList.remove('ativo');
    voltarAoCarrosselDoPedido();
}
