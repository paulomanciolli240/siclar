"use strict";

const TEMPO_LIMITE_GAS_MS = 30000;
const TOTAL_TENTATIVAS_CARREGAMENTO = 4;

let promessaCarregamentoPlanilha = null;

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

function escaparHtmlApi(valor) {
    return String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function mostrarEstadoCarrossel(titulo, detalhe = "", mostrarBotao = false) {
    const grade = document.getElementById("containerGradeVitrine");
    const contador = document.getElementById("contadorVitrine");

    if (grade) {
        grade.innerHTML = `
            <div class="carrossel-estado-carregamento">
                <div class="carrossel-estado-icone">${mostrarBotao ? "⚠️" : "⏳"}</div>
                <strong>${escaparHtmlApi(titulo)}</strong>
                ${detalhe ? `<p>${escaparHtmlApi(detalhe)}</p>` : ""}
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

function limparTextoRespostaGas(texto) {
    return String(texto == null ? "" : texto)
        .replace(/^\uFEFF/, "")
        .trim();
}

function extrairJsonRespostaGas(textoResposta) {
    const texto = limparTextoRespostaGas(textoResposta);

    if (!texto) {
        throw new Error("O Google Apps Script respondeu sem conteúdo.");
    }

    try {
        return JSON.parse(texto);
    } catch (erroJsonDireto) {
        const inicioObjeto = texto.indexOf("{");
        const fimObjeto = texto.lastIndexOf("}");

        if (inicioObjeto >= 0 && fimObjeto > inicioObjeto) {
            const trechoJson = texto.slice(inicioObjeto, fimObjeto + 1);

            try {
                return JSON.parse(trechoJson);
            } catch {
                // Continua para a mensagem tratada abaixo.
            }
        }

        const pareceHtml =
            /^<!doctype html/i.test(texto) ||
            /^<html/i.test(texto) ||
            /<title>.*google/i.test(texto);

        if (pareceHtml) {
            throw new Error("O Google respondeu com uma página temporária em vez dos produtos.");
        }

        throw new Error("O Google Apps Script retornou uma resposta inválida.");
    }
}

function validarRespostaCatalogo(json) {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new Error("A resposta do catálogo não possui o formato esperado.");
    }

    if (json.erro) {
        throw new Error(String(json.erro));
    }

    if (!Array.isArray(json.data)) {
        throw new Error("O Google respondeu, mas não enviou a lista de produtos.");
    }

    return json;
}

function criarUrlListagemGas() {
    const separador = URL_DO_GAS.includes("?") ? "&" : "?";

    return `${URL_DO_GAS}${separador}acao=listar&_=${Date.now()}`;
}

async function executarCarregamentoPlanilha() {
    erroCarregamentoPlanilha = "";

    mostrarEstadoCarrossel(
        "Etapa 1/3 — conectando...",
        "Aguarde a resposta do Google Sheets."
    );

    let ultimoErro = null;

    for (let tentativa = 1; tentativa <= TOTAL_TENTATIVAS_CARREGAMENTO; tentativa += 1) {
        try {
            if (tentativa > 1) {
                const espera = 1200 * tentativa + Math.floor(Math.random() * 700);

                mostrarEstadoCarrossel(
                    `Tentativa ${tentativa} de ${TOTAL_TENTATIVAS_CARREGAMENTO}`,
                    "O Google respondeu incorretamente. Tentando novamente..."
                );

                await aguardar(espera);
            }

            const resposta = await fetchComTempoLimite(
                criarUrlListagemGas(),
                {
                    method: "GET",
                    cache: "no-store",
                    redirect: "follow",
                    headers: {
                        "Accept": "application/json,text/plain,*/*"
                    }
                }
            );

            const textoResposta = await resposta.text();

            if (!resposta.ok) {
                throw new Error(`Falha ao carregar a planilha (${resposta.status}).`);
            }

            const json = validarRespostaCatalogo(
                extrairJsonRespostaGas(textoResposta)
            );

            dadosGlobais = json.data;

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
                Erro ao carregar os dados: ${escaparHtmlApi(erroCarregamentoPlanilha)}
            </p>
        `;
    }

    return false;
}

async function carregarDadosPlanilha() {
    if (promessaCarregamentoPlanilha) {
        return promessaCarregamentoPlanilha;
    }

    promessaCarregamentoPlanilha = executarCarregamentoPlanilha();

    try {
        return await promessaCarregamentoPlanilha;
    } finally {
        promessaCarregamentoPlanilha = null;
    }
}

async function enviarParaGAS(payload) {
    const resposta = await fetchComTempoLimite(URL_DO_GAS, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "Accept": "application/json,text/plain,*/*"
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        redirect: "follow"
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
        throw new Error(`A operação não foi concluída (${resposta.status}).`);
    }

    const resultado = extrairJsonRespostaGas(texto);

    if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) {
        throw new Error("O Google Apps Script retornou uma resposta inválida.");
    }

    if (resultado.erro) {
        throw new Error(String(resultado.erro));
    }

    return resultado;
}
