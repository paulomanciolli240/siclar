"use strict";

let csvData = [];
let headers = [];
let dadosGlobais = [];
let listaFiltradaAtual = [];
let indiceEdicaoAtual = 0;
let indicePaginaCarrossel = 0;
let itensPorPagina = window.innerWidth >= 1025 ? 8 : 4;
let timerCarrossel = null;
let carrosselAtivo = false;
let telaJaFechada = false;
let pausaPorHover = false;
let termoPesquisaCarrossel = "";
let importacaoCancelada = false;
let produtoSelecionadoParaCompra = null;
let erroCarregamentoPlanilha = "";
let clienteEncontradoAtual = null;
let modoEdicaoCliente = false;

const CHAVE_CPF_SICLAR = "siclar_cpf_cliente";

let carrinhoPedido = [];
let paginaPedidoAtual = 0;
let itensPorPaginaPedido = 12;
let clientePedidoAtual = null;

let pedidosClienteAtual = [];
let pedidoVisualizadoAtual = null;
let pedidoComplementoNumero = null;
let modoPedidoAtual = "NOVO";

let adminToken = "";
let adminDigitacaoOculta = "";
let adminClientes = [];
let adminPedidos = [];
let adminClienteEmEdicao = null;
let adminPedidoSelecionado = null;

let pedidoConcluidoAtual = null;
let ultimoPedidoPdfVisualizado = null;


let adminUsuario = null;

const DESCONTO_PRECO_A_VISTA = 0.049;
const FATOR_PRECO_A_VISTA = 1 - DESCONTO_PRECO_A_VISTA;
let formaPagamentoPedido = "A VISTA";

function normalizarFormaPagamento(valor) {
    const forma = String(valor || "").trim().toUpperCase();
    return forma === "A PRAZO" ? "A PRAZO" : "A VISTA";
}

function calcularPrecoAVista(precoPrazo) {
    const valor = moedaParaNumero(precoPrazo);
    return Math.round((valor * FATOR_PRECO_A_VISTA + Number.EPSILON) * 100) / 100;
}

function obterPrecoPorForma(precoPrazo, forma = formaPagamentoPedido) {
    return normalizarFormaPagamento(forma) === "A PRAZO"
        ? moedaParaNumero(precoPrazo)
        : calcularPrecoAVista(precoPrazo);
}

function rotuloFormaPagamento(forma = formaPagamentoPedido) {
    return normalizarFormaPagamento(forma) === "A PRAZO"
        ? "A prazo"
        : "À vista";
}


/* Modo de navegação do catálogo público. */
let modoCatalogoAtual = "ESTOQUE";
let catalogoCarregadoEmSegundoPlano = false;

function obterCabecalhoTipoEntrega() {
    return headers.find(cabecalho => {
        const nome = String(cabecalho || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        return nome === "tipo_entrega" ||
            nome === "tipo entrega" ||
            nome === "tipo_produto" ||
            nome === "tipo produto" ||
            nome === "entrega_futura" ||
            nome === "entrega futura";
    }) || "";
}

function produtoEhEntregaFutura(produto) {
    const cabecalho = obterCabecalhoTipoEntrega();
    if (!cabecalho || !produto) return false;

    const valor = String(produto[cabecalho] || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    return [
        "FUTURA",
        "ENCOMENDA",
        "SOB ENCOMENDA",
        "ENTREGA FUTURA",
        "SIM"
    ].includes(valor);
}

function filtrarProdutosPorModoCatalogo(lista) {
    const produtos = Array.isArray(lista) ? lista : [];

    return produtos.filter(produto =>
        modoCatalogoAtual === "FUTURA"
            ? produtoEhEntregaFutura(produto)
            : !produtoEhEntregaFutura(produto)
    );
}
