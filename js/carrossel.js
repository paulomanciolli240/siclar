"use strict";

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
    itensPorPagina = window.innerWidth >= 1025 ? 8 : 4;
    indicePaginaCarrossel = 0;
    document.getElementById('moduloCarrossel').style.display = 'flex';
    renderizarPaginaCarrossel();
}

function pararCarrossel() {
    carrosselAtivo = false;
    if (timerCarrossel) clearTimeout(timerCarrossel);
}

function obterProdutosFiltradosCarrossel() {
    const hDesc = headers.find(h => h.includes('Desc') || h.toLowerCase().includes('nome')) || headers[1];
    const hMarca = headers.find(h => h.includes('Marca') || h.toLowerCase().includes('marca')) || headers[2];

    return dadosGlobais.filter(p => {
        if (!termoPesquisaCarrossel) return true;
        const desc = String(p[hDesc] || '');
        const marca = String(p[hMarca] || '');
        return buscaInteligente(termoPesquisaCarrossel, desc) ||
               buscaInteligente(termoPesquisaCarrossel, marca);
    });
}

function renderizarPaginaCarrossel() {
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

        html = `<div style="grid-column:1 / -1;text-align:center;padding:35px;color:#cbd5e1;">
            <p style="font-size:16px;font-weight:700;margin:0 0 10px;">${mensagem}</p>
            <button class="btn-controle-carrossel" onclick="recarregarProdutos()">Tentar novamente</button>
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
                    <span class="vitrine-preco">${p[hPreco] || ''}</span>
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
    const botao = event && event.target ? event.target : null;
    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Carregando...';
    }

    await carregarDadosPlanilha();
    renderizarPaginaCarrossel();
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
