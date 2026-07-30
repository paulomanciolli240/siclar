"use strict";

async function carregarDadosPlanilha() {
    erroCarregamentoPlanilha = '';

    try {
        const res = await fetch(`${URL_DO_GAS}?acao=listar&_=${Date.now()}`, {
            method: "GET",
            cache: "no-store"
        });

        const textoResposta = await res.text();
        let json;

        try {
            json = JSON.parse(textoResposta);
        } catch {
            throw new Error("O Apps Script não retornou um JSON válido. Publique novamente a implantação.");
        }

        if (!res.ok || json.erro) {
            throw new Error(json.erro || "Não foi possível carregar a planilha.");
        }

        dadosGlobais = Array.isArray(json.data) ? json.data : [];

        if (Array.isArray(json.headers) && json.headers.length > 0) {
            headers = json.headers;
        } else if (dadosGlobais.length > 0) {
            headers = Object.keys(dadosGlobais[0]);
        }

        renderizarTabela();
        return true;
    } catch (e) {
        console.error("Erro ao carregar planilha:", e);
        erroCarregamentoPlanilha = e.message;
        dadosGlobais = [];

        const areaLista = document.getElementById('areaLista');
        if (areaLista) {
            areaLista.innerHTML = `<p style="padding:20px;text-align:center;color:#dc2626;">
                Erro ao carregar os dados: ${e.message}
            </p>`;
        }

        return false;
    }
}

async function enviarParaGAS(payload) {
    const resposta = await fetch(URL_DO_GAS, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });

    const resultado = await resposta.json();
    if (!resposta.ok || resultado.erro) {
        throw new Error(resultado.erro || "A operação não foi concluída.");
    }
    return resultado;
}
