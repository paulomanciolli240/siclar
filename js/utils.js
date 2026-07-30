"use strict";

function resolverUrlImagem(valFoto) {
    if (!valFoto) return '';
    let limpa = valFoto.trim();
    if (limpa.toUpperCase() === 'NÃO' || limpa.toUpperCase() === 'NAO') return '';
    if (limpa.startsWith('http')) return limpa;
    let base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    return base + (limpa.startsWith('imagens/') ? '' : 'imagens/') + limpa;
}

function buscaInteligente(textoBusca, textoAlvo) {
    if (!textoBusca) return true;
    const termos = textoBusca.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    const alvo = textoAlvo.toLowerCase();
    return termos.every(termo => alvo.includes(termo));
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
