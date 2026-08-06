"use strict";

function registrarEventosSiclar() {
    const pesquisaCarrossel = document.getElementById("pesquisaCarrossel");
    if (pesquisaCarrossel) {
        pesquisaCarrossel.addEventListener("input", event => {
            termoPesquisaCarrossel = event.target.value.trim();
            indicePaginaCarrossel = 0;
            renderizarPaginaCarrossel();
        });
    }

    const clienteCpfConsulta = document.getElementById("clienteCpfConsulta");
    if (clienteCpfConsulta) {
        clienteCpfConsulta.addEventListener("input", function () {
            this.value = formatarCpf(this.value);
        });

        clienteCpfConsulta.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                consultarCpfCliente();
            }
        });
    }

    const clienteTelefone = document.getElementById("clienteTelefone");
    if (clienteTelefone) {
        clienteTelefone.addEventListener("input", function () {
            this.value = formatarTelefone(this.value);
        });
    }

    const clienteCep = document.getElementById("clienteCep");
    if (clienteCep) {
        clienteCep.addEventListener("input", function () {
            this.value = formatarCep(this.value);
            if (somenteNumeros(this.value).length === 8) {
                consultarCepCliente();
            }
        });
    }

    document.querySelectorAll(
        "#formCadastroCliente input:not(#clienteEmail):not(#clienteCpf):not(#clienteCep):not(#clienteTelefone), #formCadastroCliente textarea"
    ).forEach(field => {
        field.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });
    });

    const pedidoPesquisaProduto = document.getElementById("pedidoPesquisaProduto");
    if (pedidoPesquisaProduto) {
        pedidoPesquisaProduto.addEventListener("input", () => {
            paginaPedidoAtual = 0;
            renderizarProdutosPedido();
        });
    }

    window.addEventListener("resize", () => {
        const novoTamanho = calcularItensPorPaginaCarrossel();

        if (novoTamanho !== itensPorPagina) {
            itensPorPagina = novoTamanho;
            indicePaginaCarrossel = 0;
            renderizarPaginaCarrossel();
        }
    });
}

async function carregarCatalogoEmSegundoPlano() {
    const status = document.getElementById("statusCatalogoApresentacao");

    try {
        const carregou = await carregarDadosPlanilha();
        catalogoCarregadoEmSegundoPlano = Boolean(carregou);

        if (status) {
            status.textContent = carregou
                ? `${dadosGlobais.length} produtos preparados. Escolha uma opção para continuar.`
                : "O catálogo será reconectado quando você tentar abri-lo.";
            status.classList.toggle("carregado", Boolean(carregou));
        }
    } catch (erro) {
        console.error("Falha no carregamento em segundo plano:", erro);
        if (status) status.textContent = "O catálogo será reconectado quando você tentar abri-lo.";
    }
}

function atualizarCabecalhoModoCatalogo() {
    const titulo = document.getElementById("tituloModoCatalogo");
    const subtitulo = document.getElementById("subtituloModoCatalogo");

    if (modoCatalogoAtual === "FUTURA") {
        if (titulo) titulo.textContent = "Produtos para entrega futura";
        if (subtitulo) subtitulo.textContent = "Itens sob encomenda, com prazo confirmado antes da conclusão";
    } else {
        if (titulo) titulo.textContent = "Produtos em estoque";
        if (subtitulo) subtitulo.textContent = "Clique em qualquer produto para iniciar seu pedido";
    }
}

async function abrirCatalogoSiclar(modo = "ESTOQUE") {
    modoCatalogoAtual = modo === "FUTURA" ? "FUTURA" : "ESTOQUE";
    atualizarCabecalhoModoCatalogo();

    const apresentacao = document.getElementById("telaApresentacao");
    const modulo = document.getElementById("moduloCarrossel");

    if (apresentacao) apresentacao.style.display = "none";
    if (modulo) modulo.style.display = "flex";

    produtosLoteVitrine = [];
    historicoLotesVitrine = [];
    indiceHistoricoLoteVitrine = -1;
    codigosRecentesVitrine = [];
    termoPesquisaCarrossel = "";
    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";

    const campo = document.getElementById("pesquisaCarrossel");
    if (campo) campo.value = "";

    carrosselAtivo = true;

    if (!catalogoCarregadoEmSegundoPlano || !dadosGlobais.length) {
        mostrarEstadoCarrossel("Conectando ao catálogo...", "Aguarde a resposta do Google Sheets.");
        catalogoCarregadoEmSegundoPlano = await carregarDadosPlanilha();
    }

    iniciarCarrossel();
}

function voltarParaApresentacao() {
    pararCarrossel();

    const modulo = document.getElementById("moduloCarrossel");
    const apresentacao = document.getElementById("telaApresentacao");

    if (modulo) modulo.style.display = "none";
    if (apresentacao) apresentacao.style.display = "block";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function iniciarAplicacaoSiclar() {
    try {
        registrarEventosSiclar();

        const apresentacao = document.getElementById("telaApresentacao");
        const modulo = document.getElementById("moduloCarrossel");

        if (apresentacao) apresentacao.style.display = "block";
        if (modulo) modulo.style.display = "none";

        carregarCatalogoEmSegundoPlano();
    } catch (erro) {
        console.error("Falha ao iniciar o SICLAR:", erro);

        const status = document.getElementById("statusCatalogoApresentacao");
        if (status) status.textContent = "Não foi possível preparar o catálogo neste momento.";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarAplicacaoSiclar, { once: true });
} else {
    iniciarAplicacaoSiclar();
}
