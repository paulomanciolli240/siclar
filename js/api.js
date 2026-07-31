"use strict";

const TEMPO_LIMITE_GAS_MS = 30000;
const TOTAL_TENTATIVAS_CARREGAMENTO = 3;

function aguardar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchComTempoLimite(url, opcoes = {}, tempoLimite = TEMPO_LIMITE_GAS_MS) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), tempoLimite);

    try {
        return await fetch(url, {
            ...opcoes,
            signal: controlador.signal
        });
    } catch (erro) {
        if (erro && erro.name === "AbortError") {
            throw new Error("O Google demorou demais para responder. Verifique a internet e tente novamente.");
        }
        throw erro;
    } finally {
        clearTimeout(temporizador);
    }
}

function mostrarEstadoCarrossel(titulo, detalhe = "", mostrarBotao = false) {
    const grade = document.getElementById("containerGradeVitrine");
    const contador = document.getElementById("contadorVitrine");

    if (grade) {
        grade.innerHTML = `
            <div class="carrossel-estado-carregamento">
                <div class="carrossel-estado-icone">${mostrarBotao ? "⚠️" : "⏳"}</div>
                <strong>${titulo}</strong>
                ${detalhe ? `<p>${detalhe}</p>` : ""}
                ${mostrarBotao ? `
                    <button type="button" class="btn-controle-carrossel" onclick="recarregarProdutos()">
                        Reconectar
                    </button>
                ` : ""}
            </div>
        `;
    }

    if (contador) {
        contador.textContent = titulo;
    }
}

async function carregarDadosPlanilha() {
    erroCarregamentoPlanilha = "";
    mostrarEstadoCarrossel("Etapa 1/3 — conectando...", "Aguarde a resposta do Google Sheets.");

    let ultimoErro = null;

    for (let tentativa = 1; tentativa <= TOTAL_TENTATIVAS_CARREGAMENTO; tentativa++) {
        try {
            if (tentativa > 1) {
                mostrarEstadoCarrossel(
                    `Tentativa ${tentativa} de ${TOTAL_TENTATIVAS_CARREGAMENTO}`,
                    "Reconectando ao catálogo..."
                );
                await aguardar(900 * tentativa);
            }

            const res = await fetchComTempoLimite(
                `${URL_DO_GAS}?acao=listar&_=${Date.now()}`,
                {
                    method: "GET",
                    cache: "no-store",
                    redirect: "follow"
                }
            );

            const textoResposta = await res.text();
            let json;

            try {
                json = JSON.parse(textoResposta);
            } catch {
                throw new Error("O Google Apps Script retornou uma resposta inválida.");
            }

            if (!res.ok || json.erro) {
                throw new Error(json.erro || `Falha ao carregar a planilha (${res.status}).`);
            }

            dadosGlobais = Array.isArray(json.data) ? json.data : [];
            mostrarEstadoCarrossel(
                "Etapa 2/3 — dados recebidos",
                `${dadosGlobais.length} produto(s) recebidos. Preparando a vitrine...`
            );

            if (Array.isArray(json.headers) && json.headers.length > 0) {
                headers = json.headers;
            } else if (dadosGlobais.length > 0) {
                headers = Object.keys(dadosGlobais[0]);
            } else {
                headers = [];
            }

            erroCarregamentoPlanilha = "";

            const areaLista = document.getElementById("areaLista");
            if (areaLista && typeof renderizarTabela === "function") {
                renderizarTabela();
            }

            return true;
        } catch (erro) {
            ultimoErro = erro;
            console.error(`Erro ao carregar planilha — tentativa ${tentativa}:`, erro);
        }
    }

    erroCarregamentoPlanilha =
        ultimoErro && ultimoErro.message
            ? ultimoErro.message
            : "Não foi possível acessar o catálogo.";

    dadosGlobais = [];
    headers = [];

    mostrarEstadoCarrossel(
        "Não foi possível carregar os produtos",
        erroCarregamentoPlanilha,
        true
    );

    const areaLista = document.getElementById("areaLista");
    if (areaLista) {
        areaLista.innerHTML = `
            <p style="padding:20px;text-align:center;color:#dc2626;">
                Erro ao carregar os dados: ${erroCarregamentoPlanilha}
            </p>
        `;
    }

    return false;
}

async function enviarParaGAS(payload) {
    const resposta = await fetchComTempoLimite(URL_DO_GAS, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
    });

    const texto = await resposta.text();
    let resultado;

    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error("O Google Apps Script retornou uma resposta inválida.");
    }

    if (!resposta.ok || resultado.erro) {
        throw new Error(resultado.erro || "A operação não foi concluída.");
    }

    return resultado;
}
