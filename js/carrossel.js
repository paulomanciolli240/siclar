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



const LIMITE_PRODUTOS_VITRINE = 20;
let produtosAleatoriosVitrine = [];
let cicloAutomaticoConcluido = false;

function embaralharProdutosCarrossel(lista) {
    const copia = Array.isArray(lista) ? lista.slice() : [];

    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }

    return copia;
}

function prepararProdutosAleatoriosVitrine() {
    produtosAleatoriosVitrine = embaralharProdutosCarrossel(
        Array.isArray(dadosGlobais) ? dadosGlobais : []
    ).slice(0, LIMITE_PRODUTOS_VITRINE);

    cicloAutomaticoConcluido = false;
    indicePaginaCarrossel = 0;
    assinaturaUltimaPaginaCarrossel = "";
}

function obterBaseProdutosCarrossel() {
    const existePesquisa = String(termoPesquisaCarrossel || "").trim() !== "";

    if (existePesquisa) {
        return Array.isArray(dadosGlobais) ? dadosGlobais : [];
    }

    if (produtosAleatoriosVitrine.length === 0) {
        prepararProdutosAleatoriosVitrine();
    }

    return produtosAleatoriosVitrine;
}

function calcularItensPorPaginaCarrossel() {
    const largura = window.innerWidth || document.documentElement.clientWidth || 360;

    if (largura >= 1200) return 8;
    if (largura >= 760) return 4;
    if (largura >= 520) return 2;
    return 1;
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
    carrosselAtivo = true;
    itensPorPagina = calcularItensPorPaginaCarrossel();
    prepararProdutosAleatoriosVitrine();
    document.getElementById('moduloCarrossel').style.display = 'flex';
    renderizarPaginaCarrossel();
}

function pararCarrossel() {
    carrosselAtivo = false;
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
        if (!termoPesquisaCarrossel && !pausaPorHover && produtosFiltrados.length > 0 && !document.hidden && !cicloAutomaticoConcluido) {
            timerCarrossel = setTimeout(() => {
                const totalPaginasVitrine = Math.max(
                    1,
                    Math.ceil(produtosFiltrados.length / itensPorPagina)
                );

                if (indicePaginaCarrossel + 1 >= totalPaginasVitrine) {
                    cicloAutomaticoConcluido = true;
                    pausarTimerCarrossel();
                    return;
                }

                indicePaginaCarrossel++;
                assinaturaUltimaPaginaCarrossel = "";
                renderizarPaginaCarrossel();
            }, 6000);
        }
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
                   onclick="document.getElementById('pesquisaCarrossel').value=''; termoPesquisaCarrossel=''; prepararProdutosAleatoriosVitrine(); renderizarPaginaCarrossel();">
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

    document.getElementById('contadorVitrine').textContent = 
        produtosFiltrados.length === 0 ? 'Nenhum resultado' : `Página ${indicePaginaCarrossel + 1} de ${totalPaginas} (${produtosFiltrados.length} produtos)`;

    // Só agenda próxima troca se NÃO estiver pausado
        if (!termoPesquisaCarrossel && !pausaPorHover && produtosFiltrados.length > 0 && !document.hidden && !cicloAutomaticoConcluido) {
            timerCarrossel = setTimeout(() => {
                const totalPaginasVitrine = Math.max(
                    1,
                    Math.ceil(produtosFiltrados.length / itensPorPagina)
                );

                if (indicePaginaCarrossel + 1 >= totalPaginasVitrine) {
                    cicloAutomaticoConcluido = true;
                    pausarTimerCarrossel();
                    return;
                }

                indicePaginaCarrossel++;
                assinaturaUltimaPaginaCarrossel = "";
                renderizarPaginaCarrossel();
            }, 6000);
        }
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
    if (card.classList.contains('ativo-clique')) return;

    pausaPorHover = false;

    const produtosFiltrados = obterProdutosFiltradosCarrossel();

    if (
        carrosselAtivo &&
        !termoPesquisaCarrossel &&
        produtosFiltrados.length > 0 &&
        !document.hidden &&
        !cicloAutomaticoConcluido
    ) {
        pausarTimerCarrossel();

        timerCarrossel = setTimeout(() => {
            const totalPaginasVitrine = Math.max(
                1,
                Math.ceil(produtosFiltrados.length / itensPorPagina)
            );

            if (indicePaginaCarrossel + 1 >= totalPaginasVitrine) {
                cicloAutomaticoConcluido = true;
                pausarTimerCarrossel();
                return;
            }

            indicePaginaCarrossel++;
            assinaturaUltimaPaginaCarrossel = "";
            renderizarPaginaCarrossel();
        }, 6000);
    }
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
        prepararProdutosAleatoriosVitrine();
        renderizarPaginaCarrossel();
    }
}

function mudarSlideCarrossel(d) {
    if (!carrosselAtivo) return;
    pausarTimerCarrossel();
    pausaPorHover = false;

    const totalProdutos = obterProdutosFiltradosCarrossel().length;
    const totalPaginas = Math.max(1, Math.ceil(totalProdutos / itensPorPagina));

    indicePaginaCarrossel = (indicePaginaCarrossel + d + totalPaginas) % totalPaginas;
    assinaturaUltimaPaginaCarrossel = "";
    renderizarPaginaCarrossel();
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
        return;
    }

    if (
        carrosselAtivo &&
        !termoPesquisaCarrossel &&
        !pausaPorHover &&
        !cicloAutomaticoConcluido
    ) {
        assinaturaUltimaPaginaCarrossel = "";
        renderizarPaginaCarrossel();
    }
});



function renovarVitrineAleatoria() {
    pausarTimerCarrossel();
    termoPesquisaCarrossel = "";

    const campoPesquisa = document.getElementById("pesquisaCarrossel");
    if (campoPesquisa) campoPesquisa.value = "";

    prepararProdutosAleatoriosVitrine();
    renderizarPaginaCarrossel();
}

document.addEventListener('keydown', function(evento) {
    if (evento.key !== 'Escape') return;

    const telaInstrucoes = document.getElementById('telaInstrucoesCarrossel');
    if (telaInstrucoes && telaInstrucoes.classList.contains('ativa')) {
        voltarAosProdutosCarrossel();
    }
});