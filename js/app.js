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

async function esconderTelaBoasVindas() {
    if (telaJaFechada) return;
    telaJaFechada = true;

    const tela = document.getElementById("telaBoasVindas");

    // Abre o módulo imediatamente para mostrar o estado de carregamento.
    iniciarCarrossel();

    const carregou = await carregarDadosPlanilha();

    if (tela) {
        tela.classList.add("tela-oculta");
        setTimeout(() => {
            tela.style.display = "none";
        }, 1200);
    }

    if (carregou) {
        indicePaginaCarrossel = 0;
        renderizarPaginaCarrossel();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    registrarEventosSiclar();
    esconderTelaBoasVindas();
});
