"use strict";


const IMAGEM_SEM_FOTO_SICLAR =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
            <rect width="300" height="300" fill="#f1f5f9"/>
            <rect x="74" y="82" width="152" height="118" rx="12" fill="none" stroke="#94a3b8" stroke-width="8"/>
            <circle cx="122" cy="125" r="18" fill="#94a3b8"/>
            <path d="M88 184l42-42 30 30 22-22 30 34" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="150" y="236" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#64748b">Sem imagem</text>
        </svg>
    `);

const imagensComFalhaCarrossel = new Set();
let assinaturaUltimaPaginaCarrossel = "";

function escaparHtmlCarrossel(valor) {
    return String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obterUrlImagemCarrossel(valor) {
    const texto = String(valor == null ? "" : valor).trim();

    if (!texto) return "";

    const superior = texto.toUpperCase();

    if (
        superior === "NÃO" ||
        superior === "NAO" ||
        superior === "SEM FOTO" ||
        superior === "SEM IMAGEM"
    ) {
        return "";
    }

    try {
        return resolverUrlImagem(texto);
    } catch (erro) {
        console.warn("Imagem inválida:", texto, erro);
        return "";
    }
}

function gerarImagemCarrossel(valorFoto, descricao) {
    const url = obterUrlImagemCarrossel(valorFoto);

    if (!url || imagensComFalhaCarrossel.has(url)) {
        return `<img src="${IMAGEM_SEM_FOTO_SICLAR}" alt="Sem imagem" loading="lazy" decoding="async">`;
    }

    return `
        <img
            src="${url}"
            alt="${escaparHtmlCarrossel(descricao || "Produto")}"
            loading="lazy"
            decoding="async"
            data-imagem-carrossel="${escaparHtmlCarrossel(url)}"
        >
    `;
}

function configurarErrosImagemCarrossel() {
    document
        .querySelectorAll("#containerGradeVitrine img[data-imagem-carrossel]")
        .forEach(imagem => {
            imagem.addEventListener("error", () => {
                const url = imagem.dataset.imagemCarrossel || imagem.src;

                if (url) imagensComFalhaCarrossel.add(url);

                imagem.removeAttribute("data-imagem-carrossel");
                imagem.src = IMAGEM_SEM_FOTO_SICLAR;
                imagem.alt = "Sem imagem";
            }, { once: true });
        });
}

function pausarTimerCarrossel() {
    if (timerCarrossel) {
        clearTimeout(timerCarrossel);
        timerCarrossel = null;
    }
}



function obterQuantidadeProdutosVitrine() {
    const largura = window.innerWidth || document.documentElement.clientWidth || 1200;

    if (largura >= 1600) return 5;
    if (largura >= 900) return 4;
    if (largura >= 600) return 2;
    return 1;
}
const MAXIMO_CODIGOS_RECENTES = 240;

let produtosLoteVitrine = [];
let codigosRecentesVitrine = [];
let historicoLotesVitrine = [];
let indiceHistoricoLoteVitrine = -1;
let cicloAutomaticoConcluido = true;

function embaralharProdutosCarrossel(lista) {
    const copia = Array.isArray(lista) ? lista.slice() : [];

    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }

    return copia;
}

function obterCabecalhoCodigoCarrossel() {
    return headers.find(h =>
        String(h || "").includes("Cód") ||
        String(h || "").toLowerCase().includes("codigo")
    ) || headers[0];
}

function selecionarNovoLoteVitrine() {
    const base = Array.isArray(dadosGlobais) ? dadosGlobais : [];
    const hCod = obterCabecalhoCodigoCarrossel();
    const hFoto = headers.find(h =>
        String(h || "").includes("Foto") ||
        String(h || "").toLowerCase().includes("imagem")
    ) || "";

    if (base.length === 0) {
        produtosLoteVitrine = [];
        indicePaginaCarrossel = 0;
        assinaturaUltimaPaginaCarrossel = "";
        return;
    }

    const recentes = new Set(codigosRecentesVitrine);

    let candidatos = base.filter(produto => {
        const codigo = String(produto[hCod] || "").trim();
        return codigo && !recentes.has(codigo);
    });

    if (candidatos.length < obterQuantidadeProdutosVitrine()) {
        codigosRecentesVitrine = [];
        candidatos = base.slice();
    }

    const possuiFotoDeclarada = produto => {
        if (!hFoto) return false;

        const valor = String(produto[hFoto] || "").trim();
        if (!valor) return false;

        return ![
            "NÃO",
            "NAO",
            "SEM FOTO",
            "SEM IMAGEM",
            "0",
            "-"
        ].includes(valor.toUpperCase());
    };

    const comFoto = embaralharProdutosCarrossel(
        candidatos.filter(possuiFotoDeclarada)
    );

    const semFoto = embaralharProdutosCarrossel(
        candidatos.filter(produto => !possuiFotoDeclarada(produto))
    );

    const novoLote = [...comFoto, ...semFoto]
        .slice(0, obterQuantidadeProdutosVitrine());

    if (indiceHistoricoLoteVitrine < historicoLotesVitrine.length - 1) {
        historicoLotesVitrine = historicoLotesVitrine.slice(
            0,
            indiceHistoricoLoteVitrine + 1
        );
    }

    historicoLotesVitrine.push(novoLote);
    indiceHistoricoLoteVitrine = historicoLotesVitrine.length - 1;
    produtosLoteVitrine = novoLote;

    const novosCodigos = novoLote
        .map(produto => String(produto[hCod] || "").trim())
        .filter(Boolean);

    codigosRecentesVitrine = [
        ...codigosRecentesVitrine,
        ...novosCodigos
    ].slice(-MAXIMO_CODIGOS_RECENTES);

    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";
}
function obterBaseProdutosCarrossel() {
    const existePesquisa =
        String(termoPesquisaCarrossel || "").trim() !== "";

    if (existePesquisa) {
        return Array.isArray(dadosGlobais) ? dadosGlobais : [];
    }

    if (produtosLoteVitrine.length === 0) {
        selecionarNovoLoteVitrine();
    }

    return produtosLoteVitrine;
}

function calcularItensPorPaginaCarrossel() {
    return obterQuantidadeProdutosVitrine();
}


function aplicarEstiloVitrineResponsiva() {
    let style = document.getElementById("siclar-vitrine-responsiva-css");

    if (!style) {
        style = document.createElement("style");
        style.id = "siclar-vitrine-responsiva-css";
        style.textContent = `
            #containerGradeVitrine {
                display: grid !important;
                grid-template-columns:
                    repeat(
                        var(--siclar-colunas-vitrine, 4),
                        minmax(0, 1fr)
                    ) !important;
                grid-template-rows: 1fr !important;
                align-items: stretch !important;
                gap: 24px !important;
                width: min(1280px, calc(100% - 48px)) !important;
                margin: 28px auto 18px !important;
                overflow: visible !important;
            }

            #containerGradeVitrine .card-quadrado-vitrine {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
                min-width: 0 !important;
                min-height: 390px !important;
                padding: 14px !important;
                border-radius: 16px !important;
                transform: none !important;
                box-shadow: 0 10px 28px rgba(15, 23, 42, .18) !important;
            }

            #containerGradeVitrine .card-quadrado-vitrine:hover {
                transform: translateY(-3px) !important;
            }

            #containerGradeVitrine .vitrine-foto-container {
                height: 170px !important;
                min-height: 170px !important;
            }

            /*
              Os controles ficam logo abaixo da única linha de produtos.
              Foram incluídos seletores alternativos para preservar
              diferentes versões do HTML do SICLAR.
            */
            .controles-carrossel,
            .carrossel-controles,
            .controles-vitrine,
            #controlesCarrossel,
            #controlesVitrine {
                position: relative !important;
                z-index: 20 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 14px !important;
                width: 100% !important;
                margin: 8px auto 22px !important;
                padding: 8px 16px !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            #contadorVitrine {
                min-width: 230px !important;
                text-align: center !important;
            }

            @media (max-width: 899px) {
                #containerGradeVitrine {
                    width: min(760px, calc(100% - 34px)) !important;
                    gap: 20px !important;
                }
            }

            @media (max-width: 599px) {
                #containerGradeVitrine {
                    width: min(390px, calc(100% - 26px)) !important;
                    gap: 18px !important;
                    margin-top: 20px !important;
                }

                #containerGradeVitrine .card-quadrado-vitrine {
                    min-height: 370px !important;
                }

                #containerGradeVitrine .vitrine-foto-container {
                    height: 185px !important;
                    min-height: 185px !important;
                }

                #contadorVitrine {
                    min-width: 0 !important;
                    font-size: 12px !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    const quantidade = obterQuantidadeProdutosVitrine();

    document.documentElement.style.setProperty(
        "--siclar-colunas-vitrine",
        String(quantidade)
    );
}


function garantirSetasLateraisCarrossel() {
    if (document.getElementById("siclar-seta-carrossel-anterior")) {
        atualizarSetasLateraisCarrossel();
        return;
    }

    const estilo = document.createElement("style");
    estilo.id = "siclar-setas-laterais-css";
    estilo.textContent = `
        /*
          As setas ficam presas às laterais da tela e não dependem
          da altura dos cards ou da rolagem da página.
        */
        .siclar-seta-lateral-carrossel {
            position: fixed;
            top: 50%;
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 58px;
            height: 92px;
            padding: 0;
            border: 1px solid rgba(255, 255, 255, .34);
            border-radius: 16px;
            background: rgba(15, 23, 42, .86);
            color: #ffffff;
            box-shadow: 0 12px 34px rgba(0, 0, 0, .34);
            font-size: 46px;
            font-family: Arial, sans-serif;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            translate: 0 -50%;
            transition:
                background .16s ease,
                scale .16s ease,
                opacity .16s ease;
            -webkit-tap-highlight-color: transparent;
        }

        .siclar-seta-lateral-carrossel:hover,
        .siclar-seta-lateral-carrossel:focus-visible {
            background: rgba(234, 88, 12, .96);
            scale: 1.06;
            outline: 3px solid rgba(255, 255, 255, .78);
            outline-offset: 3px;
        }

        .siclar-seta-lateral-carrossel:disabled {
            opacity: .25;
            cursor: default;
            scale: 1;
        }

        #siclar-seta-carrossel-anterior {
            left: 10px;
        }

        #siclar-seta-carrossel-proxima {
            right: 10px;
        }

        /*
          Os controles antigos do rodapé são escondidos.
          As setas laterais passam a ser a navegação principal.
        */
        #moduloCarrossel .controles-carrossel,
        #moduloCarrossel .carrossel-controles,
        #moduloCarrossel .controles-vitrine,
        #moduloCarrossel #controlesCarrossel,
        #moduloCarrossel #controlesVitrine {
            display: none !important;
        }

        @media (max-width: 720px) {
            .siclar-seta-lateral-carrossel {
                width: 46px;
                height: 72px;
                border-radius: 13px;
                font-size: 36px;
            }

            #siclar-seta-carrossel-anterior {
                left: 5px;
            }

            #siclar-seta-carrossel-proxima {
                right: 5px;
            }
        }
    `;

    document.head.appendChild(estilo);

    const anterior = document.createElement("button");
    anterior.id = "siclar-seta-carrossel-anterior";
    anterior.className = "siclar-seta-lateral-carrossel";
    anterior.type = "button";
    anterior.textContent = "‹";
    anterior.title = "Visualização anterior";
    anterior.setAttribute("aria-label", "Visualização anterior");
    anterior.addEventListener("click", () => {
        mudarSlideCarrossel(-1);
        atualizarSetasLateraisCarrossel();
    });

    const proxima = document.createElement("button");
    proxima.id = "siclar-seta-carrossel-proxima";
    proxima.className = "siclar-seta-lateral-carrossel";
    proxima.type = "button";
    proxima.textContent = "›";
    proxima.title = "Próxima visualização";
    proxima.setAttribute("aria-label", "Próxima visualização");
    proxima.addEventListener("click", () => {
        mudarSlideCarrossel(1);
        atualizarSetasLateraisCarrossel();
    });

    document.body.appendChild(anterior);
    document.body.appendChild(proxima);

    atualizarSetasLateraisCarrossel();
}

function atualizarSetasLateraisCarrossel() {
    const anterior =
        document.getElementById("siclar-seta-carrossel-anterior");

    const proxima =
        document.getElementById("siclar-seta-carrossel-proxima");

    if (!anterior || !proxima) return;

    const modulo = document.getElementById("moduloCarrossel");
    const moduloVisivel =
        carrosselAtivo &&
        modulo &&
        getComputedStyle(modulo).display !== "none";

    anterior.style.display = moduloVisivel ? "flex" : "none";
    proxima.style.display = moduloVisivel ? "flex" : "none";

    if (!moduloVisivel) return;

    const existePesquisa =
        String(termoPesquisaCarrossel || "").trim() !== "";

    /*
      Na pesquisa, a navegação é circular.
      Na vitrine normal, a seta esquerda fica desativada
      enquanto ainda não existe uma visualização anterior.
    */
    anterior.disabled =
        !existePesquisa &&
        indiceHistoricoLoteVitrine <= 0;

    proxima.disabled = false;
}

function abrirPainelAdministrativo() {
    pararCarrossel();
    document.getElementById('moduloCarrossel').style.display = 'none';
    document.getElementById('moduloAdministrativo').style.display = 'block';
}

function voltarParaCarrossel() {
    document.getElementById('moduloAdministrativo').style.display = 'none';
    document.getElementById('moduloCarrossel').style.display = 'flex';
    iniciarCarrossel();
}

function iniciarCarrossel() {
    aplicarEstiloVitrineResponsiva();
    garantirSetasLateraisCarrossel();
    carrosselAtivo = true;
    itensPorPagina = obterQuantidadeProdutosVitrine();
    pausarTimerCarrossel();

    if (!produtosLoteVitrine.length) {
        selecionarNovoLoteVitrine();
    }

    document.getElementById('moduloCarrossel').style.display = 'flex';
    renderizarPaginaCarrossel();
}

function pararCarrossel() {
    carrosselAtivo = false;
    atualizarSetasLateraisCarrossel();
    pausarTimerCarrossel();
}

function obterProdutosFiltradosCarrossel() {
    const hCod = headers.find(h => h.includes('Cód') || h.toLowerCase().includes('codigo')) || headers[0];
    const hDesc = headers.find(h => h.includes('Desc') || h.toLowerCase().includes('nome')) || headers[1];
    const hMarca = headers.find(h => h.includes('Marca') || h.toLowerCase().includes('marca')) || headers[2];

    const camposPesquisa = [
        hCod,
        hDesc,
        hMarca
    ].filter(Boolean);

    return ordenarProdutosPorPesquisa(
        obterBaseProdutosCarrossel(),
        termoPesquisaCarrossel,
        camposPesquisa
    );
}

function renderizarPaginaCarrossel() {
    try {
        aplicarEstiloVitrineResponsiva();
        // Sempre limpa o temporizador primeiro
        pausarTimerCarrossel();

    // O conteúdo continua sendo renderizado durante pesquisa e hover.
    // Apenas a troca automática de página fica pausada.
    if (!carrosselAtivo) return;

    const hCod = headers.find(h => h.includes('Cód') || h.includes('codigo')) || headers[0];
    const hDesc = headers.find(h => h.includes('Desc') || h.includes('nome')) || headers[1];
    const hMarca = headers.find(h => h.includes('Marca')) || headers[2];
    const hPreco = headers.find(h => h.includes('Preço') || h.includes('venda')) || headers[3];
    const hFoto = headers.find(h => h.includes('Foto') || h.includes('imagem')) || '';

    const produtosFiltrados = obterProdutosFiltradosCarrossel();

    const totalPaginas = Math.ceil(produtosFiltrados.length / itensPorPagina);
    if (indicePaginaCarrossel >= totalPaginas && totalPaginas > 0) indicePaginaCarrossel = 0;

    const inicio = indicePaginaCarrossel * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const produtosPagina = produtosFiltrados.slice(inicio, fim);

    const assinaturaPagina = JSON.stringify({
        pagina: indicePaginaCarrossel,
        itensPorPagina,
        termo: termoPesquisaCarrossel,
        total: produtosFiltrados.length,
        codigos: produtosPagina.map(produto => String(produto[hCod] || "")),
        fotos: produtosPagina.map(produto => String(hFoto ? produto[hFoto] || "" : ""))
    });

    if (assinaturaPagina === assinaturaUltimaPaginaCarrossel) {
        return;
    }

    let html = '';
    if (produtosPagina.length === 0) {
        const mensagem = erroCarregamentoPlanilha
            ? `Erro ao carregar a planilha: ${erroCarregamentoPlanilha}`
            : termoPesquisaCarrossel
                ? 'Nenhum produto encontrado para esta pesquisa.'
                : 'Nenhum produto foi encontrado na aba produto.';

        const complementoPesquisa = termoPesquisaCarrossel
            ? `<p class="carrossel-sem-resultado-dica">
                   Confira a escrita ou tente outra combinação de palavras.<br>
                   Ex.: <strong>cimento votoran</strong>, <strong>piso branco</strong> ou o código do produto.
               </p>
               <button class="btn-controle-carrossel" type="button"
                   onclick="document.getElementById('pesquisaCarrossel').value=''; termoPesquisaCarrossel=''; selecionarNovoLoteVitrine(); renderizarPaginaCarrossel();">
                   Limpar pesquisa
               </button>`
            : `<button class="btn-controle-carrossel" onclick="recarregarProdutos()">Tentar novamente</button>`;

        html = `<div class="carrossel-sem-resultado">
            <div class="carrossel-sem-resultado-icone">${termoPesquisaCarrossel ? '😕' : '📦'}</div>
            <p>${mensagem}</p>
            ${complementoPesquisa}
        </div>`;
    } else {
        produtosPagina.forEach(p => {
            const fotoHtml = gerarImagemCarrossel(
                hFoto ? p[hFoto] : "",
                p[hDesc] || "Produto"
            );

            html += `
            <div class="card-quadrado-vitrine" 
                 onclick='iniciarFluxoCliente(${JSON.stringify(String(p[hCod] || ""))}, ${JSON.stringify(String(p[hDesc] || ""))})' 
                 onmouseenter="pausarCarrosselPorHover()" 
                 onmouseleave="retomarCarrosselAposHover(this)">
                <div class="vitrine-foto-container">${fotoHtml}</div>
                <div class="vitrine-info">
                    <div class="vitrine-marca">${p[hMarca] || ''}</div>
                    <div class="vitrine-descricao">${p[hDesc] || ''}</div>
                </div>
                <div class="vitrine-rodape-preco">
                    <span class="vitrine-codigo">Cód: ${p[hCod] || ''}</span>
                    <div class="vitrine-precos">
                        <div class="vitrine-preco-prazo">
                            <small>Preço a prazo</small>
                            <strong>${formatarMoeda(moedaParaNumero(p[hPreco]))}</strong>
                        </div>
                        <div class="vitrine-preco-vista">
                            <small>À vista (4,9% de desconto)</small>
                            <strong>${formatarMoeda(calcularPrecoAVista(p[hPreco]))}</strong>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }

    document.getElementById('containerGradeVitrine').innerHTML = html;
    configurarErrosImagemCarrossel();
    assinaturaUltimaPaginaCarrossel = assinaturaPagina;
        atualizarSetasLateraisCarrossel();

    document.getElementById('contadorVitrine').textContent = 
        produtosFiltrados.length === 0
            ? 'Nenhum resultado'
            : termoPesquisaCarrossel
                ? `Página ${indicePaginaCarrossel + 1} de ${totalPaginas} (${produtosFiltrados.length} encontrados)`
                : `${produtosPagina.length} produtos nesta visualização`;

    // A vitrine não troca automaticamente.
    } catch (erro) {
        console.error("Erro ao montar a vitrine:", erro);

        if (typeof mostrarEstadoCarrossel === "function") {
            mostrarEstadoCarrossel(
                "Etapa 3/3 falhou — erro ao montar os produtos",
                erro && erro.message ? erro.message : "Erro desconhecido ao renderizar a vitrine.",
                true
            );
        }
    }
}

function pausarCarrosselPorHover() {
    pausaPorHover = true;
    pausarTimerCarrossel();
}

function retomarCarrosselAposHover(card) {
    if (card && card.classList.contains('ativo-clique')) return;
    pausaPorHover = false;
}

function alternarDestaqueCard(card) {
    document.querySelectorAll('.card-quadrado-vitrine.ativo-clique').forEach(outro => {
        if (outro !== card) outro.classList.remove('ativo-clique');
    });

    card.classList.toggle('ativo-clique');
    pausaPorHover = card.classList.contains('ativo-clique');

    if (!pausaPorHover) renderizarPaginaCarrossel();
}

async function recarregarProdutos() {
    const botoes = document.querySelectorAll(
        '.carrossel-estado-carregamento button, .carrossel-sem-resultado button'
    );

    botoes.forEach(botao => {
        botao.disabled = true;
        botao.textContent = 'Carregando...';
    });

    carrosselAtivo = true;
    const carregou = await carregarDadosPlanilha();

    if (carregou) {
        pausaPorHover = false;
        selecionarNovoLoteVitrine();
        renderizarPaginaCarrossel();
    }
}

function mudarSlideCarrossel(direcao) {
    if (!carrosselAtivo) return;

    pausarTimerCarrossel();
    pausaPorHover = false;

    const existePesquisa =
        String(termoPesquisaCarrossel || "").trim() !== "";

    if (existePesquisa) {
        const produtosAtuais = obterProdutosFiltradosCarrossel();
        const totalPaginas = Math.max(
            1,
            Math.ceil(produtosAtuais.length / obterQuantidadeProdutosVitrine())
        );

        indicePaginaCarrossel =
            (indicePaginaCarrossel + direcao + totalPaginas) % totalPaginas;

        assinaturaUltimaPaginaCarrossel = "";
        renderizarPaginaCarrossel();
        return;
    }

    if (direcao > 0) {
        if (indiceHistoricoLoteVitrine < historicoLotesVitrine.length - 1) {
            indiceHistoricoLoteVitrine++;
            produtosLoteVitrine =
                historicoLotesVitrine[indiceHistoricoLoteVitrine];
        } else {
            selecionarNovoLoteVitrine();
        }
    } else if (
        direcao < 0 &&
        indiceHistoricoLoteVitrine > 0
    ) {
        indiceHistoricoLoteVitrine--;
        produtosLoteVitrine =
            historicoLotesVitrine[indiceHistoricoLoteVitrine];
    }

    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";
    renderizarPaginaCarrossel();

    atualizarSetasLateraisCarrossel();
    window.scrollTo({ top: 0, behavior: "smooth" });
}
function abrirInstrucoesCarrossel() {
    const telaProdutos = document.getElementById('telaProdutosCarrossel');
    const telaInstrucoes = document.getElementById('telaInstrucoesCarrossel');

    if (!telaProdutos || !telaInstrucoes) return;

    telaProdutos.classList.remove('ativa');
    telaProdutos.setAttribute('aria-hidden', 'true');

    telaInstrucoes.classList.add('ativa');
    telaInstrucoes.setAttribute('aria-hidden', 'false');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarAosProdutosCarrossel() {
    const telaProdutos = document.getElementById('telaProdutosCarrossel');
    const telaInstrucoes = document.getElementById('telaInstrucoesCarrossel');

    if (!telaProdutos || !telaInstrucoes) return;

    telaInstrucoes.classList.remove('ativa');
    telaInstrucoes.setAttribute('aria-hidden', 'true');

    telaProdutos.classList.add('ativa');
    telaProdutos.setAttribute('aria-hidden', 'false');

    renderizarPaginaCarrossel();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
        const campoPesquisa = document.getElementById('pesquisaCarrossel');
        if (campoPesquisa) campoPesquisa.focus();
    }, 350);
}



document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
        pausarTimerCarrossel();
    }
});


function renovarVitrineAleatoria() {
    pausarTimerCarrossel();

    termoPesquisaCarrossel = "";

    const campoPesquisa = document.getElementById("pesquisaCarrossel");
    if (campoPesquisa) campoPesquisa.value = "";

    selecionarNovoLoteVitrine();
    renderizarPaginaCarrossel();
}

document.addEventListener('keydown', function(evento) {
    if (evento.key !== 'Escape') return;

    const telaInstrucoes = document.getElementById('telaInstrucoesCarrossel');
    if (telaInstrucoes && telaInstrucoes.classList.contains('ativa')) {
        voltarAosProdutosCarrossel();
    }
});

window.addEventListener("resize", () => {
        const novaQuantidade = obterQuantidadeProdutosVitrine();

        aplicarEstiloVitrineResponsiva();

        if (novaQuantidade !== itensPorPagina) {
            itensPorPagina = novaQuantidade;
            produtosLoteVitrine = [];
            historicoLotesVitrine = [];
            indiceHistoricoLoteVitrine = -1;
            indicePaginaCarrossel = 0;
            assinaturaUltimaPaginaCarrossel = "";

            selecionarNovoLoteVitrine();
            renderizarPaginaCarrossel();
        }
    });
