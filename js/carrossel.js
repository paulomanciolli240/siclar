"use strict";

/*
  SICLAR — VITRINE ESTÁVEL

  Regras:
  - sem troca automática;
  - uma única linha de produtos;
  - 5 produtos somente em telas muito largas;
  - 4 produtos no computador/notebook;
  - 2 produtos no tablet;
  - 1 produto no celular;
  - Próxima sorteia uma nova visualização;
  - Anterior retorna à visualização anterior;
  - a pesquisa é paginada;
  - não cria setas por JavaScript;
  - usa apenas os controles já existentes no index.html;
  - não procura fotos pelo código do produto.
*/

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

/*
  SALVO-CONDUTO AUTOMÁTICO DE FOTOS
  ---------------------------------
  Ao abrir o site, o SICLAR consulta UMA única vez a árvore pública
  do repositório no GitHub e registra somente os arquivos que realmente
  existem dentro da pasta imagens/.

  Depois dessa consulta:
  - foto existente: pode ser carregada;
  - foto inexistente: mostra "Sem imagem" SEM fazer requisição 404;
  - foto nova enviada ao GitHub: será reconhecida na próxima abertura
    do site, sem arquivo .bat e sem lista manual.
*/
const GITHUB_REPOSITORIO_FOTOS =
    "https://api.github.com/repos/paulomanciolli240/siclar/git/trees/main?recursive=1";

const CHAVE_CACHE_SALVO_CONDUTO_FOTOS =
    "siclar_fotos_existentes_github_v1";

const fotosAutorizadasCarrossel = new Set();

let salvoCondutoFotosCarregado = false;
let promessaSalvoCondutoFotos = null;

const MAXIMO_CODIGOS_RECENTES = 240;

let produtosLoteVitrine = [];
let historicoLotesVitrine = [];
let indiceHistoricoLoteVitrine = -1;
let codigosRecentesVitrine = [];
let assinaturaUltimaPaginaCarrossel = "";
let quantidadeAtualVitrine = 0;

function escaparHtmlCarrossel(valor) {
    return String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obterQuantidadeProdutosVitrine() {
    const largura =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        1200;

    if (largura >= 1600) return 5;
    if (largura >= 900) return 4;
    if (largura >= 600) return 2;
    return 1;
}

function calcularItensPorPaginaCarrossel() {
    return obterQuantidadeProdutosVitrine();
}

function pausarTimerCarrossel() {
    if (timerCarrossel) {
        clearTimeout(timerCarrossel);
        timerCarrossel = null;
    }
}

function aplicarEstiloVitrineEstavel() {
    let estilo = document.getElementById("siclar-vitrine-estavel-css");

    if (!estilo) {
        estilo = document.createElement("style");
        estilo.id = "siclar-vitrine-estavel-css";
        estilo.textContent = `
            #telaProdutosCarrossel {
                min-height: 100vh !important;
            }

            .carrossel-grade-container {
                width: 100% !important;
                overflow: visible !important;
            }

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
                width: min(1280px, calc(100% - 110px)) !important;
                margin: 28px auto 12px !important;
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

            #containerGradeVitrine .card-quadrado-vitrine:hover,
            #containerGradeVitrine .card-quadrado-vitrine:focus-visible {
                transform: translateY(-3px) !important;
                outline: 3px solid rgba(249, 115, 22, .34) !important;
                outline-offset: 2px !important;
            }

            #containerGradeVitrine .vitrine-foto-container {
                width: 100% !important;
                height: 170px !important;
                min-height: 170px !important;
                overflow: hidden !important;
            }

            #containerGradeVitrine .vitrine-foto-container img {
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
            }

            #containerGradeVitrine .vitrine-info {
                flex: 1 1 auto !important;
            }

            #containerGradeVitrine .vitrine-rodape-preco {
                margin-top: auto !important;
            }

            /*
              Estes são os controles reais presentes no index.html.
              Eles permanecem visíveis logo abaixo da única linha.
            */
            #moduloCarrossel .carrossel-controles-inferior {
                position: relative !important;
                z-index: 30 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 16px !important;
                width: 100% !important;
                margin: 10px auto 24px !important;
                padding: 10px 16px !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            #moduloCarrossel .carrossel-controles-inferior .btn-controle-carrossel {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-width: 126px !important;
                min-height: 42px !important;
                padding: 10px 16px !important;
                cursor: pointer !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            #moduloCarrossel .carrossel-controles-inferior .btn-controle-carrossel:disabled {
                opacity: .35 !important;
                cursor: default !important;
            }

            #contadorVitrine {
                min-width: 230px !important;
                text-align: center !important;
            }

            @media (max-width: 899px) {
                #containerGradeVitrine {
                    width: min(760px, calc(100% - 44px)) !important;
                    gap: 20px !important;
                }
            }

            @media (max-width: 599px) {
                #containerGradeVitrine {
                    width: min(390px, calc(100% - 28px)) !important;
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

                #moduloCarrossel .carrossel-controles-inferior {
                    gap: 8px !important;
                    padding: 8px !important;
                }

                #moduloCarrossel .carrossel-controles-inferior .btn-controle-carrossel {
                    min-width: 98px !important;
                    padding: 9px 10px !important;
                    font-size: 12px !important;
                }

                #contadorVitrine {
                    min-width: 0 !important;
                    font-size: 11px !important;
                }
            }
        `;

        document.head.appendChild(estilo);
    }

    quantidadeAtualVitrine = obterQuantidadeProdutosVitrine();

    document.documentElement.style.setProperty(
        "--siclar-colunas-vitrine",
        String(quantidadeAtualVitrine)
    );
}


function normalizarReferenciaFotoCarrossel(valor) {
    let texto = String(valor == null ? "" : valor)
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "")
        .toLowerCase();

    try {
        texto = decodeURIComponent(texto);
    } catch (erro) {
        // Mantém a referência original se não houver codificação de URL.
    }

    return texto;
}

function registrarFotoAutorizadaCarrossel(valor) {
    const referencia =
        normalizarReferenciaFotoCarrossel(valor);

    if (!referencia) return;

    fotosAutorizadasCarrossel.add(referencia);

    if (referencia.startsWith("imagens/")) {
        fotosAutorizadasCarrossel.add(
            referencia.slice("imagens/".length)
        );
    } else {
        fotosAutorizadasCarrossel.add(
            "imagens/" + referencia
        );
    }
}

function carregarCacheSalvoCondutoFotos() {
    try {
        const texto =
            localStorage.getItem(
                CHAVE_CACHE_SALVO_CONDUTO_FOTOS
            );

        if (!texto) return false;

        const lista = JSON.parse(texto);

        if (!Array.isArray(lista)) {
            return false;
        }

        fotosAutorizadasCarrossel.clear();
        lista.forEach(registrarFotoAutorizadaCarrossel);

        return lista.length > 0;
    } catch (erro) {
        return false;
    }
}

function salvarCacheSalvoCondutoFotos(lista) {
    try {
        localStorage.setItem(
            CHAVE_CACHE_SALVO_CONDUTO_FOTOS,
            JSON.stringify(lista)
        );
    } catch (erro) {
        // Se o navegador bloquear localStorage, o site continua normalmente.
    }
}

function fotoPossuiSalvoConduto(valorFoto) {
    if (!salvoCondutoFotosCarregado) {
        return false;
    }

    const referencia =
        normalizarReferenciaFotoCarrossel(
            valorFoto
        );

    if (!referencia) return false;

    if (
        fotosAutorizadasCarrossel.has(
            referencia
        )
    ) {
        return true;
    }

    if (
        referencia.startsWith("imagens/") &&
        fotosAutorizadasCarrossel.has(
            referencia.slice("imagens/".length)
        )
    ) {
        return true;
    }

    if (
        !referencia.startsWith("imagens/") &&
        fotosAutorizadasCarrossel.has(
            "imagens/" + referencia
        )
    ) {
        return true;
    }

    return false;
}

async function carregarSalvoCondutoFotosGitHub() {
    if (promessaSalvoCondutoFotos) {
        return promessaSalvoCondutoFotos;
    }

    /*
      Usa o último salvo-conduto conhecido imediatamente, caso exista.
      Em seguida faz UMA consulta ao GitHub para atualizar a lista.
    */
    const possuiCache =
        carregarCacheSalvoCondutoFotos();

    if (possuiCache) {
        salvoCondutoFotosCarregado = true;
    }

    promessaSalvoCondutoFotos = (async () => {
        try {
            const resposta = await fetch(
                GITHUB_REPOSITORIO_FOTOS,
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/vnd.github+json"
                    }
                }
            );

            if (!resposta.ok) {
                throw new Error(
                    "GitHub respondeu HTTP " +
                    resposta.status
                );
            }

            const dados = await resposta.json();

            if (
                !dados ||
                !Array.isArray(dados.tree)
            ) {
                throw new Error(
                    "Resposta inválida da árvore do GitHub."
                );
            }

            if (dados.truncated) {
                throw new Error(
                    "A lista de arquivos do GitHub veio incompleta."
                );
            }

            const extensoesPermitidas =
                /\.(jpg|jpeg|png|webp|gif|avif)$/i;

            const listaFotos = dados.tree
                .filter(item =>
                    item &&
                    item.type === "blob" &&
                    typeof item.path === "string" &&
                    item.path
                        .toLowerCase()
                        .startsWith("imagens/") &&
                    extensoesPermitidas.test(
                        item.path
                    )
                )
                .map(item => item.path);

            fotosAutorizadasCarrossel.clear();

            listaFotos.forEach(
                registrarFotoAutorizadaCarrossel
            );

            salvarCacheSalvoCondutoFotos(
                listaFotos
            );

            salvoCondutoFotosCarregado = true;

            /*
              Uma imagem confirmada pelo GitHub deve ganhar nova chance,
              mesmo que tenha falhado antes nesta mesma sessão.
            */
            imagensComFalhaCarrossel.clear();

            assinaturaUltimaPaginaCarrossel = "";

            if (
                carrosselAtivo &&
                typeof renderizarPaginaCarrossel ===
                    "function"
            ) {
                renderizarPaginaCarrossel();
            }

            console.info(
                "SICLAR: salvo-conduto atualizado com " +
                listaFotos.length +
                " foto(s) existentes no GitHub."
            );

            return true;
        } catch (erro) {
            /*
              Se a API do GitHub estiver indisponível ou atingir limite,
              usa a última lista salva no navegador. Sem cache, bloqueia
              tentativas de fotos para não gerar uma tempestade de 404.
            */
            salvoCondutoFotosCarregado = true;

            console.warn(
                "SICLAR: não foi possível atualizar o salvo-conduto de fotos. " +
                (
                    possuiCache
                        ? "Usando a última lista salva."
                        : "As fotos ficarão bloqueadas nesta abertura para proteger o site."
                ),
                erro
            );

            return possuiCache;
        }
    })();

    return promessaSalvoCondutoFotos;
}

function obterUrlImagemCarrossel(valor) {
    const texto = String(
        valor == null ? "" : valor
    ).trim();

    if (!texto) return "";

    /*
      Só resolve/carrega imagens que o GitHub confirmou que existem.
      Produtos fora do salvo-conduto mostram "Sem imagem" e não geram 404.
    */
    if (!fotoPossuiSalvoConduto(texto)) {
        return "";
    }

    try {
        const url = resolverUrlImagem(texto);

        if (
            !url ||
            imagensComFalhaCarrossel.has(url)
        ) {
            return "";
        }

        return url;
    } catch (erro) {
        return "";
    }
}

function gerarImagemCarrossel(valorFoto, descricao) {
    const url = obterUrlImagemCarrossel(valorFoto);

    if (!url) {
        return `
            <img
                src="${IMAGEM_SEM_FOTO_SICLAR}"
                alt="Sem imagem"
                loading="lazy"
                decoding="async"
            >
        `;
    }

    return `
        <img
            src="${escaparHtmlCarrossel(url)}"
            alt="${escaparHtmlCarrossel(descricao || "Produto")}"
            loading="lazy"
            decoding="async"
            data-imagem-carrossel="${escaparHtmlCarrossel(url)}"
        >
    `;
}

function configurarErrosImagemCarrossel() {
    document
        .querySelectorAll(
            "#containerGradeVitrine img[data-imagem-carrossel]"
        )
        .forEach(imagem => {
            imagem.addEventListener(
                "error",
                () => {
                    const url =
                        imagem.dataset.imagemCarrossel ||
                        imagem.src;

                    if (url) {
                        imagensComFalhaCarrossel.add(url);
                    }

                    imagem.removeAttribute(
                        "data-imagem-carrossel"
                    );

                    imagem.src =
                        IMAGEM_SEM_FOTO_SICLAR;

                    imagem.alt = "Sem imagem";
                },
                { once: true }
            );
        });
}

function embaralharProdutosCarrossel(lista) {
    const copia = Array.isArray(lista)
        ? lista.slice()
        : [];

    for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [copia[i], copia[j]] = [
            copia[j],
            copia[i]
        ];
    }

    return copia;
}

function obterCabecalhoCodigoCarrossel() {
    return (
        headers.find(cabecalho =>
            String(cabecalho || "").includes("Cód") ||
            String(cabecalho || "")
                .toLowerCase()
                .includes("codigo")
        ) ||
        headers[0]
    );
}

function selecionarNovoLoteVitrine() {
    const base = filtrarProdutosPorModoCatalogo(
        Array.isArray(dadosGlobais)
            ? dadosGlobais.filter(Boolean)
            : []
    );

    const cabecalhoCodigo =
        obterCabecalhoCodigoCarrossel();

    if (!base.length) {
        produtosLoteVitrine = [];
        assinaturaUltimaPaginaCarrossel = "";
        return;
    }

    const recentes =
        new Set(codigosRecentesVitrine);

    let candidatos = base.filter(produto => {
        const codigo = String(
            produto[cabecalhoCodigo] || ""
        ).trim();

        return codigo && !recentes.has(codigo);
    });

    const quantidade =
        obterQuantidadeProdutosVitrine();

    if (candidatos.length < quantidade) {
        codigosRecentesVitrine = [];
        candidatos = base.slice();
    }

    const novoLote =
        embaralharProdutosCarrossel(candidatos)
            .slice(0, quantidade);

    if (
        indiceHistoricoLoteVitrine <
        historicoLotesVitrine.length - 1
    ) {
        historicoLotesVitrine =
            historicoLotesVitrine.slice(
                0,
                indiceHistoricoLoteVitrine + 1
            );
    }

    historicoLotesVitrine.push(novoLote);

    indiceHistoricoLoteVitrine =
        historicoLotesVitrine.length - 1;

    produtosLoteVitrine = novoLote;

    const codigos = novoLote
        .map(produto =>
            String(
                produto[cabecalhoCodigo] || ""
            ).trim()
        )
        .filter(Boolean);

    codigosRecentesVitrine = [
        ...codigosRecentesVitrine,
        ...codigos
    ].slice(-MAXIMO_CODIGOS_RECENTES);

    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";
}

function obterBaseProdutosCarrossel() {
    const existePesquisa =
        String(
            termoPesquisaCarrossel || ""
        ).trim() !== "";

    if (existePesquisa) {
        return filtrarProdutosPorModoCatalogo(
            Array.isArray(dadosGlobais)
                ? dadosGlobais
                : []
        );
    }

    if (!produtosLoteVitrine.length) {
        selecionarNovoLoteVitrine();
    }

    return produtosLoteVitrine;
}

function obterProdutosFiltradosCarrossel() {
    const hCod =
        headers.find(cabecalho =>
            String(cabecalho || "").includes("Cód") ||
            String(cabecalho || "")
                .toLowerCase()
                .includes("codigo")
        ) ||
        headers[0];

    const hDesc =
        headers.find(cabecalho =>
            String(cabecalho || "").includes("Desc") ||
            String(cabecalho || "")
                .toLowerCase()
                .includes("nome")
        ) ||
        headers[1];

    const hMarca =
        headers.find(cabecalho =>
            String(cabecalho || "")
                .toLowerCase()
                .includes("marca")
        ) ||
        headers[2];

    return ordenarProdutosPorPesquisa(
        obterBaseProdutosCarrossel(),
        termoPesquisaCarrossel,
        [hCod, hDesc, hMarca].filter(Boolean)
    );
}

function atualizarControlesCarrossel(
    existePesquisa,
    totalPaginas
) {
    const controles =
        document.querySelector(
            ".carrossel-controles-inferior"
        );

    if (!controles) return;

    const botoes =
        controles.querySelectorAll("button");

    const botaoAnterior = botoes[0];
    const botaoProxima = botoes[1];

    if (botaoAnterior) {
        botaoAnterior.disabled =
            !existePesquisa &&
            indiceHistoricoLoteVitrine <= 0;
    }

    if (botaoProxima) {
        botaoProxima.disabled =
            existePesquisa &&
            totalPaginas <= 1;
    }
}

function renderizarPaginaCarrossel() {
    try {
        aplicarEstiloVitrineEstavel();
        pausarTimerCarrossel();

        if (!carrosselAtivo) return;

        itensPorPagina =
            obterQuantidadeProdutosVitrine();

        const hCod =
            headers.find(cabecalho =>
                String(cabecalho || "").includes("Cód") ||
                String(cabecalho || "")
                    .toLowerCase()
                    .includes("codigo")
            ) ||
            headers[0];

        const hDesc =
            headers.find(cabecalho =>
                String(cabecalho || "").includes("Desc") ||
                String(cabecalho || "")
                    .toLowerCase()
                    .includes("nome")
            ) ||
            headers[1];

        const hMarca =
            headers.find(cabecalho =>
                String(cabecalho || "")
                    .toLowerCase()
                    .includes("marca")
            ) ||
            headers[2];

        const hPreco =
            headers.find(cabecalho =>
                String(cabecalho || "").includes("Preço") ||
                String(cabecalho || "")
                    .toLowerCase()
                    .includes("venda")
            ) ||
            headers[3];

        const hFoto =
            headers.find(cabecalho =>
                String(cabecalho || "").includes("Foto") ||
                String(cabecalho || "")
                    .toLowerCase()
                    .includes("imagem")
            ) ||
            "";

        const existePesquisa =
            String(
                termoPesquisaCarrossel || ""
            ).trim() !== "";

        const produtosFiltrados =
            obterProdutosFiltradosCarrossel();

        const totalPaginas =
            existePesquisa
                ? Math.max(
                    1,
                    Math.ceil(
                        produtosFiltrados.length /
                        itensPorPagina
                    )
                )
                : 1;

        if (existePesquisa) {
            indicePaginaCarrossel = Math.max(
                0,
                Math.min(
                    indicePaginaCarrossel,
                    totalPaginas - 1
                )
            );
        } else {
            indicePaginaCarrossel = 0;
        }

        const inicio =
            existePesquisa
                ? indicePaginaCarrossel *
                  itensPorPagina
                : 0;

        const produtosPagina =
            produtosFiltrados.slice(
                inicio,
                inicio + itensPorPagina
            );

        const assinatura = JSON.stringify({
            pesquisa: termoPesquisaCarrossel,
            pagina: indicePaginaCarrossel,
            historico: indiceHistoricoLoteVitrine,
            quantidade: itensPorPagina,
            codigos: produtosPagina.map(
                produto =>
                    String(
                        produto[hCod] || ""
                    )
            ),
            fotos: produtosPagina.map(
                produto =>
                    String(
                        hFoto
                            ? produto[hFoto] || ""
                            : ""
                    )
            )
        });

        if (
            assinatura ===
            assinaturaUltimaPaginaCarrossel
        ) {
            atualizarControlesCarrossel(
                existePesquisa,
                totalPaginas
            );

            return;
        }

        let html = "";

        if (!produtosPagina.length) {
            const mensagem =
                erroCarregamentoPlanilha
                    ? `Erro ao carregar a planilha: ${escaparHtmlCarrossel(erroCarregamentoPlanilha)}`
                    : existePesquisa
                        ? "Nenhum produto encontrado para esta pesquisa."
                        : "Nenhum produto foi encontrado na aba produto.";

            html = `
                <div class="carrossel-sem-resultado">
                    <div class="carrossel-sem-resultado-icone">
                        ${existePesquisa ? "😕" : "📦"}
                    </div>

                    <p>${mensagem}</p>

                    ${
                        existePesquisa
                            ? `
                                <button
                                    class="btn-controle-carrossel"
                                    type="button"
                                    onclick="limparPesquisaCarrosselEstavel()"
                                >
                                    Limpar pesquisa
                                </button>
                            `
                            : `
                                <button
                                    class="btn-controle-carrossel"
                                    type="button"
                                    onclick="recarregarProdutos()"
                                >
                                    Tentar novamente
                                </button>
                            `
                    }
                </div>
            `;
        } else {
            produtosPagina.forEach(produto => {
                const codigo =
                    String(produto[hCod] || "");

                const descricao =
                    String(produto[hDesc] || "");

                const marca =
                    String(produto[hMarca] || "");

                const foto =
                    hFoto
                        ? produto[hFoto]
                        : "";

                html += `
                    <article
                        class="card-quadrado-vitrine"
                        tabindex="0"
                        role="button"
                        aria-label="Selecionar ${escaparHtmlCarrossel(descricao)}"
                        onclick='iniciarFluxoCliente(
                            ${JSON.stringify(codigo)},
                            ${JSON.stringify(descricao)}
                        )'
                        onkeydown='
                            if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {
                                event.preventDefault();

                                iniciarFluxoCliente(
                                    ${JSON.stringify(codigo)},
                                    ${JSON.stringify(descricao)}
                                );
                            }
                        '
                    >
                        ${modoCatalogoAtual === "FUTURA" ? `
                            <div class="selo-entrega-futura">🚚 Entrega programada</div>
                        ` : ""}
                        <div class="vitrine-foto-container">
                            ${gerarImagemCarrossel(
                                foto,
                                descricao
                            )}
                        </div>

                        <div class="vitrine-info">
                            <div class="vitrine-marca">
                                ${escaparHtmlCarrossel(marca)}
                            </div>

                            <div class="vitrine-descricao">
                                ${escaparHtmlCarrossel(descricao)}
                            </div>
                        </div>

                        <div class="vitrine-rodape-preco">
                            <span class="vitrine-codigo">
                                Cód: ${escaparHtmlCarrossel(codigo)}
                            </span>

                            <div class="vitrine-precos">
                                <div class="vitrine-preco-prazo">
                                    <small>Preço a prazo</small>

                                    <strong>
                                        ${formatarMoeda(
                                            moedaParaNumero(
                                                produto[hPreco]
                                            )
                                        )}
                                    </strong>
                                </div>

                                <div class="vitrine-preco-vista">
                                    <small>
                                        À vista (4,9% de desconto)
                                    </small>

                                    <strong>
                                        ${formatarMoeda(
                                            calcularPrecoAVista(
                                                produto[hPreco]
                                            )
                                        )}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </article>
                `;
            });
        }

        const container =
            document.getElementById(
                "containerGradeVitrine"
            );

        if (container) {
            container.innerHTML = html;
        }

        configurarErrosImagemCarrossel();

        assinaturaUltimaPaginaCarrossel =
            assinatura;

        const contador =
            document.getElementById(
                "contadorVitrine"
            );

        if (contador) {
            if (!produtosFiltrados.length) {
                contador.textContent =
                    "Nenhum resultado";
            } else if (existePesquisa) {
                contador.textContent =
                    `Página ${indicePaginaCarrossel + 1} ` +
                    `de ${totalPaginas} ` +
                    `(${produtosFiltrados.length} encontrados)`;
            } else {
                contador.textContent =
                    `${produtosPagina.length} produtos nesta visualização`;
            }
        }

        atualizarControlesCarrossel(
            existePesquisa,
            totalPaginas
        );
    } catch (erro) {
        console.error(
            "Erro ao montar a vitrine:",
            erro
        );

        if (
            typeof mostrarEstadoCarrossel ===
            "function"
        ) {
            mostrarEstadoCarrossel(
                "Não foi possível montar os produtos",
                erro && erro.message
                    ? erro.message
                    : "Erro desconhecido ao renderizar a vitrine.",
                true
            );
        }
    }
}

function limparPesquisaCarrosselEstavel() {
    termoPesquisaCarrossel = "";
    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";

    const campo =
        document.getElementById(
            "pesquisaCarrossel"
        );

    if (campo) {
        campo.value = "";
    }

    selecionarNovoLoteVitrine();
    renderizarPaginaCarrossel();
}

function mudarSlideCarrossel(direcao) {
    if (!carrosselAtivo) return;

    pausarTimerCarrossel();

    const existePesquisa =
        String(
            termoPesquisaCarrossel || ""
        ).trim() !== "";

    if (existePesquisa) {
        const produtosAtuais =
            obterProdutosFiltradosCarrossel();

        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    produtosAtuais.length /
                    obterQuantidadeProdutosVitrine()
                )
            );

        indicePaginaCarrossel =
            (
                indicePaginaCarrossel +
                direcao +
                totalPaginas
            ) % totalPaginas;
    } else if (direcao > 0) {
        if (
            indiceHistoricoLoteVitrine <
            historicoLotesVitrine.length - 1
        ) {
            indiceHistoricoLoteVitrine += 1;

            produtosLoteVitrine =
                historicoLotesVitrine[
                    indiceHistoricoLoteVitrine
                ];
        } else {
            selecionarNovoLoteVitrine();
        }

        indicePaginaCarrossel = 0;
    } else if (
        direcao < 0 &&
        indiceHistoricoLoteVitrine > 0
    ) {
        indiceHistoricoLoteVitrine -= 1;

        produtosLoteVitrine =
            historicoLotesVitrine[
                indiceHistoricoLoteVitrine
            ];

        indicePaginaCarrossel = 0;
    }

    assinaturaUltimaPaginaCarrossel = "";
    renderizarPaginaCarrossel();

    const grade =
        document.querySelector(
            ".carrossel-grade-container"
        );

    if (grade) {
        grade.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

function pausarCarrosselPorHover() {
    pausarTimerCarrossel();
}

function retomarCarrosselAposHover() {
    // A vitrine não se movimenta automaticamente.
}

function alternarDestaqueCard() {
    // Mantido somente para compatibilidade.
}

async function recarregarProdutos() {
    const botoes =
        document.querySelectorAll(
            ".carrossel-estado-carregamento button, " +
            ".carrossel-sem-resultado button"
        );

    botoes.forEach(botao => {
        botao.disabled = true;
        botao.textContent = "Carregando...";
    });

    carrosselAtivo = true;

    const carregou =
        await carregarDadosPlanilha();

    if (carregou) {
        produtosLoteVitrine = [];
        historicoLotesVitrine = [];
        indiceHistoricoLoteVitrine = -1;
        codigosRecentesVitrine = [];
        indicePaginaCarrossel = 0;
        assinaturaUltimaPaginaCarrossel = "";

        selecionarNovoLoteVitrine();
        renderizarPaginaCarrossel();
    }
}

function iniciarCarrossel() {
    carrosselAtivo = true;
    pausarTimerCarrossel();
    aplicarEstiloVitrineEstavel();

    /*
      Uma única consulta à árvore do GitHub por abertura do site.
      Não consulta foto por foto.
    */
    carregarSalvoCondutoFotosGitHub();

    itensPorPagina =
        obterQuantidadeProdutosVitrine();

    if (!produtosLoteVitrine.length) {
        selecionarNovoLoteVitrine();
    }

    const modulo =
        document.getElementById(
            "moduloCarrossel"
        );

    if (modulo) {
        modulo.style.display = "flex";
    }

    renderizarPaginaCarrossel();
}

function pararCarrossel() {
    carrosselAtivo = false;
    pausarTimerCarrossel();
}

function abrirPainelAdministrativo() {
    pararCarrossel();

    document.getElementById(
        "moduloCarrossel"
    ).style.display = "none";

    document.getElementById(
        "moduloAdministrativo"
    ).style.display = "block";
}

function voltarParaCarrossel() {
    document.getElementById(
        "moduloAdministrativo"
    ).style.display = "none";

    document.getElementById(
        "moduloCarrossel"
    ).style.display = "flex";

    iniciarCarrossel();
}

function abrirInstrucoesCarrossel() {
    const telaProdutos =
        document.getElementById(
            "telaProdutosCarrossel"
        );

    const telaInstrucoes =
        document.getElementById(
            "telaInstrucoesCarrossel"
        );

    if (
        !telaProdutos ||
        !telaInstrucoes
    ) {
        return;
    }

    telaProdutos.classList.remove("ativa");
    telaProdutos.setAttribute(
        "aria-hidden",
        "true"
    );

    telaInstrucoes.classList.add("ativa");
    telaInstrucoes.setAttribute(
        "aria-hidden",
        "false"
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function voltarAosProdutosCarrossel() {
    const telaProdutos =
        document.getElementById(
            "telaProdutosCarrossel"
        );

    const telaInstrucoes =
        document.getElementById(
            "telaInstrucoesCarrossel"
        );

    if (
        !telaProdutos ||
        !telaInstrucoes
    ) {
        return;
    }

    telaInstrucoes.classList.remove("ativa");
    telaInstrucoes.setAttribute(
        "aria-hidden",
        "true"
    );

    telaProdutos.classList.add("ativa");
    telaProdutos.setAttribute(
        "aria-hidden",
        "false"
    );

    assinaturaUltimaPaginaCarrossel = "";
    renderizarPaginaCarrossel();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function renovarVitrineAleatoria() {
    pausarTimerCarrossel();

    termoPesquisaCarrossel = "";
    indicePaginaCarrossel = 0;

    const campo =
        document.getElementById(
            "pesquisaCarrossel"
        );

    if (campo) {
        campo.value = "";
    }

    selecionarNovoLoteVitrine();
    renderizarPaginaCarrossel();
}

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden) {
            pausarTimerCarrossel();
        }
    }
);

document.addEventListener(
    "keydown",
    evento => {
        if (evento.key !== "Escape") {
            return;
        }

        const telaInstrucoes =
            document.getElementById(
                "telaInstrucoesCarrossel"
            );

        if (
            telaInstrucoes &&
            telaInstrucoes.classList.contains(
                "ativa"
            )
        ) {
            voltarAosProdutosCarrossel();
        }
    }
);

window.addEventListener(
    "resize",
    () => {
        const novaQuantidade =
            obterQuantidadeProdutosVitrine();

        aplicarEstiloVitrineEstavel();

        if (
            novaQuantidade !==
            quantidadeAtualVitrine
        ) {
            quantidadeAtualVitrine =
                novaQuantidade;

            itensPorPagina =
                novaQuantidade;

            produtosLoteVitrine = [];
            historicoLotesVitrine = [];
            indiceHistoricoLoteVitrine = -1;
            indicePaginaCarrossel = 0;
            assinaturaUltimaPaginaCarrossel = "";

            selecionarNovoLoteVitrine();
            renderizarPaginaCarrossel();
        }
    }
);
