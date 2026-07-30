"use strict";

function statusPermiteComplemento(status) {
    const valor = String(status || '').trim().toUpperCase();
    return ['NOVO', 'ABERTO', 'EM ABERTO'].includes(valor);
}

async function abrirHistoricoPedidos() {
    const cpf = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
    if (!cpf) return;

    document.getElementById('telaCadastroCliente').classList.remove('ativa');
    document.getElementById('moduloPedidos').style.display = 'none';
    document.getElementById('moduloCarrossel').style.display = 'none';
    document.getElementById('moduloHistoricoPedidos').style.display = 'block';

    const lista = document.getElementById('listaPedidosCliente');
    lista.innerHTML = '<div class="historico-vazio">Carregando pedidos...</div>';

    try {
        const resultado = await enviarParaGAS({ acao:'listarPedidosCliente', cpf });
        pedidosClienteAtual = resultado.pedidos || [];
        renderizarListaPedidosCliente();
        if (pedidosClienteAtual.length) abrirDetalhePedido(pedidosClienteAtual[0].NUMERO_PEDIDO);
    } catch (erro) {
        lista.innerHTML = `<div class="historico-vazio" style="color:#dc2626;">${erro.message}</div>`;
    }
}

function fecharHistoricoPedidos() {
    document.getElementById('moduloHistoricoPedidos').style.display = 'none';
    document.getElementById('moduloCarrossel').style.display = 'flex';
    iniciarCarrossel();
}

function renderizarListaPedidosCliente() {
    const lista = document.getElementById('listaPedidosCliente');
    if (!pedidosClienteAtual.length) {
        lista.innerHTML = '<div class="historico-vazio">Você ainda não possui pedidos.</div>';
        document.getElementById('detalhePedidoCliente').innerHTML = '<div class="historico-vazio">Nenhum pedido para visualizar.</div>';
        return;
    }

    lista.innerHTML = pedidosClienteAtual.map(pedido => {
        const aberto = statusPermiteComplemento(pedido.STATUS);
        return `<div class="pedido-historico-card" data-numero="${pedido.NUMERO_PEDIDO}" onclick='abrirDetalhePedido(${JSON.stringify(pedido.NUMERO_PEDIDO)})'>
            <div class="pedido-historico-numero">${pedido.NUMERO_PEDIDO}</div>
            <div class="pedido-historico-meta"><span>${pedido.DATA_PEDIDO || ''} • ${pedido.VENDEDOR || "VENDEDOR NÃO INFORMADO"}</span><span class="status-pedido ${aberto?'status-aberto':'status-bloqueado'}">${pedido.STATUS || ''}</span></div>
            <div class="pedido-historico-meta"><span>${pedido.QUANTIDADE_ITENS || 0} unidade(s)</span><strong>${formatarMoeda(moedaParaNumero(pedido.VALOR_TOTAL))}</strong></div>
        </div>`;
    }).join('');
}

async function abrirDetalhePedido(numeroPedido) {
    document.querySelectorAll('.pedido-historico-card').forEach(card => card.classList.toggle('ativo', card.dataset.numero === numeroPedido));
    const detalhe = document.getElementById('detalhePedidoCliente');
    detalhe.innerHTML = '<div class="historico-vazio">Abrindo pedido...</div>';

    try {
        const cpf = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
        const resultado = await enviarParaGAS({ acao:'obterPedidoCliente', cpf, numeroPedido });
        pedidoVisualizadoAtual = resultado.pedido;
        ultimoPedidoPdfVisualizado = criarDadosDocumentoPedido(
            resultado.pedido,
            resultado.itens || [],
            obterClienteDoPedido()
        );
        renderizarDetalhePedido(resultado.pedido, resultado.itens || []);
    } catch (erro) {
        detalhe.innerHTML = `<div class="historico-vazio" style="color:#dc2626;">${erro.message}</div>`;
    }
}

function renderizarDetalhePedido(pedido, itens) {
    const permite = statusPermiteComplemento(pedido.STATUS);
    const linhas = itens.map(item => {
        const tipo = String(item.TIPO_ITEM || 'ORIGINAL').toUpperCase();
        const complemento = tipo === 'COMPLEMENTO';
        return `<tr class="${complemento?'linha-complemento':''}">
            <td><span class="selo-item ${complemento?'selo-complemento':'selo-original'}">${complemento?'COMPLEMENTO':'ORIGINAL'}</span></td>
            <td>${item.CODIGO_PRODUTO || ''}</td><td>${item.DESCRICAO || ''}</td><td>${item.QUANTIDADE || 0}</td>
            <td>${formatarMoeda(moedaParaNumero(item.PRECO_UNITARIO))}</td><td>${formatarMoeda(moedaParaNumero(item.SUBTOTAL))}</td>
            <td>${item.DATA_INCLUSAO || ''}</td>
        </tr>`;
    }).join('');

    document.getElementById('detalhePedidoCliente').innerHTML = `
        <div class="detalhe-pedido-cabecalho"><div><h3>${pedido.NUMERO_PEDIDO}</h3><div style="color:#64748b;font-size:13px;">Criado em ${pedido.DATA_PEDIDO || ''} • Vendedor ${pedido.VENDEDOR || "NÃO INFORMADO"}</div></div><span class="status-pedido ${permite?'status-aberto':'status-bloqueado'}">${pedido.STATUS || ''}</span></div>
        <div class="detalhe-pedido-resumo">
            <div class="resumo-pedido-bloco"><span>Quantidade total</span><strong>${pedido.QUANTIDADE_ITENS || 0}</strong></div>
            <div class="resumo-pedido-bloco"><span>Valor total atualizado</span><strong>${formatarMoeda(moedaParaNumero(pedido.VALOR_TOTAL))}</strong></div>
            <div class="resumo-pedido-bloco"><span>Observação</span><strong style="font-size:12px;">${pedido.OBSERVACAO || 'SEM OBSERVAÇÃO'}</strong></div>
        </div>
        <div style="overflow-x:auto;"><table class="tabela-itens-pedido"><thead><tr><th>Tipo</th><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th><th>Inclusão</th></tr></thead><tbody>${linhas || '<tr><td colspan="7">Nenhum item encontrado.</td></tr>'}</tbody></table></div>
        <div class="acoes-documento-pedido">
            <button class="btn btn-pdf-pedido" type="button" onclick="baixarPdfPedidoHistorico()">📄 Baixar PDF</button>
            <button class="btn btn-whatsapp-pedido" type="button" onclick="enviarPedidoHistoricoWhatsApp()">💬 Enviar pelo WhatsApp</button>
        </div>
        ${permite ? `<div class="area-complemento"><h4>Pedido em aberto</h4><p>Os itens existentes são somente para consulta. Você pode acrescentar novos produtos como complemento, sem modificar ou excluir o pedido original.</p><button class="btn" onclick='iniciarComplementoPedido(${JSON.stringify(pedido.NUMERO_PEDIDO)})'>+ Acrescentar complemento</button></div>` : `<div class="aviso-somente-leitura">Pedido ${String(pedido.STATUS || '').toLowerCase()} — somente leitura. Não é possível alterar nem acrescentar produtos.</div>`}
    `;
}

function iniciarComplementoPedido(numeroPedido) {
    document.getElementById('moduloHistoricoPedidos').style.display = 'none';
    produtoSelecionadoParaCompra = null;
    abrirMontagemPedido(numeroPedido);
}
