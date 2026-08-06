"use strict";

function resolverUrlImagem(valFoto) {
    const valor = String(valFoto == null ? "" : valFoto).trim();

    if (!valor) return "";

    const superior = valor.toUpperCase();

    if (
        superior === "NÃO" ||
        superior === "NAO" ||
        superior === "SEM FOTO" ||
        superior === "SEM IMAGEM" ||
        superior === "0" ||
        superior === "-"
    ) {
        return "";
    }

    if (
        valor.startsWith("data:") ||
        valor.startsWith("blob:") ||
        /^https?:\/\//i.test(valor)
    ) {
        return valor;
    }

    /*
      Fotos automáticas antigas como imagens/1234.png são ignoradas.
      Somente fotos editadas manualmente, com nome descritivo, são exibidas.
    */
    const caminho = valor
        .replace(/\\/g, "/")
        .replace(/^\.\//, "");

    if (!caminho.toLowerCase().startsWith("imagens/")) {
        return "";
    }

    const nomeArquivo = caminho.split("/").pop() || "";
    const nomeSemExtensao = nomeArquivo.replace(/\.[^.]+$/, "");

    if (!nomeArquivo || /^\d+$/.test(nomeSemExtensao)) {
        return "";
    }

    const base =
        window.location.href.substring(
            0,
            window.location.href.lastIndexOf("/") + 1
        );

    return base + caminho;
}

function normalizarTextoPesquisa(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\bmm\b/g, ' mm ')
        .replace(/\bcm\b/g, ' cm ')
        .replace(/\bmt\b/g, ' mt ')
        .replace(/\bmetros?\b/g, ' mt ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function separarTermosPesquisa(valor) {
    return normalizarTextoPesquisa(valor)
        .split(' ')
        .filter(Boolean);
}

function termoCombinaComPalavras(termo, palavras, textoCompleto) {
    if (!termo) return true;

    if (/^\d+$/.test(termo)) {
        return palavras.some(palavra =>
            palavra === termo ||
            palavra.startsWith(termo)
        ) || textoCompleto.includes(termo);
    }

    if (palavras.some(palavra => palavra.startsWith(termo))) {
        return true;
    }

    return termo.length >= 3 && textoCompleto.includes(termo);
}

function buscaInteligente(textoBusca, textoAlvo) {
    const termos = separarTermosPesquisa(textoBusca);
    if (termos.length === 0) return true;

    const alvoNormalizado = normalizarTextoPesquisa(textoAlvo);
    const palavrasAlvo = alvoNormalizado.split(' ').filter(Boolean);

    return termos.every(termo =>
        termoCombinaComPalavras(
            termo,
            palavrasAlvo,
            alvoNormalizado
        )
    );
}

function calcularPontuacaoPesquisa(textoBusca, textoAlvo) {
    const termos = separarTermosPesquisa(textoBusca);
    if (termos.length === 0) return 0;

    const alvoNormalizado = normalizarTextoPesquisa(textoAlvo);
    const palavrasAlvo = alvoNormalizado.split(' ').filter(Boolean);
    let pontos = 0;

    termos.forEach(termo => {
        if (palavrasAlvo.includes(termo)) {
            pontos += 20;
            return;
        }

        if (palavrasAlvo.some(palavra => palavra.startsWith(termo))) {
            pontos += 12;
            return;
        }

        if (alvoNormalizado.includes(termo)) {
            pontos += 4;
        }
    });

    const sequencia = termos.join(' ');
    if (sequencia && alvoNormalizado.includes(sequencia)) {
        pontos += 30;
    }

    const primeiroTermo = termos[0];
    if (
        primeiroTermo &&
        palavrasAlvo.length &&
        palavrasAlvo[0].startsWith(primeiroTermo)
    ) {
        pontos += 10;
    }

    return pontos;
}

function montarTextoPesquisaProduto(produto, cabecalhosPesquisa) {
    return cabecalhosPesquisa
        .map(cabecalho => produto[cabecalho])
        .filter(valor => valor !== undefined && valor !== null && valor !== '')
        .join(' ');
}

function ordenarProdutosPorPesquisa(produtos, termo, cabecalhosPesquisa) {
    if (!termo) return produtos.slice();

    return produtos
        .map(produto => {
            const textoPesquisa = montarTextoPesquisaProduto(
                produto,
                cabecalhosPesquisa
            );

            return {
                produto,
                textoPesquisa,
                pontuacao: calcularPontuacaoPesquisa(
                    termo,
                    textoPesquisa
                )
            };
        })
        .filter(item =>
            buscaInteligente(termo, item.textoPesquisa)
        )
        .sort((a, b) => b.pontuacao - a.pontuacao)
        .map(item => item.produto);
}

function somenteNumeros(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function formatarCpf(valor) {
    const numeros = somenteNumeros(valor).slice(0, 11);
    return numeros
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatarTelefone(valor) {
    const numeros = somenteNumeros(valor).slice(0, 11);
    if (numeros.length <= 10) {
        return numeros
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }

    return numeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function formatarCep(valor) {
    const numeros = somenteNumeros(valor).slice(0, 8);
    return numeros.replace(/^(\d{5})(\d)/, '$1-$2');
}

function cpfValido(cpf) {
    const numeros = somenteNumeros(cpf);
    if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(numeros[i]) * (10 - i);
    let digito1 = (soma * 10) % 11;
    if (digito1 === 10) digito1 = 0;
    if (digito1 !== Number(numeros[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(numeros[i]) * (11 - i);
    let digito2 = (soma * 10) % 11;
    if (digito2 === 10) digito2 = 0;

    return digito2 === Number(numeros[10]);
}

function moedaParaNumero(valor) {
    if (typeof valor === 'number') return valor;

    let texto = String(valor || '')
        .replace(/\s/g, '')
        .replace(/R\$/gi, '')
        .replace(/[^\d,.-]/g, '');

    if (!texto) return 0;

    if (texto.includes(',') && texto.includes('.')) {
        if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
            texto = texto.replace(/\./g, '').replace(',', '.');
        } else {
            texto = texto.replace(/,/g, '');
        }
    } else if (texto.includes(',')) {
        texto = texto.replace(/\./g, '').replace(',', '.');
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function obterCabecalhosProduto() {
    return {
        codigo: headers.find(h => h.includes('Cód') || h.toLowerCase().includes('codigo')) || headers[0],
        descricao: headers.find(h => h.includes('Desc') || h.toLowerCase().includes('nome')) || headers[1],
        marca: headers.find(h => h.includes('Marca') || h.toLowerCase().includes('marca')) || headers[2],
        preco: headers.find(h => h.includes('Preço') || h.toLowerCase().includes('venda')) || headers[3],
        foto: headers.find(h => h.includes('Foto') || h.toLowerCase().includes('imagem')) || ''
    };
}
