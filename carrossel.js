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

function nomeFotoPermitidoCarrossel(valor) {
    const texto = String(valor == null ? "" : valor).trim();

    if (!texto) return false;

    const semParametros = texto.split(/[?#]/, 1)[0];
    const nomeArquivo = semParametros
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        .trim();

    // Só nomes reais de arquivo JPG/PNG são considerados fotos.
    // Isso impede que valores como SIM, NÃO, 1 etc. gerem requisições.
    if (!/\.(?:jpg|png)$/i.test(nomeArquivo)) {
        return false;
    }

    // Regra SICLAR: arquivos puramente numéricos não devem sequer ser procurados.
    // Bloqueados: 123.jpg, 123.png, imagens/123.jpg.
    // Permitidos: a123.jpg, a123.png, cimento votoran.jpg.
    if (/^\d+\.(?:jpg|png)$/i.test(nomeArquivo)) {
        return false;
    }

    return true;
}

function obterCabecalhoArquivoFotoCarrossel() {
    const candidatos = headers.filter(cabecalho => {
        const chave = String(cabecalho || "").toLowerCase();
        return chave.includes("foto") || chave.includes("imagem");
    });

    if (!candidatos.length) return "";

    let melhorCabecalho = "";
    let maiorQuantidade = 0;

    candidatos.forEach(cabecalho => {
        let quantidade = 0;

        for (const produto of (Array.isArray(dadosGlobais) ? dadosGlobais : [])) {
            if (nomeFotoPermitidoCarrossel(produto && produto[cabecalho])) {
                quantidade += 1;
            }
        }

        if (quantidade > maiorQuantidade) {
            maiorQuantidade = quantidade;
            melhorCabecalho = cabecalho;
        }
    });

    // Só retorna uma coluna se ela realmente contiver ao menos um arquivo válido.
    // Assim uma coluna com SIM/NÃO nunca será usada como caminho de imagem.
    return maiorQuantidade > 0 ? melhorCabecalho : "";
}

function obterUrlImagemCarrossel(valor) {
    const texto = String(valor == null ? "" : valor).trim();

    // Regra SICLAR: só tenta carregar nomes de foto permitidos.
    // 123.jpg / 123.png são barrados antes de qualquer requisição.
    if (!nomeFotoPermitidoCarrossel(texto)) return "";

    const caminhoLimpo = texto
        .replace(/\\/g, "/")
        .replace(/^\.\//, "");

    // URLs completas continuam válidas.
    if (/^https?:\/\//i.test(caminhoLimpo)) {
        return imagensComFalhaCarrossel.has(caminhoLimpo)
            ? ""
            : caminhoLimpo;
    }

    // Aceita tanto "a123.jpg" quanto "imagens/a123.jpg".
    // Se vier apenas o nome, acrescenta a pasta imagens sem consultar o GitHub antes.
    const caminhoImagem =
        caminhoLimpo.toLowerCase().startsWith("imagens/")
            ? caminhoLimpo
            : "imagens/" + caminhoLimpo;

    const base =
        window.location.href.substring(
            0,
            window.location.href.lastIndexOf("/") + 1
        );

    const url = base + caminhoImagem;

    return imagensComFalhaCarrossel.has(url)
        ? ""
        : url;
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

    const quantidade =
        obterQuantidadeProdutosVitrine();

    const cabecalhoFoto =
        obterCabecalhoArquivoFotoCarrossel();

    const produtoTemFoto = produto => {
        if (!cabecalhoFoto) return false;

        const valorFoto = String(
            produto[cabecalhoFoto] || ""
        ).trim();

        if (!valorFoto) return false;

        return nomeFotoPermitidoCarrossel(valorFoto);
    };

    const obterCodigo = produto =>
        String(
            produto[cabecalhoCodigo] || ""
        ).trim();

    let recentes =
        new Set(codigosRecentesVitrine);

    const todosComFoto = base.filter(produto => {
        const codigo = obterCodigo(produto);
        return codigo && produtoTemFoto(produto);
    });

    const todosSemFoto = base.filter(produto => {
        const codigo = obterCodigo(produto);
        return codigo && !produtoTemFoto(produto);
    });

    /*
      REGRA SICLAR DAS FOTOS:
      1) enquanto existir qualquer produto COM FOTO VÁLIDA ainda não exibido,
         a visualização contém SOMENTE produtos com foto;
      2) a última visualização de fotos pode ter menos cartões e NÃO é
         completada com produtos sem foto;
      3) somente depois de esgotar todas as fotos válidas começam os
         produtos sem foto;
      4) nomes puramente numéricos, como 123.jpg / 123.png, já são
         classificados como sem foto por nomeFotoPermitidoCarrossel().
    */
    let candidatosComFoto = todosComFoto.filter(
        produto => !recentes.has(obterCodigo(produto))
    );

    let novoLote = [];

    if (candidatosComFoto.length) {
        novoLote = embaralharProdutosCarrossel(
            candidatosComFoto
        ).slice(0, quantidade);
    } else {
        let candidatosSemFoto = todosSemFoto.filter(
            produto => !recentes.has(obterCodigo(produto))
        );

        if (!candidatosSemFoto.length) {
            /*
              Terminou também o grupo sem foto. Reinicia o ciclo completo,
              voltando a priorizar as fotos válidas.
            */
            codigosRecentesVitrine = [];
            recentes = new Set();

            if (todosComFoto.length) {
                novoLote = embaralharProdutosCarrossel(
                    todosComFoto
                ).slice(0, quantidade);
            } else {
                novoLote = embaralharProdutosCarrossel(
                    todosSemFoto
                ).slice(0, quantidade);
            }
        } else {
            novoLote = embaralharProdutosCarrossel(
                candidatosSemFoto
            ).slice(0, quantidade);
        }
    }

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
        .map(obterCodigo)
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
            obterCabecalhoArquivoFotoCarrossel();

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

/*
  ACESSO ADMINISTRATIVO NO CELULAR
  - 5 toques/cliques rápidos em "SICLAR VIRTUAL";
  - funciona com touch/pointer e mouse;
  - abre o modal de login administrativo já existente no index.html.
*/
let contadorToquesAdminSiclar = 0;
let timerToquesAdminSiclar = null;
let ultimoPointerAdminSiclar = 0;

function abrirAcessoAdminPorCincoToques() {
    const modal =
        document.getElementById("modalAcessoAdminMobile");

    if (!modal) return;

    if (typeof abrirAcessoAdminMobile === "function") {
        abrirAcessoAdminMobile();
        return;
    }

    modal.style.display = "flex";

    const usuario =
        document.getElementById("usuarioAdminMobile");

    if (usuario) {
        setTimeout(() => usuario.focus(), 100);
    }
}

function registrarToqueAdminSiclar(evento) {
    if (
        evento &&
        evento.type === "click" &&
        Date.now() - ultimoPointerAdminSiclar < 500
    ) {
        return;
    }

    if (evento && evento.type === "pointerup") {
        ultimoPointerAdminSiclar = Date.now();
    }

    contadorToquesAdminSiclar += 1;

    clearTimeout(timerToquesAdminSiclar);

    if (contadorToquesAdminSiclar >= 5) {
        contadorToquesAdminSiclar = 0;
        abrirAcessoAdminPorCincoToques();
        return;
    }

    timerToquesAdminSiclar = setTimeout(() => {
        contadorToquesAdminSiclar = 0;
    }, 2200);
}

function configurarGatilhoAdminSiclar() {
    const gatilho =
        document.getElementById("gatilhoAdminMobile");

    if (!gatilho || gatilho.dataset.adminCincoToques === "1") {
        return;
    }

    gatilho.dataset.adminCincoToques = "1";
    gatilho.style.cursor = "pointer";
    gatilho.style.userSelect = "none";
    gatilho.style.webkitUserSelect = "none";
    gatilho.style.touchAction = "manipulation";

    gatilho.addEventListener(
        "pointerup",
        registrarToqueAdminSiclar
    );

    gatilho.addEventListener(
        "click",
        registrarToqueAdminSiclar
    );
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        configurarGatilhoAdminSiclar
    );
} else {
    configurarGatilhoAdminSiclar();
}
