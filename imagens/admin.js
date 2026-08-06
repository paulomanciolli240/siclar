"use strict";

const CHAVE_RASCUNHO_PRODUTO_ADMIN = "siclar_rascunho_produto_admin";


let importacaoArquivoAtual = null;
let importacaoIdAtual = "";


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

function criarIdImportacao() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `siclar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
        codigosParaExcluir.push(chk.value);
    });

    if (!confirm(`Deseja excluir ${codigosParaExcluir.length} produto(s) de uma vez?\nEsta ação não pode ser desfeita!`)) return;

    try {
        for (const cod of codigosParaExcluir) {
            await enviarParaGAS({ acao: "excluir", codigo: cod, adminToken });
        }
        const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
        dadosGlobais = dadosGlobais.filter(i => !codigosParaExcluir.includes(String(i[hCod])));
        renderizarTabela();
        alert(`✅ ${codigosParaExcluir.length} produto(s) excluído(s) com sucesso!`);
    } catch(e) {
        alert("Erro na exclusão em lote: " + e.message);
    }
}

function renderizarTabela() {
    const fCod = document.getElementById('pesqCodigo').value.trim();
    const fNome = document.getElementById('pesqNome').value.trim();
    const fMarca = document.getElementById('pesqMarca').value.trim();

    const hCod = headers.find(h =>
        h.includes('Cód') || h.toLowerCase().includes('codigo')
    ) || headers[0];

    const hDesc = headers.find(h =>
        h.includes('Desc') || h.toLowerCase().includes('nome')
    ) || headers[1];

    const hMarca = headers.find(h =>
        h.includes('Marca') || h.toLowerCase().includes('marca')
    ) || headers[2];

    const hPreco = headers.find(h =>
        h.includes('Preço') || h.toLowerCase().includes('venda')
    ) || headers[3];

    const hFoto = headers.find(h =>
        h.includes('Foto') || h.toLowerCase().includes('imagem')
    ) || '';

    const hModelo = headers.find(h =>
        h.toLowerCase().includes('modelo')
    ) || '';

    const hMedida = headers.find(h =>
        h.toLowerCase().includes('medida')
    ) || '';

    const hFabricante = headers.find(h =>
        h.toLowerCase().includes('fabricante')
    ) || '';

    const hLocacao = headers.find(h =>
        h.toLowerCase().includes('loca')
    ) || '';

    const camposPesquisa = [
        hCod,
        hDesc,
        hMarca,
        hModelo,
        hMedida,
        hFabricante,
        hLocacao
    ].filter(Boolean);

    listaFiltradaAtual = dadosGlobais.filter(produto => {
        const codigoOk = !fCod ||
            buscaInteligente(fCod, produto[hCod]);

        const marcaOk = !fMarca ||
            buscaInteligente(fMarca, produto[hMarca]);

        const textoCompleto = montarTextoPesquisaProduto(
            produto,
            camposPesquisa
        );

        const descricaoOk = !fNome ||
            buscaInteligente(fNome, textoCompleto);

        return codigoOk && marcaOk && descricaoOk;
    });

    if (fNome) {
        listaFiltradaAtual.sort((a, b) => {
            const textoA = montarTextoPesquisaProduto(a, camposPesquisa);
            const textoB = montarTextoPesquisaProduto(b, camposPesquisa);

            return calcularPontuacaoPesquisa(fNome, textoB) -
                   calcularPontuacaoPesquisa(fNome, textoA);
        });
    }

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
        await enviarParaGAS({ acao: "excluir", codigo: cod, adminToken });
        const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
        dadosGlobais = dadosGlobais.filter(i => String(i[hCod]) !== String(cod));
        renderizarTabela();
        alert("Excluído!");
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

    csvData = [];
    headers = [];
    importacaoArquivoAtual = file || null;
    importacaoIdAtual = "";
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

            importacaoIdAtual = criarIdImportacao();
            botaoProcessar.disabled = false;

            log.textContent = linhasInvalidas.length
                ? `${csvData.length} linhas válidas. ${linhasInvalidas.length} linha(s) sem código ignoradas. Clique em Iniciar Importação.`
                : `${csvData.length} linhas carregadas. Clique em Iniciar Importação.`;
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

    const TAMANHO_LOTE_IMPORTACAO = 50;

    importacaoCancelada = false;
    btnProcess.disabled = true;
    csvFile.disabled = true;
    btnCancelar.style.display = "inline-block";
    progressContainer.style.display = "block";

    let sucessos = 0;
    let novos = 0;
    let atualizados = 0;
    let semAlteracao = 0;
    let erros = 0;

    progressBar.style.width = "0%";
    progressBar.textContent = "0%";

    for (
        let indiceInicial = 0;
        indiceInicial < csvData.length;
        indiceInicial += TAMANHO_LOTE_IMPORTACAO
    ) {
        if (importacaoCancelada) break;

        const fimExclusivo = Math.min(
            indiceInicial + TAMANHO_LOTE_IMPORTACAO,
            csvData.length
        );

        const produtosDoLote = csvData.slice(indiceInicial, fimExclusivo);
        let resultado = null;

        try {
            resultado = await enviarParaGAS({
                acao: "importarLote",
                adminToken,
                headers,
                idImportacao: importacaoIdAtual,
                nomeArquivo: importacaoArquivoAtual.name,
                indiceInicial,
                totalItens: csvData.length,
                items: produtosDoLote.map(produto => ({
                    data: produto
                }))
            });

            if (resultado.erro) {
                throw new Error(resultado.erro);
            }

            sucessos = fimExclusivo;

            novos = Number(resultado.acumuladoNovos ?? novos);
            atualizados = Number(
                resultado.acumuladoAtualizados ?? atualizados
            );
            semAlteracao = Number(
                resultado.acumuladoSemAlteracao ?? semAlteracao
            );
            erros = Number(resultado.acumuladoErros ?? erros);

        } catch (erro) {
            erros += produtosDoLote.length;

            console.error(
                `Erro na importação do lote ${indiceInicial + 1} a ${fimExclusivo}:`,
                produtosDoLote,
                erro
            );

            try {
                await enviarParaGAS({
                    acao: "registrarErroImportacao",
                    adminToken,
                    idImportacao: importacaoIdAtual,
                    nomeArquivo: importacaoArquivoAtual.name,
                    totalItens: csvData.length,
                    indiceItem: indiceInicial,
                    mensagemErro:
                        `Falha no lote ${indiceInicial + 1} a ${fimExclusivo}: ` +
                        erro.message
                });
            } catch (erroRegistro) {
                console.error(
                    "Não foi possível registrar o erro do lote:",
                    erroRegistro
                );
            }
        }

        const processados = fimExclusivo;
        const percentual = Math.round(
            (processados / csvData.length) * 100
        );

        progressBar.style.width = `${percentual}%`;
        progressBar.textContent = `${percentual}%`;

        const ultimoResultado = resultado?.ultimoResultado || null;

        const camposAlterados = Array.isArray(
            ultimoResultado?.alteracoes
        )
            ? ultimoResultado.alteracoes
                .map(item => item.campo)
                .join(", ")
            : "";

        const detalheAtualizacao =
            ultimoResultado?.tipo === "ATUALIZADO"
                ? ` Último atualizado: ${ultimoResultado.codigo}` +
                  `${camposAlterados ? ` — ${camposAlterados}` : ""}.`
                : ultimoResultado?.tipo === "NOVO"
                    ? ` Último novo: ${ultimoResultado.codigo}.`
                    : "";

        log.textContent =
            `Processando ${processados} de ${csvData.length} — ` +
            `${novos} novo(s), ${atualizados} atualizado(s), ` +
            `${semAlteracao} sem alteração, ${erros} erro(s).` +
            detalheAtualizacao;
    }

    btnCancelar.style.display = "none";
    csvFile.disabled = false;

    if (importacaoCancelada) {
        try {
            const relatorioParcial =
                await obterEBaixarRelatorioImportacao();

            alert(
                `Importação interrompida após ${sucessos} de ` +
                `${csvData.length} item(ns).\n` +
                `${relatorioParcial.length} alteração(ões) ` +
                `registrada(s) no relatório parcial.\n` +
                "Para importar novamente, selecione o CSV e inicie " +
                "uma nova importação."
            );
        } catch (erroRelatorio) {
            console.error(
                "Não foi possível baixar o relatório parcial:",
                erroRelatorio
            );

            alert(
                `Importação interrompida após ${sucessos} de ` +
                `${csvData.length} item(ns).\n` +
                "Para importar novamente, selecione o CSV e inicie " +
                "uma nova importação."
            );
        }

        btnProcess.disabled = false;
    } else {
        await enviarParaGAS({
            acao: "concluirImportacao",
            adminToken,
            idImportacao: importacaoIdAtual,
            nomeArquivo: importacaoArquivoAtual.name,
            totalItens: csvData.length
        });

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
            `Detalhes registrados no relatório: ` +
            `${totalDetalhesRelatorio}`
        );

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
        "Interrompendo após o item atual...";

    setTimeout(() => {
        button.disabled = false;
    }, 500);
});



/* =========================================================
   LISTA NEGRA DE PRODUTOS
   ========================================================= */

let listaNegraProdutosAtual = [];
let listaNegraCarregando = false;

function abrirListaNegraProdutos() {
    const modal = document.getElementById("modalListaNegraProdutos");
    const campoBusca = document.getElementById("buscaListaNegraProdutos");

    if (!modal) {
        alert("A janela da Lista Negra não foi encontrada no index.html.");
        return;
    }

    modal.classList.add("modal-ativo");

    if (campoBusca) {
        campoBusca.value = "";
    }

    carregarListaNegraProdutos();
}

function fecharListaNegraProdutos() {
    const modal = document.getElementById("modalListaNegraProdutos");

    if (modal) {
        modal.classList.remove("modal-ativo");
    }
}

async function carregarListaNegraProdutos() {
    if (listaNegraCarregando) return;

    const area = document.getElementById("areaListaNegraProdutos");

    if (!area) {
        alert("A área da Lista Negra não foi encontrada no index.html.");
        return;
    }

    listaNegraCarregando = true;

    area.innerHTML = `
        <div style="padding:24px;text-align:center;color:#64748b;">
            <div style="font-size:28px;margin-bottom:8px;">⏳</div>
            Carregando códigos bloqueados...
        </div>
    `;

    try {
        const resultado = await enviarParaGAS({
            acao: "listarListaNegra",
            adminToken
        });

        if (resultado && resultado.erro) {
            throw new Error(resultado.erro);
        }

        listaNegraProdutosAtual = Array.isArray(resultado && resultado.itens)
            ? resultado.itens
            : [];

        renderizarListaNegraProdutos();
    } catch (erro) {
        console.error("Erro ao carregar lista negra:", erro);

        area.innerHTML = `
            <div style="
                padding:20px;
                border:1px solid #fecaca;
                background:#fef2f2;
                color:#991b1b;
                border-radius:10px;
                text-align:center;
            ">
                <div style="font-size:28px;margin-bottom:8px;">⚠️</div>
                <strong>Não foi possível carregar a Lista Negra.</strong>
                <p style="margin:8px 0 14px;">
                    ${escaparHtmlListaNegra(erro && erro.message ? erro.message : "Erro desconhecido.")}
                </p>
                <button
                    class="btn"
                    type="button"
                    onclick="carregarListaNegraProdutos()"
                >
                    Tentar novamente
                </button>
            </div>
        `;
    } finally {
        listaNegraCarregando = false;
    }
}

function escaparHtmlListaNegra(valor) {
    return String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizarTextoListaNegra(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function renderizarListaNegraProdutos() {
    const area = document.getElementById("areaListaNegraProdutos");
    const campoBusca = document.getElementById("buscaListaNegraProdutos");

    if (!area) return;

    const termo = normalizarTextoListaNegra(
        campoBusca ? campoBusca.value : ""
    );

    const itensFiltrados = listaNegraProdutosAtual.filter(item => {
        if (!termo) return true;

        const texto = normalizarTextoListaNegra([
            item.codigo,
            item.descricao,
            item.motivo,
            item.bloqueadoPor,
            item.bloqueadoEm
        ].filter(Boolean).join(" "));

        return termo
            .split(/\s+/)
            .filter(Boolean)
            .every(parte => texto.includes(parte));
    });

    if (listaNegraProdutosAtual.length === 0) {
        area.innerHTML = `
            <div style="
                padding:28px;
                text-align:center;
                border:1px dashed #cbd5e1;
                border-radius:10px;
                color:#64748b;
            ">
                <div style="font-size:32px;margin-bottom:8px;">✅</div>
                <strong>Nenhum produto está na Lista Negra.</strong>
                <p style="margin:8px 0 0;font-size:13px;">
                    Produtos excluídos manualmente aparecerão aqui.
                </p>
            </div>
        `;
        return;
    }

    if (itensFiltrados.length === 0) {
        area.innerHTML = `
            <div style="
                padding:28px;
                text-align:center;
                border:1px dashed #cbd5e1;
                border-radius:10px;
                color:#64748b;
            ">
                <div style="font-size:32px;margin-bottom:8px;">🔎</div>
                <strong>Nenhum código encontrado para esta pesquisa.</strong>
            </div>
        `;
        return;
    }

    let html = `
        <div style="
            margin-bottom:10px;
            color:#64748b;
            font-size:13px;
            font-weight:600;
        ">
            ${itensFiltrados.length} de ${listaNegraProdutosAtual.length} código(s) bloqueado(s)
        </div>

        <div class="tabela-container">
            <table class="tabela-produtos">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Motivo</th>
                        <th>Bloqueado em</th>
                        <th>Bloqueado por</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
    `;

    itensFiltrados.forEach(item => {
        const codigo = String(item.codigo || "");

        html += `
            <tr>
                <td><strong>${escaparHtmlListaNegra(codigo)}</strong></td>
                <td>${escaparHtmlListaNegra(item.descricao || "—")}</td>
                <td>${escaparHtmlListaNegra(item.motivo || "EXCLUÍDO MANUALMENTE")}</td>
                <td>${escaparHtmlListaNegra(item.bloqueadoEm || "—")}</td>
                <td>${escaparHtmlListaNegra(item.bloqueadoPor || "—")}</td>
                <td>
                    <button
                        class="btn"
                        type="button"
                        style="background:#16a34a;"
                        onclick='autorizarProdutoListaNegra(${JSON.stringify(codigo)})'
                    >
                        ✅ Autorizar novamente
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    area.innerHTML = html;
}

async function autorizarProdutoListaNegra(codigo) {
    const codigoNormalizado = String(codigo || "").trim();

    if (!codigoNormalizado) return;

    const confirmar = confirm(
        `Autorizar novamente o produto de código ${codigoNormalizado}?\n\n` +
        "Ele poderá retornar em uma próxima importação."
    );

    if (!confirmar) return;

    const botoes = Array.from(
        document.querySelectorAll("#areaListaNegraProdutos button")
    );

    botoes.forEach(botao => {
        botao.disabled = true;
    });

    try {
        const resultado = await enviarParaGAS({
            acao: "removerListaNegra",
            codigo: codigoNormalizado,
            adminToken
        });

        if (resultado && resultado.erro) {
            throw new Error(resultado.erro);
        }

        listaNegraProdutosAtual = listaNegraProdutosAtual.filter(
            item => String(item.codigo || "") !== codigoNormalizado
        );

        renderizarListaNegraProdutos();

        alert(
            `Código ${codigoNormalizado} autorizado novamente.\n` +
            "Ele poderá voltar em uma próxima importação."
        );
    } catch (erro) {
        console.error("Erro ao autorizar produto:", erro);
        alert(
            "Não foi possível autorizar o produto novamente.\n\n" +
            (erro && erro.message ? erro.message : "Erro desconhecido.")
        );

        renderizarListaNegraProdutos();
    }
}

document.addEventListener("keydown", evento => {
    if (evento.key !== "Escape") return;

    const modal = document.getElementById("modalListaNegraProdutos");

    if (modal && modal.classList.contains("modal-ativo")) {
        fecharListaNegraProdutos();
    }
});

document.getElementById("pesqCodigo").addEventListener("input", renderizarTabela);
document.getElementById("pesqNome").addEventListener("input", renderizarTabela);
document.getElementById("pesqMarca").addEventListener("input", renderizarTabela);
