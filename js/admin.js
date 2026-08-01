"use strict";

const CHAVE_RASCUNHO_PRODUTO_ADMIN = "siclar_rascunho_produto_admin";


const CHAVE_PROGRESSO_IMPORTACAO_LOCAL = "siclar_progresso_importacao_csv";
let importacaoArquivoAtual = null;
let importacaoIdAtual = "";
let importacaoIndiceInicial = 0;
let importacaoContadoresIniciais = {
    novos: 0,
    atualizados: 0,
    semAlteracao: 0,
    erros: 0
};


const CHAVE_TEMPO_IMPORTACAO_LOCAL = "siclar_tempo_importacao_csv";

function formatarDuracaoImportacao(milissegundos) {
    if (!Number.isFinite(milissegundos) || milissegundos < 0) return "calculando...";
    const totalSegundos = Math.max(0, Math.round(milissegundos / 1000));
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    if (horas > 0) return `${horas}h ${String(minutos).padStart(2, "0")}min ${String(segundos).padStart(2, "0")}s`;
    if (minutos > 0) return `${minutos}min ${String(segundos).padStart(2, "0")}s`;
    return `${segundos}s`;
}

function carregarTempoAcumuladoImportacao(idImportacao) {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_TEMPO_IMPORTACAO_LOCAL) || "null");
        if (!salvo || salvo.idImportacao !== idImportacao) return 0;
        return Math.max(0, Number(salvo.tempoDecorridoMs || 0));
    } catch { return 0; }
}

function salvarTempoAcumuladoImportacao(idImportacao, tempoDecorridoMs) {
    localStorage.setItem(CHAVE_TEMPO_IMPORTACAO_LOCAL, JSON.stringify({
        idImportacao,
        tempoDecorridoMs: Math.max(0, Number(tempoDecorridoMs || 0)),
        atualizadoEm: new Date().toISOString()
    }));
}

function limparTempoAcumuladoImportacao() {
    localStorage.removeItem(CHAVE_TEMPO_IMPORTACAO_LOCAL);
}


function escaparCampoCsvRelatorio(valor) {
    const texto = String(valor == null ? "" : valor);

    if (/[",\r\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

function nomeArquivoRelatorioImportacao() {
    const data = new Date().toISOString().slice(0, 10);
    return `RELATORIO_IMPORTACAO_${data}.csv`;
}

function baixarRelatorioImportacao(relatorio) {
    if (!Array.isArray(relatorio) || !relatorio.length) {
        alert("A importação terminou, mas nenhum produto foi novo ou alterado.");
        return;
    }

    const cabecalhos = [
        "Item",
        "Código",
        "Descrição",
        "Tipo",
        "Campo alterado",
        "Valor anterior",
        "Valor novo",
        "Registrado em"
    ];

    const linhas = relatorio.map(item => [
        Number(item.indiceItem || 0) + 1,
        item.codigo || "",
        item.descricao || "",
        item.tipo || "",
        item.campo || "",
        item.valorAnterior || "",
        item.valorNovo || "",
        item.registradoEm || ""
    ]);

    const conteudo = [
        cabecalhos,
        ...linhas
    ]
        .map(linha => linha.map(escaparCampoCsvRelatorio).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + conteudo], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = nomeArquivoRelatorioImportacao();
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function obterEBaixarRelatorioImportacao() {
    const resultado = await enviarParaGAS({
        acao: "listarRelatorioImportacao",
        adminToken,
        idImportacao: importacaoIdAtual
    });

    const relatorio = Array.isArray(resultado.relatorio)
        ? resultado.relatorio
        : [];

    baixarRelatorioImportacao(relatorio);
    return relatorio;
}

async function gerarHashArquivoImportacao(arquivo) {
    const buffer = await arquivo.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function salvarProgressoImportacaoLocal(dados) {
    localStorage.setItem(CHAVE_PROGRESSO_IMPORTACAO_LOCAL, JSON.stringify(dados));
}

function limparProgressoImportacaoLocal() {
    localStorage.removeItem(CHAVE_PROGRESSO_IMPORTACAO_LOCAL);
}

async function consultarRetomadaImportacao() {
    if (!importacaoIdAtual || !importacaoArquivoAtual || !csvData.length) return;

    const resultado = await enviarParaGAS({
        acao: "consultarImportacao",
        adminToken,
        idImportacao: importacaoIdAtual,
        nomeArquivo: importacaoArquivoAtual.name,
        totalItens: csvData.length
    });

    const ultimoIndice = Number(resultado.ultimoIndice ?? -1);
    const status = String(resultado.status || "").toUpperCase();

    importacaoContadoresIniciais = {
        novos: Number(resultado.novos || 0),
        atualizados: Number(resultado.atualizados || 0),
        semAlteracao: Number(resultado.semAlteracao || 0),
        erros: Number(resultado.erros || 0)
    };

    if (status === "CONCLUIDA") {
        const reprocessar = confirm(
            `Este CSV já foi importado completamente (${csvData.length} itens).\n\n` +
            "Deseja processá-lo novamente desde o início?"
        );

        if (reprocessar) {
            await enviarParaGAS({
                acao: "reiniciarImportacao",
                adminToken,
                idImportacao: importacaoIdAtual,
                nomeArquivo: importacaoArquivoAtual.name,
                totalItens: csvData.length
            });
            importacaoIndiceInicial = 0;
            importacaoContadoresIniciais = { novos: 0, atualizados: 0, semAlteracao: 0, erros: 0 };
        } else {
            importacaoIndiceInicial = csvData.length;
            document.getElementById("btnProcess").disabled = true;
            document.getElementById("log").textContent =
                "Este arquivo já foi importado completamente.";
        }
        return;
    }

    if (ultimoIndice >= 0 && ultimoIndice < csvData.length - 1) {
        const continuar = confirm(
            `Importação anterior encontrada.\n\n` +
            `Concluídos: ${ultimoIndice + 1} de ${csvData.length}.\n` +
            `Próximo item: ${ultimoIndice + 2}.\n\n` +
            "Deseja continuar exatamente de onde parou?"
        );

        if (continuar) {
            importacaoIndiceInicial = ultimoIndice + 1;
            document.getElementById("log").textContent =
                `Retomada preparada no item ${importacaoIndiceInicial + 1} de ${csvData.length}.`;
        } else {
            await enviarParaGAS({
                acao: "reiniciarImportacao",
                adminToken,
                idImportacao: importacaoIdAtual,
                nomeArquivo: importacaoArquivoAtual.name,
                totalItens: csvData.length
            });
            importacaoIndiceInicial = 0;
            importacaoContadoresIniciais = { novos: 0, atualizados: 0, semAlteracao: 0, erros: 0 };
        }
    } else {
        importacaoIndiceInicial = Math.max(0, ultimoIndice + 1);
    }
}


function fechar() { document.getElementById('janela').classList.remove('modal-ativo'); }

function atualizarContadorSelecionados() {
    const selecionados = document.querySelectorAll('.chk-produto:checked').length;
    document.getElementById('contadorSelecionados').textContent = `${selecionados} produto(s) selecionado(s)`;
    document.getElementById('btnExcluirLote').disabled = selecionados === 0;
}

async function excluirSelecionados() {
    const codigosParaExcluir = [];

    document.querySelectorAll('.chk-produto:checked').forEach(chk => {
        codigosParaExcluir.push(String(chk.value));
    });

    if (codigosParaExcluir.length === 0) {
        alert("Selecione pelo menos um produto para excluir.");
        return;
    }

    if (!confirm(
        `Deseja excluir ${codigosParaExcluir.length} produto(s) de uma vez?\n` +
        `Os códigos serão enviados para a lista negra e não voltarão nas próximas importações.`
    )) return;

    const hCod = headers.find(h =>
        h.includes('Cód') || h.toLowerCase().includes('codigo')
    ) || headers[0];

    const hDesc = headers.find(h =>
        h.includes('Desc') || h.toLowerCase().includes('nome')
    ) || headers[1];

    const botaoExcluir = document.getElementById('btnExcluirLote');
    const textoOriginalBotao = botaoExcluir ? botaoExcluir.textContent : "";

    if (botaoExcluir) {
        botaoExcluir.disabled = true;
        botaoExcluir.textContent = "Excluindo...";
    }

    let excluidos = 0;
    const erros = [];

    try {
        for (const cod of codigosParaExcluir) {
            try {
                const produto = dadosGlobais.find(
                    item => String(item[hCod] || "") === String(cod)
                );

                await enviarParaGAS({
                    acao: "excluir",
                    codigo: cod,
                    descricao: produto ? String(produto[hDesc] || "") : "",
                    motivo: "EXCLUÍDO MANUALMENTE EM LOTE",
                    adminToken
                });

                excluidos++;
            } catch (erroItem) {
                console.error(`Erro ao excluir o código ${cod}:`, erroItem);
                erros.push(`${cod}: ${erroItem.message}`);
            }
        }

        const codigosExcluidosComSucesso = new Set(
            codigosParaExcluir.filter(cod =>
                !erros.some(erro => erro.startsWith(`${cod}:`))
            )
        );

        dadosGlobais = dadosGlobais.filter(
            item => !codigosExcluidosComSucesso.has(String(item[hCod] || ""))
        );

        renderizarTabela();

        if (erros.length === 0) {
            alert(
                `✅ ${excluidos} produto(s) excluído(s) e enviado(s) para a lista negra.`
            );
        } else {
            alert(
                `${excluidos} produto(s) excluído(s) com sucesso.\n` +
                `${erros.length} produto(s) apresentaram erro.\n\n` +
                erros.slice(0, 10).join("\n")
            );
        }
    } catch (erroGeral) {
        alert("Erro na exclusão em lote: " + erroGeral.message);
    } finally {
        if (botaoExcluir) {
            botaoExcluir.textContent = textoOriginalBotao || "🗑️ Excluir selecionados";
        }
        atualizarContadorSelecionados();
    }
}

function renderizarTabela() {
    const fCod = document.getElementById('pesqCodigo').value.toLowerCase(); 
    const fNome = document.getElementById('pesqNome').value.toLowerCase(); 
    const fMarca = document.getElementById('pesqMarca').value.toLowerCase();
    const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
    const hDesc = headers.find(h => h.includes('Desc') || h.includes('nome')) || headers[1];
    const hMarca = headers.find(h => h.includes('Marca')) || headers[2];
    const hPreco = headers.find(h => h.includes('Preço') || h.includes('venda')) || headers[3];
    const hFoto = headers.find(h => h.includes('Foto') || h.includes('imagem')) || '';

    listaFiltradaAtual = dadosGlobais.filter(p => {
        return String(p[hCod]||'').toLowerCase().includes(fCod) &&
               String(p[hDesc]||'').toLowerCase().includes(fNome) &&
               String(p[hMarca]||'').toLowerCase().includes(fMarca);
    });

    document.getElementById('infoQtd').textContent = `${listaFiltradaAtual.length} de ${dadosGlobais.length} registros`;

    let html = `<table class="tabela-produtos"><thead><tr>
        <th><input type="checkbox" id="selecionarTodos" onchange="document.querySelectorAll('.chk-produto').forEach(c=>c.checked=this.checked); atualizarContadorSelecionados()"></th>
        <th>Código</th><th>Descrição</th><th>Marca</th><th>Preço</th><th>Foto</th><th>Ações</th>
    </tr></thead><tbody>`;

    listaFiltradaAtual.forEach(p => {
        let foto = hFoto && p[hFoto] && p[hFoto].toUpperCase() !== 'NÃO' 
            ? `<img src="${resolverUrlImagem(p[hFoto])}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` 
            : '<span style="color:#94a3b8">—</span>';

        html += `<tr>
            <td><input type="checkbox" class="chk-produto" value="${p[hCod]}" onchange="atualizarContadorSelecionados()"></td>
            <td>${p[hCod]}</td>
            <td>${p[hDesc]}</td>
            <td>${p[hMarca]}</td>
            <td class="preco">${p[hPreco]}</td>
            <td>${foto}</td>
            <td>
                <div class="area-botoes-acao">
                    <button class="btn btn-editar-acao" onclick="editarRegistroPorCodigo('${p[hCod]}')">Editar</button>
                    <button class="btn btn-excluir" onclick="confirmarExclusao('${p[hCod]}', '${(p[hDesc]||'').replace(/'/g, "\\'")}')">Excluir</button>
                </div>
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('areaLista').innerHTML = html;
    atualizarContadorSelecionados();
}

async function confirmarExclusao(cod, desc) {
    if (!confirm(`Excluir produto?\nCód: ${cod}\n${desc}`)) return;
    try {
        await enviarParaGAS({
            acao: "excluir",
            codigo: cod,
            descricao: desc,
            motivo: "EXCLUÍDO MANUALMENTE",
            adminToken
        });
        const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
        dadosGlobais = dadosGlobais.filter(i => String(i[hCod]) !== String(cod));
        renderizarTabela();
        alert("Produto excluído e código incluído na lista negra.");
    } catch(e) { alert("Erro: " + e.message); }
}

function editarRegistroPorCodigo(cod) {
    const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
    indiceEdicaoAtual = listaFiltradaAtual.findIndex(i => String(i[hCod]) === String(cod));
    if (indiceEdicaoAtual !== -1) {
        preencherFormularioEdicao(listaFiltradaAtual[indiceEdicaoAtual]);
        document.getElementById('modalEdicaoFundo').classList.add('modal-ativo');
    }
}

function preencherFormularioEdicao(prod) {
    const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
    document.getElementById('infoProgressoEdicao').textContent = `Item ${indiceEdicaoAtual+1} de ${listaFiltradaAtual.length}`;
    let html = '';
    headers.forEach(h => {
        html += `<div class="grupo-campo-edicao">
            <label>${h}</label>
            <input type="text" id="campo_${h.replace(/\W/g,'_')}" value="${prod[h]||''}" ${h===hCod?'readonly style="background:#eee"':''}>
        </div>`;
    });
    document.getElementById('containerCamposEdicao').innerHTML = html;
}

function fecharModalEdicao() {
    document.getElementById('modalEdicaoFundo').classList.remove('modal-ativo');
}

function salvarRascunhoProdutoAdmin() {
    const produto = {};
    let possuiCampo = false;

    headers.forEach(cabecalho => {
        const campo = document.getElementById(`campo_${cabecalho.replace(/\W/g, '_')}`);
        if (!campo) return;
        produto[cabecalho] = campo.value;
        possuiCampo = true;
    });

    if (possuiCampo) {
        sessionStorage.setItem(CHAVE_RASCUNHO_PRODUTO_ADMIN, JSON.stringify({
            indice: indiceEdicaoAtual,
            produto,
            salvoEm: Date.now()
        }));
    }
}

function limparRascunhoProdutoAdmin() {
    sessionStorage.removeItem(CHAVE_RASCUNHO_PRODUTO_ADMIN);
}

function coletarDadosFormularioProduto() {
    const produto = {};

    headers.forEach(cabecalho => {
        const campo = document.getElementById(`campo_${cabecalho.replace(/\W/g, '_')}`);
        produto[cabecalho] = campo ? campo.value : '';
    });

    return produto;
}

async function gravarProdutoEditado(produto) {
    const resultado = await enviarParaGAS({
        acao: "editar",
        dadosProduto: produto,
        adminToken
    });

    if (resultado.erro) {
        throw new Error(resultado.erro);
    }

    const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
    const indiceGlobal = dadosGlobais.findIndex(
        item => String(item[hCod]) === String(produto[hCod])
    );

    if (indiceGlobal !== -1) {
        dadosGlobais[indiceGlobal] = produto;
    }

    const indiceFiltrado = listaFiltradaAtual.findIndex(
        item => String(item[hCod]) === String(produto[hCod])
    );

    if (indiceFiltrado !== -1) {
        listaFiltradaAtual[indiceFiltrado] = produto;
    }

    renderizarTabela();
    return resultado;
}

async function salvarProdutoSemAvancar() {
    const botao = document.getElementById('btnSalvarProduto');
    const produto = coletarDadosFormularioProduto();

    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
        await gravarProdutoEditado(produto);
        limparRascunhoProdutoAdmin();
        fecharModalEdicao();
        alert('Produto salvo com sucesso!');
    } catch (erro) {
        alert('Erro: ' + erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = '💾 Salvar';
    }
}

async function salvarEProximoProduto() {
    const botao = document.getElementById('btnSalvarEProximo');
    const produto = coletarDadosFormularioProduto();

    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
        await gravarProdutoEditado(produto);
        limparRascunhoProdutoAdmin();

        indiceEdicaoAtual++;

        if (indiceEdicaoAtual < listaFiltradaAtual.length) {
            preencherFormularioEdicao(listaFiltradaAtual[indiceEdicaoAtual]);
        } else {
            fecharModalEdicao();
            alert('Todos os itens revisados!');
        }
    } catch (erro) {
        alert('Erro: ' + erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = '💾 Salvar e Próximo';
    }
}

let listaNegraAtual = [];

function fecharListaNegraProdutos() {
    const modal = document.getElementById("modalListaNegraProdutos");
    if (modal) modal.classList.remove("modal-ativo");
}

async function abrirListaNegraProdutos() {
    const modal = document.getElementById("modalListaNegraProdutos");
    const area = document.getElementById("areaListaNegraProdutos");

    if (!modal || !area) return;

    modal.classList.add("modal-ativo");
    area.innerHTML = '<p class="admin-carregando">Carregando lista negra...</p>';

    try {
        const resultado = await enviarParaGAS({
            acao: "listarListaNegra",
            adminToken
        });

        listaNegraAtual = Array.isArray(resultado.itens) ? resultado.itens : [];
        renderizarListaNegraProdutos();
    } catch (erro) {
        area.innerHTML = `<p style="padding:20px;color:#dc2626;text-align:center;">${erro.message}</p>`;
    }
}

function renderizarListaNegraProdutos() {
    const area = document.getElementById("areaListaNegraProdutos");
    const busca = String(document.getElementById("buscaListaNegraProdutos")?.value || "")
        .trim()
        .toLowerCase();

    const filtrados = listaNegraAtual.filter(item => {
        const alvo = [item.codigo, item.descricao, item.motivo]
            .join(" ")
            .toLowerCase();
        return !busca || alvo.includes(busca);
    });

    if (!filtrados.length) {
        area.innerHTML = '<div class="admin-vazio">Nenhum código bloqueado.</div>';
        return;
    }

    area.innerHTML = `
        <div class="admin-tabela-wrap">
            <table class="admin-tabela">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Motivo</th>
                        <th>Bloqueado em</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtrados.map(item => `
                        <tr>
                            <td><strong>${item.codigo || ""}</strong></td>
                            <td>${item.descricao || ""}</td>
                            <td>${item.motivo || ""}</td>
                            <td>${item.bloqueadoEm || ""}</td>
                            <td>
                                <button
                                    type="button"
                                    class="admin-btn-pequeno"
                                    onclick='autorizarCodigoListaNegra(${JSON.stringify(String(item.codigo || ""))})'
                                >Autorizar novamente</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function autorizarCodigoListaNegra(codigo) {
    if (!confirm(
        `Autorizar novamente o código ${codigo}?\n\n` +
        "Ele poderá retornar na próxima importação do CSV."
    )) return;

    try {
        await enviarParaGAS({
            acao: "removerListaNegra",
            codigo,
            adminToken
        });

        listaNegraAtual = listaNegraAtual.filter(
            item => String(item.codigo) !== String(codigo)
        );
        renderizarListaNegraProdutos();
        alert(`Código ${codigo} autorizado novamente.`);
    } catch (erro) {
        alert("Erro ao autorizar o código: " + erro.message);
    }
}

document.getElementById("btnAbrir").addEventListener("click", () => {
    document.getElementById("janela").classList.add("modal-ativo");
});

function detectarSeparadorCSV(texto) {
    const primeiraLinha = String(texto || "").replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)[0] || "";
    let dentroAspas = false;
    let virgulas = 0;
    let pontosVirgula = 0;

    for (let i = 0; i < primeiraLinha.length; i++) {
        const caractere = primeiraLinha[i];

        if (caractere === '"') {
            if (dentroAspas && primeiraLinha[i + 1] === '"') {
                i++;
            } else {
                dentroAspas = !dentroAspas;
            }
        } else if (!dentroAspas) {
            if (caractere === ',') virgulas++;
            if (caractere === ';') pontosVirgula++;
        }
    }

    return pontosVirgula > virgulas ? ';' : ',';
}

function analisarCSVCompleto(texto, separador) {
    const linhas = [];
    let linha = [];
    let campo = '';
    let dentroAspas = false;
    const conteudo = String(texto || '').replace(/^\uFEFF/, '');

    for (let i = 0; i < conteudo.length; i++) {
        const caractere = conteudo[i];

        if (caractere === '"') {
            if (dentroAspas && conteudo[i + 1] === '"') {
                campo += '"';
                i++;
            } else {
                dentroAspas = !dentroAspas;
            }
            continue;
        }

        if (caractere === separador && !dentroAspas) {
            linha.push(campo);
            campo = '';
            continue;
        }

        if ((caractere === '\n' || caractere === '\r') && !dentroAspas) {
            if (caractere === '\r' && conteudo[i + 1] === '\n') i++;
            linha.push(campo);
            campo = '';

            if (linha.some(valor => String(valor).trim() !== '')) {
                linhas.push(linha);
            }

            linha = [];
            continue;
        }

        campo += caractere;
    }

    linha.push(campo);
    if (linha.some(valor => String(valor).trim() !== '')) {
        linhas.push(linha);
    }

    return linhas;
}

function normalizarCabecalhoCSV(valor) {
    return String(valor || '')
        .replace(/^\uFEFF/, '')
        .replace(/\u00A0/g, ' ')
        .trim();
}

function localizarCabecalhoCodigo(listaCabecalhos) {
    const normalizar = valor => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    return listaCabecalhos.find(cabecalho => {
        const chave = normalizar(cabecalho);
        return chave === 'codigo' || chave === 'cod' || chave.startsWith('codigo ');
    }) || '';
}

document.getElementById("csvFile").addEventListener("change", event => {
    const file = event.target.files[0];
    const botaoProcessar = document.getElementById("btnProcess");
    const log = document.getElementById("log");
    log.style.whiteSpace = "pre-line";

    csvData = [];
    headers = [];
    importacaoArquivoAtual = file || null;
    importacaoIdAtual = "";
    importacaoIndiceInicial = 0;
    importacaoContadoresIniciais = { novos: 0, atualizados: 0, semAlteracao: 0, erros: 0 };
    botaoProcessar.disabled = true;

    if (!file) return;

    document.getElementById("fileName").textContent = file.name;
    log.textContent = "Lendo, conferindo e identificando o CSV...";

    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");

    reader.onerror = () => {
        log.textContent = "Não foi possível ler o arquivo CSV.";
        alert("Não foi possível ler o arquivo CSV.");
    };

    reader.onload = async loadEvent => {
        try {
            const texto = String(loadEvent.target.result || '');
            const separador = detectarSeparadorCSV(texto);
            const linhas = analisarCSVCompleto(texto, separador);

            if (linhas.length < 2) {
                throw new Error("O CSV não possui registros para importar.");
            }

            headers = linhas[0].map(normalizarCabecalhoCSV);
            const cabecalhoCodigo = localizarCabecalhoCodigo(headers);

            if (!cabecalhoCodigo) {
                throw new Error(
                    `A coluna Código não foi encontrada. Cabeçalhos lidos: ${headers.join(' | ')}`
                );
            }

            const linhasInvalidas = [];

            for (let index = 1; index < linhas.length; index++) {
                const valores = linhas[index];
                const item = {};

                headers.forEach((header, valueIndex) => {
                    item[header] = String(valores[valueIndex] ?? '')
                        .replace(/\u00A0/g, ' ')
                        .trim();
                });

                const codigo = String(item[cabecalhoCodigo] || '').trim();

                if (!codigo) {
                    linhasInvalidas.push(index + 1);
                    continue;
                }

                csvData.push(item);
            }

            if (!csvData.length) {
                throw new Error("Nenhum registro com Código válido foi encontrado no CSV.");
            }

            importacaoIdAtual = await gerarHashArquivoImportacao(file);
            botaoProcessar.disabled = false;

            log.textContent = linhasInvalidas.length
                ? `${csvData.length} linhas válidas. ${linhasInvalidas.length} linha(s) sem código ignoradas.`
                : `${csvData.length} linhas carregadas. Verificando possível retomada...`;

            await consultarRetomadaImportacao();
        } catch (erro) {
            console.error("Erro ao analisar CSV:", erro);
            csvData = [];
            headers = [];
            importacaoIdAtual = "";
            botaoProcessar.disabled = true;
            log.textContent = erro.message;
            alert("Erro no CSV: " + erro.message);
        }
    };
});

const TAMANHO_LOTE_IMPORTACAO = 25;

document.getElementById("btnProcess").addEventListener("click", async () => {
    const btnProcess = document.getElementById("btnProcess");
    const csvFile = document.getElementById("csvFile");
    const btnCancelar = document.getElementById("btnCancelar");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const log = document.getElementById("log");

    if (!importacaoIdAtual || !importacaoArquivoAtual || !csvData.length) {
        alert("Selecione novamente o arquivo CSV.");
        return;
    }

    if (importacaoIndiceInicial >= csvData.length) {
        alert("Este arquivo já foi importado completamente.");
        return;
    }

    importacaoCancelada = false;
    btnProcess.disabled = true;
    csvFile.disabled = true;
    btnCancelar.disabled = false;
    btnCancelar.style.display = "inline-block";
    progressContainer.style.display = "block";

    let novos = importacaoContadoresIniciais.novos;
    let atualizados = importacaoContadoresIniciais.atualizados;
    let semAlteracao = importacaoContadoresIniciais.semAlteracao;
    let erros = importacaoContadoresIniciais.erros;
    let falhaFatal = null;

    const inicioExecucaoMs = Date.now();
    const indiceInicioExecucao = importacaoIndiceInicial;
    const tempoAcumuladoAnteriorMs =
        carregarTempoAcumuladoImportacao(importacaoIdAtual);

    const percentualInicial = Math.round(
        (importacaoIndiceInicial / csvData.length) * 100
    );

    progressBar.style.width = `${percentualInicial}%`;
    progressBar.textContent = `${percentualInicial}%`;

    for (
        let inicioLote = importacaoIndiceInicial;
        inicioLote < csvData.length;
        inicioLote += TAMANHO_LOTE_IMPORTACAO
    ) {
        if (importacaoCancelada) break;

        const fimLote = Math.min(
            inicioLote + TAMANHO_LOTE_IMPORTACAO,
            csvData.length
        );

        const itensLote = csvData
            .slice(inicioLote, fimLote)
            .map(data => ({ data }));

        log.textContent =
            `Enviando lote ${inicioLote + 1} a ${fimLote} de ${csvData.length}...`;

        let resultadoLote;

        try {
            resultadoLote = await enviarParaGAS({
                acao: "importarLote",
                adminToken,
                headers,
                idImportacao: importacaoIdAtual,
                nomeArquivo: importacaoArquivoAtual.name,
                indiceInicial: inicioLote,
                totalItens: csvData.length,
                items: itensLote
            });
        } catch (erroLote) {
            falhaFatal = erroLote;
            console.error(
                `Falha no lote ${inicioLote + 1} a ${fimLote}:`,
                erroLote
            );

            log.textContent =
                `Falha ao processar o lote ${inicioLote + 1} a ${fimLote}: ` +
                `${erroLote.message}. O ponto anterior foi preservado.`;

            break;
        }

        const ultimoIndiceConfirmado = Number(
            resultadoLote.ultimoIndice ?? (fimLote - 1)
        );

        importacaoIndiceInicial = Math.min(
            ultimoIndiceConfirmado + 1,
            csvData.length
        );

        novos = Number(resultadoLote.acumuladoNovos ?? novos);
        atualizados = Number(
            resultadoLote.acumuladoAtualizados ?? atualizados
        );
        semAlteracao = Number(
            resultadoLote.acumuladoSemAlteracao ?? semAlteracao
        );
        erros = Number(resultadoLote.acumuladoErros ?? erros);

        salvarProgressoImportacaoLocal({
            idImportacao: importacaoIdAtual,
            nomeArquivo: importacaoArquivoAtual.name,
            totalItens: csvData.length,
            ultimoIndice: ultimoIndiceConfirmado,
            atualizadoEm: new Date().toISOString()
        });

        const percentual = Math.round(
            (importacaoIndiceInicial / csvData.length) * 100
        );

        progressBar.style.width = `${percentual}%`;
        progressBar.textContent = `${percentual}%`;

        const ultimo =
            resultadoLote.ultimoResultado ||
            (
                Array.isArray(resultadoLote.resultados) &&
                resultadoLote.resultados.length
                    ? resultadoLote.resultados[
                        resultadoLote.resultados.length - 1
                    ]
                    : null
            );

        const camposAlterados =
            ultimo && Array.isArray(ultimo.alteracoes)
                ? ultimo.alteracoes.map(item => item.campo).join(", ")
                : "";

        const detalheAtualizacao =
            ultimo && ultimo.tipo === "ATUALIZADO"
                ? ` Último atualizado: ${ultimo.codigo} — ` +
                  `${camposAlterados || "dados sincronizados"}.`
                : ultimo && ultimo.tipo === "NOVO"
                    ? ` Último novo: ${ultimo.codigo}.`
                    : ultimo && ultimo.tipo === "SEM_ALTERACAO"
                        ? ` Último conferido: ${ultimo.codigo} — sem alteração.`
                        : ultimo && ultimo.tipo === "LISTA_NEGRA"
                            ? ` Código bloqueado: ${ultimo.codigo}.`
                            : ultimo && ultimo.tipo === "ERRO"
                                ? ` Último erro: ${ultimo.erro}.`
                                : "";

        const agoraMs = Date.now();
        const tempoSessaoMs = agoraMs - inicioExecucaoMs;
        const tempoDecorridoTotalMs =
            tempoAcumuladoAnteriorMs + tempoSessaoMs;

        const itensProcessadosNestaExecucao = Math.max(
            1,
            importacaoIndiceInicial - indiceInicioExecucao
        );

        const mediaMsPorItem =
            tempoSessaoMs / itensProcessadosNestaExecucao;

        const itensRestantes = Math.max(
            0,
            csvData.length - importacaoIndiceInicial
        );

        const tempoRestanteMs = itensRestantes * mediaMsPorItem;
        const itensPorMinuto =
            mediaMsPorItem > 0
                ? Math.round(60000 / mediaMsPorItem)
                : 0;

        salvarTempoAcumuladoImportacao(
            importacaoIdAtual,
            tempoDecorridoTotalMs
        );

        log.textContent =
            `Processando ${importacaoIndiceInicial} de ${csvData.length} — ` +
            `${novos} novo(s), ${atualizados} atualizado(s), ` +
            `${semAlteracao} sem alteração, ${erros} erro(s).\n` +
            `Lotes de ${TAMANHO_LOTE_IMPORTACAO} — ` +
            `Tempo decorrido: ${formatarDuracaoImportacao(tempoDecorridoTotalMs)} — ` +
            `Tempo restante estimado: ${formatarDuracaoImportacao(tempoRestanteMs)} — ` +
            `Velocidade média: ${itensPorMinuto} item(ns)/min.` +
            detalheAtualizacao;

        // Entrega o controle ao navegador entre os lotes.
        await new Promise(resolve => setTimeout(resolve, 40));
    }

    btnCancelar.style.display = "none";
    btnCancelar.disabled = false;
    csvFile.disabled = false;

    if (
        importacaoCancelada ||
        falhaFatal ||
        importacaoIndiceInicial < csvData.length
    ) {
        try {
            await enviarParaGAS({
                acao: "pausarImportacao",
                adminToken,
                idImportacao: importacaoIdAtual,
                nomeArquivo: importacaoArquivoAtual.name,
                totalItens: csvData.length
            });
        } catch (erroPausa) {
            console.error("Não foi possível marcar a pausa:", erroPausa);
        }

        btnProcess.disabled = false;

        if (falhaFatal) {
            alert(
                `A importação foi pausada no item ${importacaoIndiceInicial + 1}.\n\n` +
                `${falhaFatal.message}\n\n` +
                "Selecione o mesmo CSV para continuar do ponto salvo."
            );
        } else if (importacaoCancelada) {
            alert(
                `Importação interrompida no item ${importacaoIndiceInicial} ` +
                `de ${csvData.length}.\n` +
                "O próximo lote continuará desse ponto."
            );
        }
    } else {
        await enviarParaGAS({
            acao: "concluirImportacao",
            adminToken,
            idImportacao: importacaoIdAtual,
            nomeArquivo: importacaoArquivoAtual.name,
            totalItens: csvData.length
        });

        limparProgressoImportacaoLocal();
        const tempoFinalMs =
            carregarTempoAcumuladoImportacao(importacaoIdAtual);

        let totalDetalhesRelatorio = 0;

        try {
            const relatorioFinal =
                await obterEBaixarRelatorioImportacao();
            totalDetalhesRelatorio = relatorioFinal.length;
        } catch (erroRelatorio) {
            console.error(
                "Não foi possível baixar o relatório final:",
                erroRelatorio
            );
        }

        alert(
            `Importação concluída!\n` +
            `Novos produtos: ${novos}\n` +
            `Produtos atualizados: ${atualizados}\n` +
            `Sem alteração: ${semAlteracao}\n` +
            `Erros: ${erros}\n` +
            `Tempo total: ${formatarDuracaoImportacao(tempoFinalMs)}\n` +
            `Detalhes no relatório: ${totalDetalhesRelatorio}`
        );

        limparTempoAcumuladoImportacao();
        btnProcess.disabled = true;
        fechar();
    }

    await carregarDadosPlanilha();
});

document.getElementById("btnCancelar").addEventListener("click", () => {
    importacaoCancelada = true;
    const button = document.getElementById("btnCancelar");
    button.disabled = true;
    document.getElementById("log").textContent =
        "Interrompendo após o item atual e salvando o ponto de retomada...";

    setTimeout(() => {
        button.disabled = false;
    }, 500);
});

document.getElementById("pesqCodigo").addEventListener("input", renderizarTabela);
document.getElementById("pesqNome").addEventListener("input", renderizarTabela);
document.getElementById("pesqMarca").addEventListener("input", renderizarTabela);
