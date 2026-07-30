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
