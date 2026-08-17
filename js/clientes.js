"use strict";

function mostrarEtapaCliente(idEtapa) {
    document.querySelectorAll('#telaCadastroCliente .etapa-cliente').forEach(etapa => {
        etapa.classList.remove('ativa');
    });
    document.getElementById(idEtapa).classList.add('ativa');
}

function definirMensagemCliente(id, texto, tipo) {
    const elemento = document.getElementById(id);
    elemento.textContent = texto || '';
    elemento.className = 'mensagem-cliente';
    if (texto) elemento.classList.add(tipo || 'erro');
}

function iniciarFluxoCliente(codigo, descricao) {
    produtoSelecionadoParaCompra = { codigo, descricao };

    if (timerCarrossel) clearTimeout(timerCarrossel);
    pausaPorHover = true;

    document.getElementById('produtoSelecionadoCliente').textContent =
        `Produto selecionado — Cód. ${codigo}: ${descricao}`;

    clienteEncontradoAtual = null;
    modoEdicaoCliente = false;

    const cpfSalvoBruto = localStorage.getItem(CHAVE_CPF_SICLAR) || '';
    const cpfSalvo = somenteNumeros(cpfSalvoBruto).length === 10
        ? normalizarCpfCliente(cpfSalvoBruto)
        : somenteNumeros(cpfSalvoBruto);

    const campoConsulta = document.getElementById('clienteCpfConsulta');
    campoConsulta.placeholder = 'Digite seu CPF ou código do cliente';
    campoConsulta.value = cpfSalvo.length === 11
        ? formatarCpf(cpfSalvo)
        : cpfSalvo;
    document.getElementById('formCadastroCliente').reset();
    definirMensagemCliente('mensagemConsultaCliente', '');
    definirMensagemCliente('mensagemCadastroCliente', '');
    mostrarEtapaCliente('etapaCpfCliente');

    document.getElementById('telaCadastroCliente').classList.add('ativa');

    setTimeout(() => {
        const campoCpf = document.getElementById('clienteCpfConsulta');
        campoCpf.focus();
        if (cpfSalvo) campoCpf.select();
    }, 100);
}

function fecharTelaCliente() {
    document.getElementById('telaCadastroCliente').classList.remove('ativa');
    pausaPorHover = false;
    produtoSelecionadoParaCompra = null;
    renderizarPaginaCarrossel();
}

function voltarEtapaCpf() {
    definirMensagemCliente('mensagemCadastroCliente', '');
    mostrarEtapaCliente('etapaCpfCliente');
    document.getElementById('clienteCpfConsulta').focus();
}

function obterValorCliente(cliente, nomeCampo) {
    if (!cliente) return '';
    const chave = Object.keys(cliente).find(
        chaveAtual => chaveAtual.trim().toUpperCase() === nomeCampo.toUpperCase()
    );
    return chave ? cliente[chave] : '';
}

function normalizarCpfCliente(valor) {
    const numeros = somenteNumeros(valor);

    // CPF tem 11 dígitos. Quando a planilha/GAS devolve o CPF como número,
    // um zero à esquerda pode ter sido perdido. Nesse caso, restauramos o zero.
    if (numeros.length === 10) {
        return numeros.padStart(11, '0');
    }

    return numeros;
}

function prepararFormularioCliente(cliente = null) {
    const cpf = cliente
        ? normalizarCpfCliente(obterValorCliente(cliente, 'CPF'))
        : somenteNumeros(document.getElementById('clienteCpfConsulta').value);

    document.getElementById('clienteCpf').value = formatarCpf(cpf);
    document.getElementById('clienteNome').value = obterValorCliente(cliente, 'NOME_COMPLETO');
    document.getElementById('clienteTelefone').value = formatarTelefone(obterValorCliente(cliente, 'TELEFONE'));
    document.getElementById('clienteEmail').value = obterValorCliente(cliente, 'EMAIL');
    document.getElementById('clienteCep').value = formatarCep(obterValorCliente(cliente, 'CEP'));
    document.getElementById('clienteEndereco').value = obterValorCliente(cliente, 'ENDERECO');
    document.getElementById('clienteNumero').value = obterValorCliente(cliente, 'NUMERO');
    document.getElementById('clienteBairro').value = obterValorCliente(cliente, 'BAIRRO');
    document.getElementById('clienteCidade').value = obterValorCliente(cliente, 'CIDADE');
    document.getElementById('clienteUf').value = obterValorCliente(cliente, 'UF');
    document.getElementById('clientePontoReferencia').value =
        obterValorCliente(cliente, 'PONTO DE REFERENCIA');
    document.getElementById('clienteObservacoes').value =
        obterValorCliente(cliente, 'OBSERVAÇÕES');

    liberarEnderecoManualCliente();
}

function abrirAlteracaoCliente() {
    if (!clienteEncontradoAtual) return;

    modoEdicaoCliente = true;
    prepararFormularioCliente(clienteEncontradoAtual);
    definirMensagemCliente('mensagemCadastroCliente', '');
    document.getElementById('btnSalvarCliente').textContent = 'Salvar alterações';
    mostrarEtapaCliente('etapaCadastroCliente');

    setTimeout(() => document.getElementById('clienteNome').focus(), 100);
}


function abrirMeusPedidosCliente() {
    clientePedidoAtual = clienteEncontradoAtual;
    abrirHistoricoPedidos();
}

function continuarComprandoCliente() {
    clientePedidoAtual = clienteEncontradoAtual;
    abrirMontagemPedido();
}

async function consultarCpfCliente() {
    const campoCpf = document.getElementById('clienteCpfConsulta');
    const identificador = somenteNumeros(campoCpf.value);
    const botao = document.getElementById('btnConsultarCpf');

    definirMensagemCliente('mensagemConsultaCliente', '');
    definirMensagemCliente('mensagemCadastroCliente', '');

    if (!identificador) {
        definirMensagemCliente(
            'mensagemConsultaCliente',
            'Digite seu CPF ou o código do cliente.',
            'erro'
        );
        campoCpf.focus();
        return;
    }

    const modoConsumidor = identificador === '1';
    const modoCpf = identificador.length === 11;
    const modoCodigo = !modoConsumidor && !modoCpf;

    // Quando houver 11 dígitos, o sistema SEMPRE entende que é CPF.
    // Se estiver inválido, avisa e abre o cadastro para o cliente corrigir.
    if (modoCpf && !cpfValido(identificador)) {
        clienteEncontradoAtual = null;
        modoEdicaoCliente = false;
        prepararFormularioCliente(null);
        document.getElementById('clienteCpf').value = formatarCpf(identificador);
        document.getElementById('btnSalvarCliente').textContent = 'Salvar cadastro';
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'CPF inválido. Confira os números, corrija o CPF e complete seu cadastro.',
            'erro'
        );
        mostrarEtapaCliente('etapaCadastroCliente');
        setTimeout(() => {
            const campoCadastroCpf = document.getElementById('clienteCpf');
            campoCadastroCpf.focus();
            campoCadastroCpf.select();
        }, 100);
        return;
    }

    botao.disabled = true;
    botao.textContent = 'Consultando...';

    try {
        const resultado = await enviarParaGAS({
            acao: 'buscarCliente',
            cpf: identificador
        });

        if (resultado.consumidor) {
            clienteEncontradoAtual = resultado.cliente || {
                CODIGO_CLIENTE: '1',
                CPF: '1',
                NOME_COMPLETO: 'CONSUMIDOR'
            };
            clientePedidoAtual = clienteEncontradoAtual;
            modoEdicaoCliente = false;
            localStorage.setItem(CHAVE_CPF_SICLAR, '1');
            abrirMontagemPedido();
            return;
        }

        if (resultado.encontrado) {
            clienteEncontradoAtual = resultado.cliente || null;
            modoEdicaoCliente = false;
            localStorage.setItem(CHAVE_CPF_SICLAR, identificador);

            // Código de cliente é atalho de venda: encontrou, abre o pedido direto.
            if (modoCodigo || resultado.tipoConsulta === 'CODIGO') {
                clientePedidoAtual = clienteEncontradoAtual;
                abrirMontagemPedido();
                return;
            }

            // CPF encontrado mantém o fluxo normal do cliente.
            mostrarEtapaCliente('etapaClienteExistente');
            return;
        }

        // CPF válido, porém ainda não cadastrado: abre cadastro normalmente.
        clienteEncontradoAtual = null;
        modoEdicaoCliente = false;
        prepararFormularioCliente(null);
        document.getElementById('clienteCpf').value = formatarCpf(identificador);
        document.getElementById('btnSalvarCliente').textContent = 'Salvar cadastro';
        mostrarEtapaCliente('etapaCadastroCliente');
        setTimeout(() => document.getElementById('clienteNome').focus(), 100);
    } catch (e) {
        definirMensagemCliente('mensagemConsultaCliente', e.message, 'erro');
    } finally {
        botao.disabled = false;
        botao.textContent = 'Continuar';
    }
}

function liberarEnderecoManualCliente() {
    ['clienteEndereco', 'clienteBairro', 'clienteCidade', 'clienteUf'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.readOnly = false;
    });
}

function limparEnderecoCliente() {
    ['clienteEndereco', 'clienteBairro', 'clienteCidade', 'clienteUf'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
}

async function consultarCepCliente() {
    const campoCep = document.getElementById('clienteCep');
    const cep = somenteNumeros(campoCep.value);

    definirMensagemCliente('mensagemCadastroCliente', '');
    liberarEnderecoManualCliente();

    if (!cep) {
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'Sem CEP? Preencha o endereço, bairro, cidade e UF manualmente.',
            'sucesso'
        );
        document.getElementById('clienteEndereco').focus();
        return;
    }

    if (cep.length !== 8) {
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'O CEP está incompleto. Você pode corrigi-lo ou deixá-lo em branco e preencher o endereço manualmente.',
            'erro'
        );
        return;
    }

    campoCep.disabled = true;

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            throw new Error(
                'CEP não encontrado. Você pode deixar o CEP em branco e preencher o endereço manualmente.'
            );
        }

        document.getElementById('clienteEndereco').value =
            String(dados.logradouro || '').toUpperCase();
        document.getElementById('clienteBairro').value =
            String(dados.bairro || '').toUpperCase();
        document.getElementById('clienteCidade').value =
            String(dados.localidade || '').toUpperCase();
        document.getElementById('clienteUf').value =
            String(dados.uf || '').toUpperCase();

        liberarEnderecoManualCliente();

        definirMensagemCliente(
            'mensagemCadastroCliente',
            'Endereço localizado. Confira os dados e altere o que for necessário.',
            'sucesso'
        );

        if (dados.logradouro) {
            document.getElementById('clienteNumero').focus();
        } else {
            document.getElementById('clienteEndereco').focus();
        }
    } catch (e) {
        limparEnderecoCliente();
        liberarEnderecoManualCliente();
        definirMensagemCliente('mensagemCadastroCliente', e.message, 'erro');
        document.getElementById('clienteEndereco').focus();
    } finally {
        campoCep.disabled = false;
    }
}

async function salvarCadastroCliente(evento) {
    evento.preventDefault();

    const botao = document.getElementById('btnSalvarCliente');
    const cpf = normalizarCpfCliente(document.getElementById('clienteCpf').value);
    const cep = somenteNumeros(document.getElementById('clienteCep').value);

    const dadosCliente = {
        CPF: cpf,
        NOME_COMPLETO: document.getElementById('clienteNome').value.trim().toUpperCase(),
        TELEFONE: document.getElementById('clienteTelefone').value.trim().toUpperCase(),
        EMAIL: document.getElementById('clienteEmail').value.trim().toLowerCase(),
        CEP: cep,
        ENDERECO: document.getElementById('clienteEndereco').value.trim().toUpperCase(),
        NUMERO: document.getElementById('clienteNumero').value.trim().toUpperCase(),
        BAIRRO: document.getElementById('clienteBairro').value.trim().toUpperCase(),
        CIDADE: document.getElementById('clienteCidade').value.trim().toUpperCase(),
        UF: document.getElementById('clienteUf').value.trim().toUpperCase(),
        'PONTO DE REFERENCIA': document.getElementById('clientePontoReferencia').value.trim().toUpperCase(),
        'OBSERVAÇÕES': document.getElementById('clienteObservacoes').value.trim().toUpperCase(),
        STATUS: 'ATIVO'
    };

    if (!cpfValido(cpf)) {
        definirMensagemCliente('mensagemCadastroCliente', 'CPF inválido.', 'erro');
        return;
    }

    if (cep && cep.length !== 8) {
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'Corrija o CEP ou deixe-o em branco para informar o endereço manualmente.',
            'erro'
        );
        document.getElementById('clienteCep').focus();
        return;
    }

    if (!dadosCliente.ENDERECO || !dadosCliente.BAIRRO || !dadosCliente.CIDADE || !dadosCliente.UF) {
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'Informe endereço, bairro, cidade e UF. O CEP é opcional.',
            'erro'
        );
        return;
    }

    if (dadosCliente.UF.length !== 2) {
        definirMensagemCliente(
            'mensagemCadastroCliente',
            'Informe a UF com duas letras. Exemplo: MT.',
            'erro'
        );
        document.getElementById('clienteUf').focus();
        return;
    }

    botao.disabled = true;
    botao.textContent = 'Salvando...';
    definirMensagemCliente('mensagemCadastroCliente', '');

    try {
        const resultado = await enviarParaGAS({
            acao: modoEdicaoCliente ? 'atualizarCliente' : 'salvarCliente',
            dadosCliente,
            produtoSelecionado: produtoSelecionadoParaCompra
        });

        localStorage.setItem(CHAVE_CPF_SICLAR, cpf);

        if (resultado.jaCadastrado && !modoEdicaoCliente) {
            const consulta = await enviarParaGAS({
                acao: 'buscarCliente',
                cpf
            });
            clienteEncontradoAtual = consulta.cliente || null;
            mostrarEtapaCliente('etapaClienteExistente');
            return;
        }

        clienteEncontradoAtual = dadosCliente;

        if (modoEdicaoCliente || resultado.atualizado) {
            modoEdicaoCliente = false;
            definirMensagemCliente(
                'mensagemConsultaCliente',
                'Cadastro atualizado com sucesso.',
                'sucesso'
            );
            mostrarEtapaCliente('etapaClienteExistente');
            return;
        }

        modoEdicaoCliente = false;
        const mensagemConclusao = document.querySelector(
            '#etapaCadastroConcluido .mensagem-cliente'
        );
        mensagemConclusao.textContent =
            '🎉 Cadastro realizado com sucesso! Agora você já pode montar seu pedido.';
        mostrarEtapaCliente('etapaCadastroConcluido');
    } catch (e) {
        definirMensagemCliente('mensagemCadastroCliente', e.message, 'erro');
    } finally {
        botao.disabled = false;
        botao.textContent = 'Salvar cadastro';
    }
}

function continuarAposCadastro() {
    clientePedidoAtual = clienteEncontradoAtual;
    abrirMontagemPedido();
}