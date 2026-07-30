"use strict";

const SENHA_OCULTA_ADMIN = "mandabala";

let toquesAdminMobile = 0;
let timerToquesAdminMobile = null;

function registrarToqueAdminMobile() {
    toquesAdminMobile++;

    if (timerToquesAdminMobile) {
        clearTimeout(timerToquesAdminMobile);
    }

    timerToquesAdminMobile = setTimeout(() => {
        toquesAdminMobile = 0;
    }, 2200);

    if (toquesAdminMobile >= 5) {
        toquesAdminMobile = 0;
        clearTimeout(timerToquesAdminMobile);
        abrirAcessoAdminMobile();
    }
}

function abrirAcessoAdminMobile() {
    const modal = document.getElementById("modalAcessoAdminMobile");
    const campo = document.getElementById("senhaAdminMobile");
    const mensagem = document.getElementById("mensagemAdminMobile");

    campo.value = "";
    mensagem.textContent = "";
    mensagem.className = "mensagem-cliente";
    modal.classList.add("modal-ativo");

    setTimeout(() => campo.focus(), 100);
}

function fecharAcessoAdminMobile() {
    document.getElementById("modalAcessoAdminMobile").classList.remove("modal-ativo");
    document.getElementById("senhaAdminMobile").value = "";
}

async function confirmarAcessoAdminMobile() {
    const campo = document.getElementById("senhaAdminMobile");
    const botao = document.getElementById("btnEntrarAdminMobile");
    const mensagem = document.getElementById("mensagemAdminMobile");
    const senha = campo.value.trim();

    mensagem.textContent = "";
    mensagem.className = "mensagem-cliente";

    if (!senha) {
        mensagem.textContent = "Digite a senha administrativa.";
        mensagem.classList.add("erro");
        campo.focus();
        return;
    }

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        await autenticarAdministrador(senha);
        fecharAcessoAdminMobile();
    } catch (erro) {
        mensagem.textContent = erro.message || "Acesso negado.";
        mensagem.classList.add("erro");
        campo.select();
    } finally {
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
}


async function tentarAbrirAdminPorDigitacao(evento) {
    if (document.getElementById("moduloAdministrativo").style.display === "block") return;
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return;

    const alvo = evento.target;
    const digitandoEmCampo = alvo && (
        alvo.tagName === "INPUT" ||
        alvo.tagName === "TEXTAREA" ||
        alvo.tagName === "SELECT" ||
        alvo.isContentEditable
    );

    if (digitandoEmCampo) return;

    if (evento.key.length === 1) {
        adminDigitacaoOculta = (adminDigitacaoOculta + evento.key.toLowerCase()).slice(-30);
    }

    if (adminDigitacaoOculta.endsWith(SENHA_OCULTA_ADMIN)) {
        adminDigitacaoOculta = "";
        await autenticarAdministrador(SENHA_OCULTA_ADMIN);
    }
}

async function autenticarAdministrador(senha) {
    try {
        const resultado = await enviarParaGAS({
            acao: "autenticarAdmin",
            senha
        });

        adminToken = resultado.adminToken || "";
        if (!adminToken) {
            throw new Error("Não foi possível iniciar a sessão administrativa.");
        }

        sessionStorage.setItem("siclar_admin_token", adminToken);
        abrirPainelAdministrativo();
        return true;
    } catch (erro) {
        console.error("Falha no acesso administrativo:", erro);
        throw erro;
    }
}

async function validarSessaoAdminSalva() {
    const salvo = sessionStorage.getItem("siclar_admin_token") || "";
    if (!salvo) return false;

    try {
        await enviarParaGAS({ acao: "validarAdmin", adminToken: salvo });
        adminToken = salvo;
        return true;
    } catch {
        sessionStorage.removeItem("siclar_admin_token");
        return false;
    }
}

async function abrirPainelAdministrativo() {
    if (!adminToken) {
        const valido = await validarSessaoAdminSalva();
        if (!valido) return;
    }

    pararCarrossel();
    ["moduloCarrossel","moduloPedidos","moduloHistoricoPedidos"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    document.getElementById("telaCadastroCliente").classList.remove("ativa");
    document.getElementById("moduloAdministrativo").style.display = "block";
    abrirAbaAdmin("resumo");
}

function sairAdministrativo() {
    adminToken = "";
    sessionStorage.removeItem("siclar_admin_token");
    document.getElementById("moduloAdministrativo").style.display = "none";
    document.getElementById("moduloCarrossel").style.display = "flex";
    iniciarCarrossel();
}

function abrirAbaAdmin(nome) {
    document.querySelectorAll(".admin-aba").forEach(aba => aba.classList.remove("ativa"));
    document.querySelectorAll(".admin-menu-item").forEach(botao => {
        botao.classList.toggle("ativo", botao.dataset.adminTab === nome);
    });

    const id = "adminAba" + nome.charAt(0).toUpperCase() + nome.slice(1);
    document.getElementById(id).classList.add("ativa");

    if (nome === "resumo") carregarResumoAdmin();
    if (nome === "produtos") renderizarTabela();
    if (nome === "clientes") carregarClientesAdmin();
    if (nome === "pedidos") carregarPedidosAdmin();
}

async function carregarResumoAdmin() {
    const container = document.getElementById("adminCardsResumo");
    try {
        const resultado = await enviarParaGAS({
            acao: "resumoAdmin",
            adminToken
        });

        const dados = resultado.resumo || {};
        container.innerHTML = `
            <div class="admin-card-metrica"><span>Produtos</span><strong>${dados.produtos || 0}</strong></div>
            <div class="admin-card-metrica"><span>Clientes</span><strong>${dados.clientes || 0}</strong></div>
            <div class="admin-card-metrica"><span>Pedidos</span><strong>${dados.pedidos || 0}</strong></div>
            <div class="admin-card-metrica"><span>Pedidos em aberto</span><strong>${dados.pedidosAbertos || 0}</strong></div>
        `;

        const recentes = resultado.pedidosRecentes || [];
        document.getElementById("adminPedidosRecentes").innerHTML = montarTabelaPedidosAdmin(recentes, false);
    } catch (erro) {
        container.innerHTML = `<div class="admin-vazio">${erro.message}</div>`;
    }
}

async function carregarClientesAdmin() {
    const area = document.getElementById("adminListaClientes");
    area.innerHTML = '<p class="admin-carregando">Carregando clientes...</p>';

    try {
        const resultado = await enviarParaGAS({
            acao: "listarClientesAdmin",
            adminToken
        });
        adminClientes = resultado.clientes || [];
        renderizarClientesAdmin();
    } catch (erro) {
        area.innerHTML = `<div class="admin-vazio">${erro.message}</div>`;
    }
}

function renderizarClientesAdmin() {
    const termo = document.getElementById("adminBuscaCliente").value.trim().toLowerCase();
    const filtrados = adminClientes.filter(cliente => {
        const alvo = [
            cliente.CPF, cliente.NOME_COMPLETO, cliente.TELEFONE,
            cliente.EMAIL, cliente.CIDADE, cliente.STATUS
        ].join(" ").toLowerCase();
        return termo.split(/\s+/).filter(Boolean).every(parte => alvo.includes(parte));
    });

    const linhas = filtrados.map(cliente => `
        <tr>
            <td>${formatarCpf(cliente.CPF || "")}</td>
            <td>${cliente.NOME_COMPLETO || ""}</td>
            <td>${cliente.TELEFONE || ""}</td>
            <td>${cliente.CIDADE || ""}/${cliente.UF || ""}</td>
            <td>${cliente.STATUS || ""}</td>
            <td><button class="admin-btn-pequeno" onclick='abrirClienteAdmin(${JSON.stringify(cliente.CPF || "")})'>Editar</button></td>
        </tr>
    `).join("");

    document.getElementById("adminListaClientes").innerHTML = `
        <table class="admin-tabela">
            <thead><tr><th>CPF</th><th>Nome</th><th>Telefone</th><th>Cidade</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>${linhas || '<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>'}</tbody>
        </table>
    `;
}

function abrirClienteAdmin(cpf) {
    adminClienteEmEdicao = adminClientes.find(
        cliente => somenteNumeros(cliente.CPF) === somenteNumeros(cpf)
    );
    if (!adminClienteEmEdicao) return;

    const campos = [
        "CPF","NOME_COMPLETO","TELEFONE","EMAIL","CEP","ENDERECO","NUMERO",
        "BAIRRO","CIDADE","UF","PONTO DE REFERENCIA","OBSERVAÇÕES","STATUS"
    ];

    document.getElementById("adminClienteCpfInfo").textContent =
        `CPF ${formatarCpf(adminClienteEmEdicao.CPF || "")}`;

    document.getElementById("adminCamposCliente").innerHTML = campos.map(campo => {
        const readonly = campo === "CPF" ? "readonly" : "";
        const valor = adminClienteEmEdicao[campo] || "";
        return `<div class="grupo-campo-edicao">
            <label>${campo}</label>
            <input type="text" data-admin-cliente-campo="${campo}" value="${escaparHtml(valor)}" ${readonly}>
        </div>`;
    }).join("");

    document.getElementById("modalAdminCliente").classList.add("modal-ativo");
}

function fecharModalAdminCliente() {
    document.getElementById("modalAdminCliente").classList.remove("modal-ativo");
    adminClienteEmEdicao = null;
}

async function salvarClienteAdmin() {
    if (!adminClienteEmEdicao) return;

    const dadosCliente = {};
    document.querySelectorAll("[data-admin-cliente-campo]").forEach(input => {
        const campo = input.dataset.adminClienteCampo;
        dadosCliente[campo] = campo === "EMAIL"
            ? input.value.trim().toLowerCase()
            : input.value.trim().toUpperCase();
    });

    const botao = document.getElementById("btnSalvarAdminCliente");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        await enviarParaGAS({
            acao: "atualizarClienteAdmin",
            adminToken,
            dadosCliente
        });
        fecharModalAdminCliente();
        await carregarClientesAdmin();
        alert("Cliente atualizado com sucesso.");
    } catch (erro) {
        alert("Erro: " + erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar alterações";
    }
}

async function carregarPedidosAdmin() {
    const area = document.getElementById("adminListaPedidos");
    area.innerHTML = '<p class="admin-carregando">Carregando pedidos...</p>';

    try {
        const resultado = await enviarParaGAS({
            acao: "listarPedidosAdmin",
            adminToken
        });
        adminPedidos = resultado.pedidos || [];
        renderizarPedidosAdmin();
    } catch (erro) {
        area.innerHTML = `<div class="admin-vazio">${erro.message}</div>`;
    }
}

function montarTabelaPedidosAdmin(pedidos, comAcao = true) {
    const linhas = pedidos.map(pedido => `
        <tr>
            <td>${pedido.NUMERO_PEDIDO || ""}</td>
            <td>${pedido.DATA_PEDIDO || ""}</td>
            <td>${pedido.NOME_CLIENTE || ""}</td>
            <td>${pedido.STATUS || ""}</td>
            <td>${formatarMoeda(moedaParaNumero(pedido.VALOR_TOTAL))}</td>
            ${comAcao ? `<td><button class="admin-btn-pequeno" onclick='abrirPedidoAdmin(${JSON.stringify(pedido.NUMERO_PEDIDO || "")})'>Abrir</button></td>` : ""}
        </tr>
    `).join("");

    return `<table class="admin-tabela">
        <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Status</th><th>Total</th>${comAcao ? "<th>Ação</th>" : ""}</tr></thead>
        <tbody>${linhas || `<tr><td colspan="${comAcao ? 6 : 5}">Nenhum pedido encontrado.</td></tr>`}</tbody>
    </table>`;
}

function renderizarPedidosAdmin() {
    const termo = document.getElementById("adminBuscaPedido").value.trim().toLowerCase();
    const status = document.getElementById("adminFiltroStatus").value.trim().toUpperCase();

    const filtrados = adminPedidos.filter(pedido => {
        const alvo = [
            pedido.NUMERO_PEDIDO, pedido.CPF_CLIENTE, pedido.NOME_CLIENTE
        ].join(" ").toLowerCase();
        return (!termo || termo.split(/\s+/).every(parte => alvo.includes(parte))) &&
               (!status || String(pedido.STATUS || "").toUpperCase() === status);
    });

    document.getElementById("adminListaPedidos").innerHTML =
        montarTabelaPedidosAdmin(filtrados, true);
}

async function abrirPedidoAdmin(numeroPedido) {
    const detalhe = document.getElementById("adminDetalhePedido");
    detalhe.innerHTML = '<div class="admin-vazio">Carregando pedido...</div>';

    try {
        const resultado = await enviarParaGAS({
            acao: "obterPedidoAdmin",
            adminToken,
            numeroPedido
        });

        adminPedidoSelecionado = resultado.pedido;
        const itens = resultado.itens || [];
        renderizarDetalhePedidoAdmin(adminPedidoSelecionado, itens);
    } catch (erro) {
        detalhe.innerHTML = `<div class="admin-vazio">${erro.message}</div>`;
    }
}

function renderizarDetalhePedidoAdmin(pedido, itens) {
    const opcoes = [
        "NOVO","ABERTO","EM ABERTO","EM SEPARAÇÃO",
        "PRONTO","EM TRANSPORTE","ENTREGUE","CANCELADO"
    ];

    const linhas = itens.map(item => `
        <tr>
            <td>${item.TIPO_ITEM || "ORIGINAL"}</td>
            <td>${item.CODIGO_PRODUTO || ""}</td>
            <td>${item.DESCRICAO || ""}</td>
            <td>${item.QUANTIDADE || 0}</td>
            <td>${formatarMoeda(moedaParaNumero(item.SUBTOTAL))}</td>
        </tr>
    `).join("");

    document.getElementById("adminDetalhePedido").innerHTML = `
        <div class="admin-detalhe-cabecalho">
            <div>
                <h4>${pedido.NUMERO_PEDIDO || ""}</h4>
                <div class="admin-detalhe-info">${pedido.NOME_CLIENTE || ""} • CPF ${formatarCpf(pedido.CPF_CLIENTE || "")}</div>
                <div class="admin-detalhe-info">${pedido.DATA_PEDIDO || ""} • ${formatarMoeda(moedaParaNumero(pedido.VALOR_TOTAL))}</div>
            </div>
        </div>

        <div class="admin-status-area">
            <label for="adminStatusPedido"><strong>Status</strong></label>
            <select id="adminStatusPedido" class="admin-status-select">
                ${opcoes.map(status => `<option ${status === String(pedido.STATUS || "").toUpperCase() ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <button class="admin-btn-pequeno" onclick="salvarStatusPedidoAdmin()">Salvar status</button>
        </div>

        <div style="overflow:auto;">
            <table class="admin-tabela">
                <thead><tr><th>Tipo</th><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Subtotal</th></tr></thead>
                <tbody>${linhas || '<tr><td colspan="5">Nenhum item.</td></tr>'}</tbody>
            </table>
        </div>

        <div style="margin-top:14px;padding:12px;background:#f8fafc;border-radius:10px;">
            <strong>Observação:</strong> ${pedido.OBSERVACAO || "SEM OBSERVAÇÃO"}
        </div>
    `;
}

async function salvarStatusPedidoAdmin() {
    if (!adminPedidoSelecionado) return;
    const status = document.getElementById("adminStatusPedido").value;

    try {
        await enviarParaGAS({
            acao: "atualizarStatusPedidoAdmin",
            adminToken,
            numeroPedido: adminPedidoSelecionado.NUMERO_PEDIDO,
            status
        });

        adminPedidoSelecionado.STATUS = status;
        await carregarPedidosAdmin();
        renderizarDetalhePedidoAdmin(adminPedidoSelecionado, []);
        await abrirPedidoAdmin(adminPedidoSelecionado.NUMERO_PEDIDO);
        alert("Status atualizado com sucesso.");
    } catch (erro) {
        alert("Erro: " + erro.message);
    }
}

function escaparHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

document.addEventListener("keydown", tentarAbrirAdminPorDigitacao);
document.getElementById("adminBuscaCliente").addEventListener("input", renderizarClientesAdmin);
document.getElementById("adminBuscaPedido").addEventListener("input", renderizarPedidosAdmin);
document.getElementById("adminFiltroStatus").addEventListener("change", renderizarPedidosAdmin);


const gatilhoAdminMobile = document.getElementById("gatilhoAdminMobile");
gatilhoAdminMobile.addEventListener("click", registrarToqueAdminMobile);
gatilhoAdminMobile.addEventListener("touchend", event => {
    event.preventDefault();
    registrarToqueAdminMobile();
}, { passive: false });

document.getElementById("senhaAdminMobile").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        confirmarAcessoAdminMobile();
    }
});
