"use strict";

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
    indicePaginaCarrossel = 0;
    document.getElementById('moduloCarrossel').style.display = 'flex';
    renderizarPaginaCarrossel();
}

function pararCarrossel() {
    carrosselAtivo = false;
    if (timerCarrossel) clearTimeout(timerCarrossel);
}

function obterProdutosFiltradosCarrossel() {
    const hCod = headers.find(h => h.includes('Cód') || h.toLowerCase().includes('codigo')) || headers[0];
    const hDesc = headers.find(h => h.includes('Desc') || h.toLowerCase().includes('nome')) || headers[1];
    const hMarca = headers.find(h => h.includes('Marca') || h.toLowerCase().includes('marca')) || headers[2];

    return dadosGlobais.filter(produto => {
        if (!termoPesquisaCarrossel) return true;

        const textoProduto = [
            produto[hCod],
            produto[hDesc],
            produto[hMarca]
        ].filter(Boolean).join(' ');

        return buscaInteligente(termoPesquisaCarrossel, textoProduto);
    });
}

function renderizarPaginaCarrossel() {
    try {
        // Sempre limpa o temporizador primeiro
        if (timerCarrossel) clearTimeout(timerCarrossel);

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
                   onclick="document.getElementById('pesquisaCarrossel').value=''; termoPesquisaCarrossel=''; indicePaginaCarrossel=0; renderizarPaginaCarrossel();">
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
            let fotoHtml = hFoto && p[hFoto] && p[hFoto].toUpperCase() !== 'NÃO' 
                ? `<img src="${resolverUrlImagem(p[hFoto])}" alt="Produto" onerror="this.src='https://via.placeholder.com/300?text=Sem+Imagem'">` 
                : `<div style="color:#94a3b8; font-size:11px;">Sem imagem</div>`;

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
    document.getElementById('contadorVitrine').textContent = 
        produtosFiltrados.length === 0 ? 'Nenhum resultado' : `Página ${indicePaginaCarrossel + 1} de ${totalPaginas} (${produtosFiltrados.length} produtos)`;

    // Só agenda próxima troca se NÃO estiver pausado
        if (!termoPesquisaCarrossel && !pausaPorHover && produtosFiltrados.length > 0) {
            timerCarrossel = setTimeout(() => {
                indicePaginaCarrossel++;
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
    if (timerCarrossel) clearTimeout(timerCarrossel);
}

function retomarCarrosselAposHover(card) {
    if (card.classList.contains('ativo-clique')) return;
    pausaPorHover = false;
    renderizarPaginaCarrossel();
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
        indicePaginaCarrossel = 0;
        pausaPorHover = false;
        renderizarPaginaCarrossel();
    }
}

function mudarSlideCarrossel(d) {
    if (!carrosselAtivo) return;
    clearTimeout(timerCarrossel);
    pausaPorHover = false;

    const totalProdutos = obterProdutosFiltradosCarrossel().length;
    const totalPaginas = Math.max(1, Math.ceil(totalProdutos / itensPorPagina));

    indicePaginaCarrossel = (indicePaginaCarrossel + d + totalPaginas) % totalPaginas;
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

document.addEventListener('keydown', function(evento) {
    if (evento.key !== 'Escape') return;

    const telaInstrucoes = document.getElementById('telaInstrucoesCarrossel');
    if (telaInstrucoes && telaInstrucoes.classList.contains('ativa')) {
        voltarAosProdutosCarrossel();
    }
});
