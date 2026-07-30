"use strict";

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

async function salvarEProximoProduto() {
    let obj = {};
    headers.forEach(h => obj[h] = document.getElementById(`campo_${h.replace(/\W/g,'_')}`).value);
    try {
        const resposta = await fetch(URL_DO_GAS, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                acao: "editar",
                dadosProduto: obj,
                adminToken
            })
        });

        const resultado = await resposta.json();
        if (!resposta.ok || resultado.erro) {
            throw new Error(resultado.erro || "Não foi possível salvar a edição.");
        }

        const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
        const idx = dadosGlobais.findIndex(i => String(i[hCod]) === String(obj[hCod]));
        if(idx !== -1) dadosGlobais[idx] = obj;
        renderizarTabela();
        indiceEdicaoAtual++;
        if(indiceEdicaoAtual < listaFiltradaAtual.length) {
            preencherFormularioEdicao(listaFiltradaAtual[indiceEdicaoAtual]);
        } else {
            fecharModalEdicao();
            alert("Todos os itens revisados!");
        }
    } catch(e) { alert("Erro: " + e.message); }
}

document.getElementById("btnAbrir").addEventListener("click", () => {
    document.getElementById("janela").classList.add("modal-ativo");
});

document.getElementById("csvFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById("fileName").textContent = file.name;
    const reader = new FileReader();
    reader.readAsText(file, "ISO-8859-1");

    reader.onload = loadEvent => {
        const lines = loadEvent.target.result.split(/\r\n|\n/);
        if (lines.length === 0) return;

        const separator = lines[0].includes(";") ? ";" : ",";
        headers = lines[0]
            .split(separator)
            .map(header => header.trim().replace(/^"|"$/g, ""));

        csvData = [];

        for (let index = 1; index < lines.length; index++) {
            const line = lines[index].trim();
            if (!line) continue;

            const values = line
                .split(separator)
                .map(value => value.trim().replace(/^"|"$/g, ""));

            const item = {};
            headers.forEach((header, valueIndex) => {
                item[header] = values[valueIndex] || "";
            });
            csvData.push(item);
        }

        document.getElementById("btnProcess").disabled = false;
        document.getElementById("log").textContent =
            `${csvData.length} linhas carregadas.`;
    };
});

document.getElementById("btnProcess").addEventListener("click", async () => {
    const btnProcess = document.getElementById("btnProcess");
    const csvFile = document.getElementById("csvFile");
    const btnCancelar = document.getElementById("btnCancelar");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const log = document.getElementById("log");

    importacaoCancelada = false;
    btnProcess.disabled = true;
    csvFile.disabled = true;
    btnCancelar.style.display = "inline-block";
    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";

    let sucessos = 0;
    let erros = 0;

    for (let index = 0; index < csvData.length; index++) {
        if (importacaoCancelada) break;

        try {
            const resultado = await enviarParaGAS({
                acao: "importar",
                adminToken,
                headers,
                items: [{ data: csvData[index] }]
            });

            if (resultado.erro) {
                throw new Error(resultado.erro);
            }
            sucessos++;
        } catch (erro) {
            erros++;
            console.error("Erro na importação:", erro);
        }

        const percentual = Math.round(((index + 1) / csvData.length) * 100);
        progressBar.style.width = `${percentual}%`;
        progressBar.textContent = `${percentual}%`;
        log.textContent =
            `Processando ${index + 1} de ${csvData.length} — ${sucessos} sucesso(s), ${erros} erro(s).`;
    }

    btnCancelar.style.display = "none";
    csvFile.disabled = false;

    if (importacaoCancelada) {
        alert(`Importação interrompida. ${sucessos} item(ns) enviados e ${erros} erro(s).`);
        btnProcess.disabled = false;
    } else {
        alert(`Importação concluída! ${sucessos} de ${csvData.length} enviados. Erros: ${erros}.`);
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

document.getElementById("pesqCodigo").addEventListener("input", renderizarTabela);
document.getElementById("pesqNome").addEventListener("input", renderizarTabela);
document.getElementById("pesqMarca").addEventListener("input", renderizarTabela);
