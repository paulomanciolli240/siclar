"use strict";

function abrirMontagemPedido(numeroPedidoComplemento = null) {
    pedidoComplementoNumero = numeroPedidoComplemento;
    modoPedidoAtual = numeroPedidoComplemento ? 'COMPLEMENTO' : 'NOVO';
    carrinhoPedido = [];

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
        if (!numeroPedidoComplemento) seletorVendedor.value = '';
    }
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
    const termo = document.getElementById('pedidoPesquisaProduto').value.trim().toLowerCase();
    const cab = obterCabecalhosProduto();

    return dadosGlobais.filter(produto => {
        if (!termo) return true;

        const alvo = [
            produto[cab.codigo],
            produto[cab.descricao],
            produto[cab.marca]
        ].join(' ').toLowerCase();

        return termo.split(/\s+/).every(parte => alvo.includes(parte));
    });
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
            const preco = moedaParaNumero(produto[cab.preco]);
            const foto = cab.foto && produto[cab.foto]
                ? `<img src="${resolverUrlImagem(String(produto[cab.foto]))}" alt="Produto" onerror="this.style.display='none'">`
                : '<span style="color:#94a3b8;font-size:11px;">Sem imagem</span>';

            html += `
                <article class="pedido-card-produto">
                    <div class="pedido-card-foto">${foto}</div>
                    <div class="pedido-card-marca">${marca}</div>
                    <div class="pedido-card-descricao">${descricao}</div>
                    <div class="pedido-card-rodape">
                        <div>
                            <div class="pedido-card-preco">${formatarMoeda(preco)}</div>
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
            precoUnitario: moedaParaNumero(produto[cab.preco]),
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
                <div class="item-carrinho-codigo">Cód. ${item.codigo} • ${formatarMoeda(item.precoUnitario)} cada</div>

                <div class="item-carrinho-linha">
                    <div class="controle-quantidade">
                        <button type="button" onclick='alterarQuantidadePedido(${JSON.stringify(item.codigo)}, -1)'>−</button>
                        <span>${item.quantidade}</span>
                        <button type="button" onclick='alterarQuantidadePedido(${JSON.stringify(item.codigo)}, 1)'>+</button>
                    </div>

                    <div class="item-carrinho-subtotal">
                        ${formatarMoeda(item.precoUnitario * item.quantidade)}
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
        (soma, item) => soma + (item.precoUnitario * item.quantidade),
        0
    );

    document.getElementById('pedidoQuantidadeResumo').textContent =
        quantidadeTotal === 0
            ? 'Nenhum item adicionado'
            : `${quantidadeTotal} unidade(s) no pedido`;

    document.getElementById('pedidoQtdTotal').textContent = quantidadeTotal;
    document.getElementById('pedidoItensDiferentes').textContent = carrinhoPedido.length;
    document.getElementById('pedidoValorTotal').textContent = formatarMoeda(valorTotal);
    document.getElementById('btnFinalizarPedido').disabled = carrinhoPedido.length === 0;
}

async function finalizarPedido() {
    if (carrinhoPedido.length === 0) return;

    const cpf = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
    const botao = document.getElementById('btnFinalizarPedido');
    const itensEnviados = carrinhoPedido.map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        marca: item.marca,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.precoUnitario * item.quantidade
    }));
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
            whatsappVendedor: resultado.whatsappVendedor || ""
        }, itensEnviados, obterClienteDoPedido());

        document.getElementById('mensagemPedidoSucesso').textContent = modoPedidoAtual === 'COMPLEMENTO'
            ? `Complemento incluído no pedido ${resultado.numeroPedido}.`
            : `Pedido ${resultado.numeroPedido} salvo com sucesso.`;

        document.getElementById('resumoPedidoConcluido').innerHTML = `
            <div><span>Pedido</span><strong>${pedidoConcluidoAtual.numeroPedido}</strong></div>
            <div><span>Status</span><strong>${pedidoConcluidoAtual.status}</strong></div>
            <div><span>Vendedor</span><strong>${pedidoConcluidoAtual.vendedor || ""}</strong></div>
            <div><span>Quantidade</span><strong>${pedidoConcluidoAtual.quantidadeTotal}</strong></div>
            <div><span>Valor total</span><strong>${formatarMoeda(pedidoConcluidoAtual.valorTotal)}</strong></div>
        `;

        document.getElementById('modalPedidoSucesso').classList.add('ativo');
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
