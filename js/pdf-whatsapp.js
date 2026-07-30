"use strict";

const EMPRESA_PEDIDO = {
    nome: "LAR DOCE LAR",
    complemento: "MATERIAIS PARA CONSTRUÇÃO",
    whatsapp: "5566984397034",
    whatsappExibicao: "(66) 98439-7034"
};

function obterClienteDoPedido() {
    return clientePedidoAtual || clienteEncontradoAtual || {};
}

function valorClienteParaDocumento(cliente, ...nomes) {
    for (const nome of nomes) {
        const valor = obterValorCliente(cliente, nome);
        if (String(valor || "").trim()) return String(valor).trim();
    }
    return "";
}

function montarEnderecoCliente(cliente) {
    const endereco = valorClienteParaDocumento(cliente, "ENDERECO", "ENDEREÇO");
    const numero = valorClienteParaDocumento(cliente, "NUMERO", "NÚMERO");
    const bairro = valorClienteParaDocumento(cliente, "BAIRRO");
    const cidade = valorClienteParaDocumento(cliente, "CIDADE");
    const uf = valorClienteParaDocumento(cliente, "UF");
    const cep = valorClienteParaDocumento(cliente, "CEP");

    const primeiraLinha = [endereco, numero ? `Nº ${numero}` : ""].filter(Boolean).join(", ");
    const segundaLinha = [bairro, [cidade, uf].filter(Boolean).join(" - "), cep ? `CEP ${formatarCep(cep)}` : ""]
        .filter(Boolean)
        .join(" • ");

    return [primeiraLinha, segundaLinha].filter(Boolean).join("\n");
}

function normalizarItensDocumento(itens) {
    return (itens || []).map(item => ({
        codigo: item.codigo ?? item.CODIGO_PRODUTO ?? "",
        descricao: item.descricao ?? item.DESCRICAO ?? "",
        marca: item.marca ?? item.MARCA ?? "",
        quantidade: Number(item.quantidade ?? item.QUANTIDADE ?? 0),
        precoUnitario: moedaParaNumero(item.precoUnitario ?? item.PRECO_UNITARIO ?? 0),
        subtotal: moedaParaNumero(item.subtotal ?? item.SUBTOTAL ?? 0)
    }));
}

function criarDadosDocumentoPedido(pedido, itens, cliente) {
    const itensNormalizados = normalizarItensDocumento(itens);
    const quantidade = itensNormalizados.reduce((soma, item) => soma + item.quantidade, 0);
    const totalItens = itensNormalizados.reduce((soma, item) => soma + item.subtotal, 0);

    return {
        numeroPedido: String(pedido.numeroPedido ?? pedido.NUMERO_PEDIDO ?? ""),
        dataPedido: String(pedido.dataPedido ?? pedido.DATA_PEDIDO ?? new Date().toLocaleString("pt-BR")),
        status: String(pedido.status ?? pedido.STATUS ?? "AGUARDANDO CONFERÊNCIA"),
        observacao: String(pedido.observacao ?? pedido.OBSERVACAO ?? ""),
        valorTotal: moedaParaNumero(pedido.valorTotal ?? pedido.VALOR_TOTAL ?? totalItens),
        quantidadeTotal: Number(pedido.quantidadeTotal ?? pedido.QUANTIDADE_ITENS ?? quantidade),
        vendedor: String(pedido.vendedor ?? pedido.VENDEDOR ?? ""),
        whatsappVendedor: String(pedido.whatsappVendedor ?? pedido.WHATSAPP_VENDEDOR ?? ""),
        cliente: cliente || {},
        itens: itensNormalizados
    };
}

function obterJsPdf() {
    return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
}

function adicionarRodapePdf(doc, numeroPagina, totalPaginas) {
    const altura = doc.internal.pageSize.getHeight();
    const largura = doc.internal.pageSize.getWidth();

    doc.setDrawColor(210);
    doc.line(14, altura - 20, largura - 14, altura - 20);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
        `${EMPRESA_PEDIDO.nome} ${EMPRESA_PEDIDO.complemento} • WhatsApp ${EMPRESA_PEDIDO.whatsappExibicao}`,
        14,
        altura - 13
    );
    doc.text(`Página ${numeroPagina} de ${totalPaginas}`, largura - 14, altura - 13, { align: "right" });
    doc.text(
        "Pedido sujeito à conferência de preço, referência e disponibilidade antes da confirmação.",
        14,
        altura - 8
    );
}

function gerarPdfPedido(dados) {
    const JsPdf = obterJsPdf();

    if (!JsPdf) {
        throw new Error(
            "A biblioteca de PDF não foi carregada. Verifique sua conexão com a internet e tente novamente."
        );
    }

    const doc = new JsPdf({ unit: "mm", format: "a4" });
    const largura = doc.internal.pageSize.getWidth();
    const margem = 14;
    const larguraUtil = largura - margem * 2;
    let y = 16;

    const novaPaginaSeNecessario = (alturaNecessaria = 12) => {
        if (y + alturaNecessaria > 270) {
            doc.addPage();
            y = 18;
        }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(25);
    doc.text(EMPRESA_PEDIDO.nome, largura / 2, y, { align: "center" });
    y += 7;

    doc.setFontSize(12);
    doc.text(EMPRESA_PEDIDO.complemento, largura / 2, y, { align: "center" });
    y += 10;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margem, y, larguraUtil, 24, 2, 2, "F");
    doc.setFontSize(14);
    doc.text("PEDIDO DE COMPRA", margem + 5, y + 8);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Pedido: ${dados.numeroPedido}`, margem + 5, y + 15);
    doc.text(`Data: ${dados.dataPedido}`, margem + 5, y + 20);
    doc.setFont("helvetica", "bold");
    doc.text(`Status: ${dados.status}`, largura - margem - 5, y + 15, { align: "right" });
    if (dados.vendedor) {
        doc.text(`Vendedor: ${dados.vendedor}`, largura - margem - 5, y + 20, { align: "right" });
    }
    y += 32;

    const cliente = dados.cliente || {};
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE", margem, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");

    const nome = valorClienteParaDocumento(cliente, "NOME_COMPLETO", "NOME COMPLETO") || "CLIENTE";
    const cpf = valorClienteParaDocumento(cliente, "CPF");
    const telefone = valorClienteParaDocumento(cliente, "TELEFONE");
    const email = valorClienteParaDocumento(cliente, "EMAIL", "E-MAIL");
    const endereco = montarEnderecoCliente(cliente);

    const dadosClienteLinhas = [
        `Nome: ${nome}`,
        cpf ? `CPF: ${formatarCpf(cpf)}` : "",
        telefone ? `Telefone: ${telefone}` : "",
        email ? `E-mail: ${email}` : "",
        endereco ? `Endereço: ${endereco}` : ""
    ].filter(Boolean);

    dadosClienteLinhas.forEach(texto => {
        const linhas = doc.splitTextToSize(texto, larguraUtil);
        doc.text(linhas, margem, y);
        y += linhas.length * 5;
    });
    y += 3;

    novaPaginaSeNecessario(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setFillColor(35, 72, 115);
    doc.setTextColor(255);
    doc.rect(margem, y, larguraUtil, 8, "F");
    doc.text("CÓDIGO", margem + 2, y + 5.5);
    doc.text("DESCRIÇÃO", margem + 26, y + 5.5);
    doc.text("QTD.", margem + 125, y + 5.5, { align: "right" });
    doc.text("UNITÁRIO", margem + 151, y + 5.5, { align: "right" });
    doc.text("SUBTOTAL", largura - margem - 2, y + 5.5, { align: "right" });
    y += 10;

    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    dados.itens.forEach((item, indice) => {
        const descricao = [item.descricao, item.marca ? `(${item.marca})` : ""].filter(Boolean).join(" ");
        const descricaoLinhas = doc.splitTextToSize(descricao, 92);
        const alturaLinha = Math.max(8, descricaoLinhas.length * 4.2 + 2);
        novaPaginaSeNecessario(alturaLinha + 3);

        if (indice % 2 === 0) {
            doc.setFillColor(248, 249, 251);
            doc.rect(margem, y - 1, larguraUtil, alturaLinha, "F");
        }

        doc.text(String(item.codigo), margem + 2, y + 4);
        doc.text(descricaoLinhas, margem + 26, y + 4);
        doc.text(String(item.quantidade), margem + 125, y + 4, { align: "right" });
        doc.text(formatarMoeda(item.precoUnitario), margem + 151, y + 4, { align: "right" });
        doc.text(formatarMoeda(item.subtotal), largura - margem - 2, y + 4, { align: "right" });
        y += alturaLinha;
    });

    y += 5;
    novaPaginaSeNecessario(40);

    doc.setDrawColor(210);
    doc.line(margem, y, largura - margem, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Quantidade total: ${dados.quantidadeTotal}`, margem, y);
    doc.setFontSize(14);
    doc.text(`VALOR TOTAL: ${formatarMoeda(dados.valorTotal)}`, largura - margem, y, { align: "right" });
    y += 9;

    if (dados.observacao) {
        doc.setFontSize(9);
        doc.text("Observação:", margem, y);
        doc.setFont("helvetica", "normal");
        const linhasObs = doc.splitTextToSize(dados.observacao, larguraUtil - 22);
        doc.text(linhasObs, margem + 22, y);
        y += Math.max(6, linhasObs.length * 4.5);
    }

    y += 5;
    novaPaginaSeNecessario(28);
    doc.setFillColor(255, 248, 225);
    const aviso = "Este pedido foi registrado e será conferido pela equipe da Lar Doce Lar Materiais para Construção. Caso exista divergência de preço, referência ou disponibilidade, entraremos em contato antes da confirmação.";
    const linhasAviso = doc.splitTextToSize(aviso, larguraUtil - 10);
    const alturaAviso = linhasAviso.length * 5 + 8;
    doc.roundedRect(margem, y, larguraUtil, alturaAviso, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(linhasAviso, margem + 5, y + 7);

    const totalPaginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        doc.setPage(pagina);
        adicionarRodapePdf(doc, pagina, totalPaginas);
    }

    return doc;
}

function baixarPdfComDados(dados) {
    const doc = gerarPdfPedido(dados);
    const nomeSeguro = String(dados.numeroPedido || "PEDIDO").replace(/[^\w-]/g, "_");
    doc.save(`PEDIDO_${nomeSeguro}_LAR_DOCE_LAR.pdf`);
}

function montarMensagemWhatsApp(dados) {
    const nome = valorClienteParaDocumento(dados.cliente, "NOME_COMPLETO", "NOME COMPLETO") || "CLIENTE";
    const linhasItens = dados.itens.map(item =>
        `• ${item.quantidade}x ${item.descricao} (Cód. ${item.codigo}) — ${formatarMoeda(item.subtotal)}`
    );

    return [
        `Olá! Sou ${nome}.`,
        "",
        `Acabei de realizar o pedido *${dados.numeroPedido}* pelo SICLAR.`,
        `Status: *${dados.status}*`,
        dados.vendedor ? `Vendedor escolhido: *${dados.vendedor}*` : "",
        "",
        "*Itens do pedido:*",
        ...linhasItens,
        "",
        `*Valor total: ${formatarMoeda(dados.valorTotal)}*`,
        "",
        "Peço a conferência de preços, referências e disponibilidade.",
        "Obrigado!"
    ].filter(Boolean).join("\n");
}

function abrirWhatsAppComPedido(dados) {
    const mensagem = montarMensagemWhatsApp(dados);
    const numero = String(dados.whatsappVendedor || EMPRESA_PEDIDO.whatsapp).replace(/\D/g, "");
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
}

function baixarPdfPedidoConcluido() {
    if (!pedidoConcluidoAtual) {
        alert("Nenhum pedido concluído está disponível para gerar o PDF.");
        return;
    }

    try {
        baixarPdfComDados(pedidoConcluidoAtual);
    } catch (erro) {
        alert(erro.message);
    }
}

function enviarPedidoConcluidoWhatsApp() {
    if (!pedidoConcluidoAtual) {
        alert("Nenhum pedido concluído está disponível para envio.");
        return;
    }

    abrirWhatsAppComPedido(pedidoConcluidoAtual);
}

function abrirMeusPedidosAposConclusao() {
    document.getElementById("modalPedidoSucesso").classList.remove("ativo");
    abrirHistoricoPedidos();
}

function baixarPdfPedidoHistorico() {
    if (!ultimoPedidoPdfVisualizado) {
        alert("Abra um pedido antes de baixar o PDF.");
        return;
    }

    try {
        baixarPdfComDados(ultimoPedidoPdfVisualizado);
    } catch (erro) {
        alert(erro.message);
    }
}

function enviarPedidoHistoricoWhatsApp() {
    if (!ultimoPedidoPdfVisualizado) {
        alert("Abra um pedido antes de enviar pelo WhatsApp.");
        return;
    }

    abrirWhatsAppComPedido(ultimoPedidoPdfVisualizado);
}
