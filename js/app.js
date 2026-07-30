"use strict";

async function esconderTelaBoasVindas() {
    if (telaJaFechada) return;
    telaJaFechada = true;

    await carregarDadosPlanilha();

    const tela = document.getElementById("telaBoasVindas");
    tela.classList.add("tela-oculta");

    setTimeout(() => {
        tela.style.display = "none";
        iniciarCarrossel();
    }, 1200);
}

document.getElementById("pesquisaCarrossel").addEventListener("input", event => {
    termoPesquisaCarrossel = event.target.value.trim();
    indicePaginaCarrossel = 0;
    renderizarPaginaCarrossel();
});

document.getElementById("clienteCpfConsulta").addEventListener("input", function () {
    this.value = formatarCpf(this.value);
});

document.getElementById("clienteCpfConsulta").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        consultarCpfCliente();
    }
});

document.getElementById("clienteTelefone").addEventListener("input", function () {
    this.value = formatarTelefone(this.value);
});

document.getElementById("clienteCep").addEventListener("input", function () {
    this.value = formatarCep(this.value);
    if (somenteNumeros(this.value).length === 8) {
        consultarCepCliente();
    }
});

document.querySelectorAll(
    "#formCadastroCliente input:not(#clienteEmail):not(#clienteCpf):not(#clienteCep):not(#clienteTelefone), #formCadastroCliente textarea"
).forEach(field => {
    field.addEventListener("input", function () {
        this.value = this.value.toUpperCase();
    });
});

document.getElementById("pedidoPesquisaProduto").addEventListener("input", () => {
    paginaPedidoAtual = 0;
    renderizarProdutosPedido();
});

window.addEventListener("resize", () => {
    const novoTamanho = window.innerWidth >= 1025 ? 8 : 4;

    if (novoTamanho !== itensPorPagina) {
        itensPorPagina = novoTamanho;
        indicePaginaCarrossel = 0;
        renderizarPaginaCarrossel();
    }
});

esconderTelaBoasVindas();
