"use strict";

const GATILHO_OCULTO_ADMIN = "1516";

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
    const usuario = document.getElementById("usuarioAdminMobile");
    const senha = document.getElementById("senhaAdminMobile");
    const mensagem = document.getElementById("mensagemAdminMobile");

    usuario.value = "";
    senha.value = "";
    mensagem.textContent = "";
    mensagem.className = "mensagem-cliente";
    modal.classList.add("modal-ativo");

    setTimeout(() => usuario.focus(), 100);
}

function fecharAcessoAdminMobile() {
    document.getElementById("modalAcessoAdminMobile").classList.remove("modal-ativo");
    document.getElementById("usuarioAdminMobile").value = "";
    document.getElementById("senhaAdminMobile").value = "";
}

async function confirmarAcessoAdminMobile() {
    const campoUsuario = document.getElementById("usuarioAdminMobile");
    const campoSenha = document.getElementById("senhaAdminMobile");
    const botao = document.getElementById("btnEntrarAdminMobile");
    const mensagem = document.getElementById("mensagemAdminMobile");
    const usuario = campoUsuario.value.trim();
    const senha = campoSenha.value;

    mensagem.textContent = "";
    mensagem.className = "mensagem-cliente";

    if (!usuario || !senha) {
        mensagem.textContent = "Digite o usuário e a senha.";
        mensagem.classList.add("erro");
        (!usuario ? campoUsuario : campoSenha).focus();
        return;
    }

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        await autenticarAdministrador(usuario, senha);
        fecharAcessoAdminMobile();
    } catch (erro) {
        mensagem.textContent = erro.message || "Acesso negado.";
        mensagem.classList.add("erro");
        campoSenha.select();
    } finally {
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
}



let timerManterSessaoAdmin = null;

function iniciarManutencaoSessaoAdmin() {
    pararManutencaoSessaoAdmin();

    timerManterSessaoAdmin = setInterval(async () => {
        if (!adminToken) return;

        try {
            await enviarParaGAS({
                acao: "validarAdmin",
                adminToken
            });
        } catch (erro) {
            console.error("Não foi possível renovar a sessão administrativa:", erro);
        }
    }, 2 * 60 * 1000);
}

function pararManutencaoSessaoAdmin() {
    if (timerManterSessaoAdmin) {
        clearInterval(timerManterSessaoAdmin);
        timerManterSessaoAdmin = null;
    }
}

async function tentarAbrirAdminPorDigitacao(evento) {
    const moduloAdmin = document.getElementById("moduloAdministrativo");

    if (moduloAdmin && moduloAdmin.style.display === "block") return;
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return;

    const alvo = evento.target;
    const digitandoEmCampo = alvo && (
        alvo.tagName === "INPUT" ||
        alvo.tagName === "TEXTAREA" ||
        alvo.tagName === "SELECT" ||
        alvo.isContentEditable
    );

    /*
      O gatilho 1516 é ignorado durante preenchimento de CPF,
      telefone, CEP, pesquisa, quantidade ou qualquer outro campo.
    */
    if (digitandoEmCampo) {
        adminDigitacaoOculta = "";
        return;
    }

    if (evento.key.length === 1) {
        adminDigitacaoOculta =
            (adminDigitacaoOculta + evento.key).slice(-GATILHO_OCULTO_ADMIN.length);
    }

    if (adminDigitacaoOculta === GATILHO_OCULTO_ADMIN) {
        adminDigitacaoOculta = "";
        abrirAcessoAdminMobile();
    }
}

async function autenticarAdministrador(usuario, senha) {
    try {
        const resultado = await enviarParaGAS({
            acao: "autenticarAdmin",
            usuario,
            senha
        });

        adminToken = resultado.adminToken || "";
        adminUsuario = resultado.usuario || null;

        if (!adminToken || !adminUsuario) {
            throw new Error("Não foi possível iniciar a sessão administrativa.");
        }

        sessionStorage.setItem("siclar_admin_token", adminToken);
        sessionStorage.setItem("siclar_admin_usuario", JSON.stringify(adminUsuario));
        await abrirPainelAdministrativoAutenticado();
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
        const resultado = await enviarParaGAS({
            acao: "validarAdmin",
            adminToken: salvo
        });
        adminToken = salvo;
        adminUsuario = resultado.usuario || JSON.parse(
            sessionStorage.getItem("siclar_admin_usuario") || "null"
        );
        if (!adminUsuario) throw new Error("Usuário da sessão não encontrado.");
        sessionStorage.setItem("siclar_admin_usuario", JSON.stringify(adminUsuario));
        return true;
    } catch {
        sessionStorage.removeItem("siclar_admin_token");
        sessionStorage.removeItem("siclar_admin_usuario");
        adminUsuario = null;
        return false;
    }
}

function usuarioAdminTemAcessoTotal() {
    return adminUsuario && String(adminUsuario.perfil || "").toUpperCase() === "TOTAL";
}

function aplicarPermissoesVisuaisAdmin() {
    const total = usuarioAdminTemAcessoTotal();

    document.querySelectorAll('[data-admin-permissao="admin"]').forEach(elemento => {
        elemento.style.display = total ? "" : "none";
    });

    const nome = document.getElementById("adminUsuarioNome");
    if (nome && adminUsuario) {
        nome.textContent = `${adminUsuario.nome} — ${
            total ? "Acesso total" : `Vendedor ${adminUsuario.vendedor}`
        }`;
    }
}

async function abrirPainelAdministrativoAutenticado() {
    if (!adminToken) {
        const valido = await validarSessaoAdminSalva();
        if (!valido) return false;
    }

    if (typeof pararCarrossel === "function") {
        pararCarrossel();
    }

    /*
      Fecha qualquer tela pública que possa estar visível.
      A tela de apresentação foi acrescentada depois e precisa ser
      escondida também; caso contrário ela fica por cima do painel.
    */
    [
        "telaApresentacao",
        "moduloCarrossel",
        "moduloPedidos",
        "moduloHistoricoPedidos"
    ].forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = "none";
    });

    const telaCliente = document.getElementById("telaCadastroCliente");
    if (telaCliente) {
        telaCliente.classList.remove("ativa");
        telaCliente.style.display = "";
    }

    const moduloAdmin = document.getElementById("moduloAdministrativo");
    if (!moduloAdmin) {
        throw new Error("A tela administrativa não foi encontrada.");
    }

    moduloAdmin.style.display = "block";

    const statusSessao = document.getElementById("adminSessaoStatus");
    if (statusSessao) {
        statusSessao.textContent =
            "Sessão ativa por até 6 horas e renovada automaticamente";
    }

    aplicarPermissoesVisuaisAdmin();
    iniciarManutencaoSessaoAdmin();

    /*
      Usuário com acesso total entra diretamente no controle de estoque.
      Usuário restrito continua indo para Pedidos.
    */
    abrirAbaAdmin(
        usuarioAdminTemAcessoTotal()
            ? "produtos"
            : "pedidos"
    );

    window.scrollTo({ top: 0, behavior: "auto" });
    return true;
}

function sairAdministrativo() {
    pararManutencaoSessaoAdmin();
    adminToken = "";
    adminUsuario = null;
    sessionStorage.removeItem("siclar_admin_token");
    sessionStorage.removeItem("siclar_admin_usuario");
    document.getElementById("moduloAdministrativo").style.display = "none";
    document.getElementById("moduloCarrossel").style.display = "flex";
    iniciarCarrossel();
}

function abrirAbaAdmin(nome) {
    if (!usuarioAdminTemAcessoTotal() && ["resumo", "produtos"].includes(nome)) {
        nome = "pedidos";
    }
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
            cliente.CODIGO_CLIENTE, cliente.CPF, cliente.NOME_COMPLETO, cliente.TELEFONE,
            cliente.EMAIL, cliente.CIDADE, cliente.STATUS
        ].join(" ").toLowerCase();
        return termo.split(/\s+/).filter(Boolean).every(parte => alvo.includes(parte));
    });

    const linhas = filtrados.map(cliente => `
        <tr>
            <td><strong>${cliente.CODIGO_CLIENTE || ""}</strong></td>
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
            <thead><tr><th>Código</th><th>CPF</th><th>Nome</th><th>Telefone</th><th>Cidade</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>${linhas || '<tr><td colspan="7">Nenhum cliente encontrado.</td></tr>'}</tbody>
        </table>
    `;
}

function abrirClienteAdmin(cpf) {
    adminClienteEmEdicao = adminClientes.find(
        cliente => somenteNumeros(cliente.CPF) === somenteNumeros(cpf)
    );
    if (!adminClienteEmEdicao) return;

    const campos = [
        "CODIGO_CLIENTE","CPF","NOME_COMPLETO","TELEFONE","EMAIL","CEP","ENDERECO","NUMERO",
        "BAIRRO","CIDADE","UF","PONTO DE REFERENCIA","OBSERVAÇÕES","STATUS"
    ];

    document.getElementById("adminClienteCpfInfo").textContent =
        `Código ${adminClienteEmEdicao.CODIGO_CLIENTE || "—"} • CPF ${formatarCpf(adminClienteEmEdicao.CPF || "")}`;

    document.getElementById("adminCamposCliente").innerHTML = campos.map(campo => {
        const readonly = campo === "CPF" || (campo === "CODIGO_CLIENTE" && !usuarioAdminTemAcessoTotal())
            ? "readonly"
            : "";
        const valor = adminClienteEmEdicao[campo] || "";
        const dica = campo === "CODIGO_CLIENTE" && usuarioAdminTemAcessoTotal()
            ? '<small style="display:block;margin-top:4px;color:#64748b;">Usuário TOTAL pode alterar este código. O número 1 é reservado para CONSUMIDOR.</small>'
            : "";
        return `<div class="grupo-campo-edicao">
            <label>${campo === "CODIGO_CLIENTE" ? "CÓDIGO DO CLIENTE" : campo}</label>
            <input type="text" data-admin-cliente-campo="${campo}" value="${escaparHtml(valor)}" ${readonly}>
            ${dica}
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

    const codigoOriginal = somenteNumeros(adminClienteEmEdicao.CODIGO_CLIENTE || "");
    const codigoNovo = somenteNumeros(dadosCliente.CODIGO_CLIENTE || "");

    if (!codigoNovo || codigoNovo === "1" || codigoNovo.length > 10) {
        alert('Informe um código de cliente válido. O código "1" é reservado para CONSUMIDOR.');
        return;
    }

    if (codigoNovo !== codigoOriginal) {
        if (!usuarioAdminTemAcessoTotal()) {
            alert("Seu usuário não possui permissão para alterar o código do cliente.");
            return;
        }

        const confirmou = confirm(
            `Deseja alterar o código do cliente de ${codigoOriginal} para ${codigoNovo}?`
        );

        if (!confirmou) return;
    }

    const botao = document.getElementById("btnSalvarAdminCliente");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        await enviarParaGAS({
            acao: "atualizarClienteAdmin",
            adminToken,
            codigoOriginal,
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
            <td>${pedido.VENDEDOR || ""}</td>
            <td>${pedido.STATUS || ""}</td>
            <td>${formatarMoeda(moedaParaNumero(pedido.VALOR_TOTAL))}</td>
            ${comAcao ? `<td><button class="admin-btn-pequeno" onclick='abrirPedidoAdmin(${JSON.stringify(pedido.NUMERO_PEDIDO || "")})'>Abrir</button></td>` : ""}
        </tr>
    `).join("");

    return `<table class="admin-tabela">
        <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Total</th>${comAcao ? "<th>Ação</th>" : ""}</tr></thead>
        <tbody>${linhas || `<tr><td colspan="${comAcao ? 7 : 6}">Nenhum pedido encontrado.</td></tr>`}</tbody>
    </table>`;
}

function renderizarPedidosAdmin() {
    const termo = document.getElementById("adminBuscaPedido").value.trim().toLowerCase();
    const status = document.getElementById("adminFiltroStatus").value.trim().toUpperCase();

    const filtrados = adminPedidos.filter(pedido => {
        const alvo = [
            pedido.NUMERO_PEDIDO, pedido.CPF_CLIENTE, pedido.NOME_CLIENTE, pedido.VENDEDOR
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
                <div class="admin-detalhe-info"><strong>Vendedor:</strong> ${pedido.VENDEDOR || "NÃO INFORMADO"}</div>
            </div>
        </div>

        <div class="admin-status-area">
            <label for="adminStatusPedido"><strong>Status</strong></label>
            <select id="adminStatusPedido" class="admin-status-select">
                ${opcoes.map(status => `<option ${status === String(pedido.STATUS || "").toUpperCase() ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <button class="admin-btn-pequeno" onclick="salvarStatusPedidoAdmin()">Salvar status</button>
            ${usuarioAdminTemAcessoTotal() ? `
                <button
                    class="admin-btn-pequeno"
                    style="background:#b91c1c;color:#fff;margin-left:8px;"
                    onclick="excluirPedidoAdmin()"
                >Excluir pedido</button>
            ` : ""}
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


async function excluirPedidoAdmin() {
    if (!adminPedidoSelecionado) return;

    if (!usuarioAdminTemAcessoTotal()) {
        alert("Seu usuário não possui permissão para excluir pedidos.");
        return;
    }

    const numeroPedido = adminPedidoSelecionado.NUMERO_PEDIDO || "";

    const confirmou = confirm(
        `ATENÇÃO: deseja excluir definitivamente o pedido ${numeroPedido}?\n\n` +
        "O pedido e todos os seus itens serão apagados. Esta operação não pode ser desfeita."
    );

    if (!confirmou) return;

    try {
        const resultado = await enviarParaGAS({
            acao: "excluirPedidoAdmin",
            adminToken,
            numeroPedido
        });

        adminPedidoSelecionado = null;

        document.getElementById("adminDetalhePedido").innerHTML =
            '<div class="admin-vazio">Selecione um pedido.</div>';

        await carregarPedidosAdmin();

        if (usuarioAdminTemAcessoTotal()) {
            try {
                await carregarResumoAdmin();
            } catch (ignorar) {}
        }

        alert(resultado.mensagem || "Pedido excluído com sucesso.");
    } catch (erro) {
        alert("Erro ao excluir pedido: " + erro.message);
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


document.addEventListener("keydown", evento => {
    const modal = document.getElementById("modalAcessoAdminMobile");
    if (
        evento.key === "Enter" &&
        modal &&
        modal.classList.contains("modal-ativo")
    ) {
        confirmarAcessoAdminMobile();
    }
});
