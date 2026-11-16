import { consultarCep } from './cep.js';
import { criarPedidoLocal } from './pedidos-locais.js';
import { linhaRastreio, normalizarTelefone, preencher } from './util.js';

const HORA = 60 * 60 * 1000;
const MINUTO = 60 * 1000;

// Tempo sem interação até o atendimento ser encerrado ("sessao_minutos" no config).
function tempoDeSessao(bot) {
  if (bot.sessao_minutos != null) return bot.sessao_minutos * MINUTO;
  if (bot.sessao_horas != null) return bot.sessao_horas * HORA; // nome antigo da configuração
  return 15 * MINUTO;
}

/**
 * Encerra os atendimentos parados há mais que o tempo de sessão. A próxima mensagem
 * do cliente recebe o menu do início. Devolve [{ jid, texto }] com o aviso de
 * encerramento a enviar ("menu.encerramento"; sem esse texto, encerra em silêncio).
 */
export function encerrarInativas({ db, bot, agora = Date.now() }) {
  const inativas = db.listarConversasInativas(agora - tempoDeSessao(bot), agora);
  for (const { jid } of inativas) db.encerrarConversa(jid);
  const texto = bot.menu.encerramento;
  return texto ? inativas.map(({ jid }) => ({ jid, texto: preencher(texto, { loja: bot.loja }) })) : [];
}

const ROTULOS = {
  pagamento: { pendente: 'aguardando pagamento', pago: 'aprovado', reembolsado: 'reembolsado', cancelado: 'cancelado' },
  envio: { nao_enviado: 'em preparação', enviado: 'enviado', entregue: 'entregue' },
};

// Perguntas do fechamento de compra; cada uma pode ser trocada em "catalogo" no config.
const TEXTOS_COMPRA = {
  pedir_nome: 'Para finalizar, qual é o seu nome completo?',
  pedir_cep: 'Qual é o CEP de entrega?',
  cep_nao_encontrado: 'Não encontrei esse CEP. Confira os 8 números e envie de novo.',
  pedir_numero: 'Entrega em:\n{logradouro}, {bairro}\n{cidade} - {uf}\n\nQual é o número? Se tiver complemento, mande junto (ex.: 120, apto 301).',
  numero_invalido: 'Preciso do número do endereço (ex.: 120, apto 301). Se não tiver número, responda "s/n".',
  pedir_rua: 'CEP de {cidade} - {uf}. Qual é a rua, o número, o complemento e o bairro?',
  pedir_endereco: 'Qual é o endereço completo para entrega? (rua, número, complemento, bairro, cidade, UF e CEP)',
  pedir_telefone: 'Qual é o seu telefone com DDD?',
  confirmar: 'Confira os dados:\n\nProduto: {produto} ({preco})\nNome: {nome}\nEndereço: {endereco}\nTelefone: {telefone}\n\n1 - Confirmar\n2 - Corrigir',
  pedido_registrado: 'Pedido #{numero} registrado! Avisamos por aqui a cada atualização.',
  comprar_atendente: 'Um atendente vai combinar o pagamento de {nome} com você por aqui.',
  depois_da_compra: 'Qualquer dúvida no pagamento, é só chamar por aqui.',
};

// Opção "voltar ao início": vale em qualquer ponto da conversa.
// No config, "menu.voltar": false desliga; { "tecla", "texto" } personaliza.
function opcaoVoltar(bot) {
  const v = bot.menu.voltar;
  if (v === false || v === null) return null;
  return { tecla: String(v?.tecla ?? '0'), texto: v?.texto ?? '0 - Voltar ao início' };
}

function comVoltar(bot, texto) {
  const v = opcaoVoltar(bot);
  return v ? `${texto}\n\n${v.texto}` : texto;
}

function pediuVoltar(bot, entrada) {
  const v = opcaoVoltar(bot);
  if (!v) return false;
  const e = entrada.toLowerCase();
  return e === v.tecla.toLowerCase() || ['menu', 'voltar', 'inicio', 'início'].includes(e);
}

function textoMenu(bot) {
  const linhas = bot.menu.opcoes.map((o) => `${o.tecla} - ${o.titulo}`);
  return `${preencher(bot.menu.saudacao, { loja: bot.loja })}\n\n${linhas.join('\n')}`;
}

function produtosDoCatalogo(bot) {
  return bot.catalogo?.produtos ?? [];
}

function textoCatalogo(bot) {
  const linhas = produtosDoCatalogo(bot).map((p, i) => `${i + 1} - ${p.nome}${p.preco ? ` (${p.preco})` : ''}`);
  return comVoltar(bot, `${bot.catalogo.titulo ?? 'Escolha um produto:'}\n\n${linhas.join('\n')}`);
}

// Ficha do produto: texto + ações. Com "foto", vai como imagem com legenda.
function fichaProduto(bot, produto, { comFoto = true } = {}) {
  const c = bot.catalogo;
  const corpo = preencher(c.produto ?? '*{nome}*\n{descricao}\n\n{preco}', produto);
  const acoes = `1 - ${c.acao_comprar ?? 'Comprar'}\n2 - ${c.acao_voltar ?? 'Voltar aos produtos'}`;
  const texto = comVoltar(bot, `${corpo}\n\n${acoes}`);
  return comFoto && produto.foto ? { imagem: produto.foto, texto } : texto;
}

// Mensagens de pagamento: link, Pix copia e cola (em mensagem separada, fácil de copiar) e/ou QR Code.
function mensagensDeCompra(bot, produto) {
  const c = bot.catalogo;
  const mensagens = [];
  if (produto.link) {
    mensagens.push(preencher(c.comprar_link ?? 'Para finalizar a compra de {nome} ({preco}), acesse:\n{link}', produto));
  }
  if (produto.pix || produto.pix_qr) {
    mensagens.push(preencher(c.comprar_pix ?? 'Pix de {nome} ({preco}):', produto));
    if (produto.pix_qr) mensagens.push({ imagem: produto.pix_qr, texto: '' });
    if (produto.pix) mensagens.push(produto.pix);
  }
  return mensagens;
}

function textoPedido(bot, pedido) {
  return preencher(bot.menu.pedido_status, {
    numero: pedido.numero,
    pagamento: pedido.cancelado ? 'pedido cancelado' : ROTULOS.pagamento[pedido.pagamento] ?? pedido.pagamento,
    envio: pedido.cancelado ? '-' : ROTULOS.envio[pedido.envio] ?? pedido.envio,
    rastreio_linha: pedido.cancelado ? '' : linhaRastreio(pedido),
  });
}

/**
 * Decide o que responder a uma mensagem recebida.
 * Devolve a lista de respostas a enviar (vazia = o bot fica calado, conversa com humano).
 * Cada resposta é um texto ou { imagem, texto } (imagem = caminho local ou URL).
 *
 * @param {object} p
 * @param {object} p.db        banco aberto por abrirBanco()
 * @param {object} p.bot       conteúdo do config/bot.json
 * @param {string} p.jid       identificador da conversa no WhatsApp
 * @param {string} p.telefone  telefone de quem escreveu (pode vir vazio)
 * @param {string} p.texto     texto da mensagem ('' para áudio, imagem etc.)
 * @param {number} [p.agora]   epoch ms (para testes)
 * @param {object|null} [p.cepEncontrado]  resultado da consulta do CEP digitado: objeto = achou,
 *                                          null = CEP não existe, undefined = não deu para consultar
 */
export function processarMensagem({ db, bot, jid, telefone, texto, cepEncontrado, agora = Date.now() }) {
  const conversa = db.lerConversa(jid);
  const entrada = String(texto || '').trim();
  const mostrarMenu = () => {
    db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
    return [textoMenu(bot)];
  };

  // Conversa entregue a um humano: o bot não responde até a pausa vencer.
  // Enquanto ninguém respondeu (estado "atendente"), o cliente ainda pode voltar ao menu.
  if (conversa && conversa.pausado_ate > agora) {
    return conversa.estado === 'atendente' && pediuVoltar(bot, entrada) ? mostrarMenu() : [];
  }

  const sessaoVencida = !conversa || conversa.estado === 'encerrada' || agora - conversa.atualizado_em > tempoDeSessao(bot);
  if (sessaoVencida || pediuVoltar(bot, entrada)) return mostrarMenu();

  const passarParaAtendente = (mensagem) => {
    db.pausarConversa(jid, agora + (bot.pausa_atendente_horas ?? 12) * HORA, agora, 'atendente');
    return [comVoltar(bot, mensagem)];
  };

  // Resposta fora das opções: repete uma vez; na segunda seguida, passa para um humano.
  const respostaInvalida = (estado, repetir, aviso = bot.menu.invalida) => {
    if (conversa.invalidas >= 1) return passarParaAtendente(bot.menu.atendente);
    db.gravarConversa(jid, { estado, invalidas: conversa.invalidas + 1, atualizado_em: agora, dados: conversa.dados });
    return repetir ? [aviso, repetir] : [aviso];
  };
  const textoCompra = (chave) => bot.catalogo?.[chave] ?? TEXTOS_COMPRA[chave];

  const produtos = produtosDoCatalogo(bot);

  if (conversa.estado === 'catalogo') {
    const produto = /^\d+$/.test(entrada) ? produtos[Number(entrada) - 1] : null;
    if (!produto) return respostaInvalida('catalogo', textoCatalogo(bot));
    db.gravarConversa(jid, { estado: `produto:${produtos.indexOf(produto)}`, atualizado_em: agora });
    return [fichaProduto(bot, produto)];
  }

  if (conversa.estado.startsWith('produto:')) {
    const produto = produtos[Number(conversa.estado.split(':')[1])];
    if (!produto) return mostrarMenu(); // catálogo mudou no meio da conversa
    if (entrada === '2') {
      db.gravarConversa(jid, { estado: 'catalogo', atualizado_em: agora });
      return [textoCatalogo(bot)];
    }
    if (entrada !== '1') return respostaInvalida(conversa.estado, fichaProduto(bot, produto, { comFoto: false }));

    // "pedir_dados": false pula o cadastro e manda o pagamento direto (sem registrar pedido).
    if (bot.catalogo.pedir_dados === false) {
      const pagamento = mensagensDeCompra(bot, produto);
      if (!pagamento.length) return passarParaAtendente(preencher(textoCompra('comprar_atendente'), produto));
      db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
      return [...pagamento, comVoltar(bot, textoCompra('depois_da_compra'))];
    }
    db.gravarConversa(jid, { estado: `compra:nome:${produtos.indexOf(produto)}`, atualizado_em: agora });
    return [comVoltar(bot, textoCompra('pedir_nome'))];
  }

  // Fechamento da compra: nome -> CEP -> número -> (telefone, se o WhatsApp não informou) -> confirmação.
  // O CEP preenche rua, bairro, cidade e UF, para o cliente digitar o mínimo possível.
  // Com "endereco_por_cep": false, ou se a consulta do CEP falhar, o endereço é pedido por extenso.
  if (conversa.estado.startsWith('compra:')) {
    const [, passo, indice] = conversa.estado.split(':');
    const produto = produtos[Number(indice)];
    if (!produto) return mostrarMenu();
    const dados = JSON.parse(conversa.dados || '{}');
    const ir = (proximo, novosDados, pergunta) => {
      db.gravarConversa(jid, { estado: `compra:${proximo}:${indice}`, atualizado_em: agora, dados: JSON.stringify(novosDados) });
      return [comVoltar(bot, pergunta)];
    };
    const resumo = (d) => preencher(textoCompra('confirmar'), { ...d, produto: produto.nome, preco: produto.preco });

    // Com o endereço pronto, pergunta o telefone (se preciso) ou vai para a confirmação.
    const depoisDoEndereco = (endereco) => {
      const { cep, ...resto } = dados;
      const comEndereco = { ...resto, endereco };
      const conhecido = normalizarTelefone(telefone);
      if (!conhecido) return ir('telefone', comEndereco, textoCompra('pedir_telefone'));
      const completos = { ...comEndereco, telefone: conhecido };
      return ir('confirmar', completos, resumo(completos));
    };

    if (passo === 'nome') {
      if (entrada.length < 3) return respostaInvalida(conversa.estado, comVoltar(bot, textoCompra('pedir_nome')));
      const comNome = { ...dados, nome: entrada };
      if (bot.catalogo.endereco_por_cep === false) return ir('endereco', comNome, textoCompra('pedir_endereco'));
      return ir('cep', comNome, textoCompra('pedir_cep'));
    }
    if (passo === 'cep') {
      if (entrada.replace(/\D/g, '').length !== 8 || cepEncontrado === null) {
        return respostaInvalida(conversa.estado, null, comVoltar(bot, textoCompra('cep_nao_encontrado')));
      }
      // Não deu para consultar (sem internet, serviço fora do ar): pede o endereço por extenso.
      if (!cepEncontrado) return ir('endereco', dados, textoCompra('pedir_endereco'));
      const comCep = { ...dados, cep: cepEncontrado };
      // CEP geral de cidade pequena não traz rua nem bairro.
      if (!cepEncontrado.logradouro) return ir('endereco', comCep, preencher(textoCompra('pedir_rua'), cepEncontrado));
      return ir('numero', comCep, preencher(textoCompra('pedir_numero'), cepEncontrado));
    }
    if (passo === 'numero') {
      if (!/\d|s\/?n/i.test(entrada)) return respostaInvalida(conversa.estado, null, comVoltar(bot, textoCompra('numero_invalido')));
      const c = dados.cep;
      return depoisDoEndereco(`${c.logradouro}, ${entrada} - ${c.bairro}, ${c.cidade} - ${c.uf}, CEP ${c.cep}`);
    }
    if (passo === 'endereco') {
      const pergunta = dados.cep ? preencher(textoCompra('pedir_rua'), dados.cep) : textoCompra('pedir_endereco');
      if (entrada.length < 10) return respostaInvalida(conversa.estado, comVoltar(bot, pergunta));
      const c = dados.cep;
      return depoisDoEndereco(c ? `${entrada} - ${c.cidade} - ${c.uf}, CEP ${c.cep}` : entrada);
    }
    if (passo === 'telefone') {
      const informado = normalizarTelefone(entrada);
      if (informado.length < 12) return respostaInvalida(conversa.estado, comVoltar(bot, textoCompra('pedir_telefone')));
      const completos = { ...dados, telefone: informado };
      return ir('confirmar', completos, resumo(completos));
    }
    // passo === 'confirmar'
    if (entrada === '2') return ir('nome', {}, textoCompra('pedir_nome'));
    if (entrada !== '1') return respostaInvalida(conversa.estado, comVoltar(bot, resumo(dados)));

    const pedido = criarPedidoLocal({ db, produto, ...dados, agora });
    const registrado = preencher(textoCompra('pedido_registrado'), { numero: pedido.numero });
    const pagamento = mensagensDeCompra(bot, produto);
    // Produto sem link nem Pix cadastrado: um humano combina o pagamento.
    if (!pagamento.length) {
      return [registrado, ...passarParaAtendente(preencher(textoCompra('comprar_atendente'), produto))];
    }
    db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
    return [registrado, ...pagamento, comVoltar(bot, textoCompra('depois_da_compra'))];
  }

  if (conversa.estado === 'aguardando_pedido') {
    // Aceita "W3" (pedido feito pelo WhatsApp) ou só os dígitos ("pedido 123").
    const exato = entrada.toUpperCase().replace(/[#\s]/g, '');
    const numero = entrada.replace(/\D/g, '');
    const pedido = (exato && db.buscarPedidoPorNumero(exato)) || (numero ? db.buscarPedidoPorNumero(numero) : null);
    if (!pedido) return passarParaAtendente(bot.menu.pedido_nao_encontrado);
    db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
    return [comVoltar(bot, textoPedido(bot, pedido))];
  }

  const opcao = bot.menu.opcoes.find((o) => o.tecla === entrada);
  if (!opcao) return respostaInvalida('menu', textoMenu(bot));

  if (opcao.tipo === 'atendente') return passarParaAtendente(bot.menu.atendente);

  if (opcao.tipo === 'catalogo') {
    if (!produtos.length) return passarParaAtendente(bot.menu.atendente);
    db.gravarConversa(jid, { estado: 'catalogo', atualizado_em: agora });
    return [textoCatalogo(bot)];
  }

  if (opcao.tipo === 'pedido') {
    const pedido = db.buscarUltimoPedidoPorTelefone(telefone);
    if (pedido) {
      db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
      return [comVoltar(bot, textoPedido(bot, pedido))];
    }
    db.gravarConversa(jid, { estado: 'aguardando_pedido', atualizado_em: agora });
    return [comVoltar(bot, bot.menu.pedir_numero_pedido)];
  }

  db.gravarConversa(jid, { estado: 'menu', atualizado_em: agora });
  return [comVoltar(bot, opcao.resposta)];
}

/**
 * Igual a processarMensagem, mas antes consulta o CEP quando a conversa está
 * esperando um. É a função usada pelo bot; processarMensagem fica sem acesso à rede.
 */
export async function responder(args, { buscarCep = consultarCep } = {}) {
  let cepEncontrado;
  const conversa = args.db.lerConversa(args.jid);
  const numeros = String(args.texto || '').replace(/\D/g, '');
  if (conversa?.estado.startsWith('compra:cep:') && numeros.length === 8) {
    try {
      cepEncontrado = await buscarCep(numeros);
    } catch (erro) {
      console.error(`[cep] consulta falhou (${erro.message}); pedindo o endereço por extenso`);
    }
  }
  return processarMensagem({ ...args, cepEncontrado });
}
