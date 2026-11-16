import makeWASocket, {
  DisconnectReason,
  generateMessageIDV2,
  jidNormalizedUser,
  useMultiFileAuthState,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isPnUser,
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { digitos } from './util.js';

function extrairTexto(mensagem) {
  const m = mensagem?.ephemeralMessage?.message ?? mensagem ?? {};
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    ''
  );
}

/**
 * Conecta ao WhatsApp (QR Code no terminal na primeira vez) e reconecta sozinho.
 *
 * aoReceber({ jid, telefone, texto, propria })  -> mensagem de um cliente
 * aoResponderManual({ jid })                    -> você respondeu pelo celular: o bot deve se calar
 *
 * Com aceitarConversaPropria, o que você escreve em "Mensagem para mim" é tratado
 * como mensagem de cliente (propria: true), para testar o bot sem um segundo número.
 */
export async function conectar({ aoReceber, aoResponderManual, aceitarConversaPropria = false, pastaSessao = 'auth' }) {
  const enviadasPeloBot = new Set();
  const estado = { sock: null, conectado: false };

  async function iniciar() {
    const { state, saveCreds } = await useMultiFileAuthState(pastaSessao);
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: false, // mantém as notificações chegando no celular
      syncFullHistory: false,
    });
    estado.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('\nEscaneie o QR Code: WhatsApp > Dispositivos conectados > Conectar dispositivo\n');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        estado.conectado = true;
        console.log('[whatsapp] conectado');
      }
      if (connection === 'close') {
        estado.conectado = false;
        const codigo = lastDisconnect?.error?.output?.statusCode;
        if (codigo === DisconnectReason.loggedOut) {
          console.error(`[whatsapp] sessão encerrada pelo celular. Apague a pasta "${pastaSessao}" e rode de novo.`);
          process.exit(1);
        }
        console.log(`[whatsapp] conexão caiu (${codigo ?? 'sem código'}); reconectando em 5s`);
        setTimeout(() => iniciar().catch((e) => console.error('[whatsapp] falha ao reconectar:', e.message)), 5000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        try {
          const jid = msg.key?.remoteJid;
          if (!jid || !msg.message) continue;
          if (isJidGroup(jid) || isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid)) continue;

          // Ignora histórico antigo que chega ao reconectar.
          const idade = Date.now() / 1000 - Number(msg.messageTimestamp ?? 0);
          if (idade > 120) continue;

          if (msg.key.fromMe) {
            if (enviadasPeloBot.has(msg.key.id)) continue;
            const eu = [sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser);
            if (eu.includes(jidNormalizedUser(jid))) {
              if (aceitarConversaPropria) {
                await aoReceber({ jid, telefone: digitos(sock.user.id), texto: extrairTexto(msg.message), propria: true });
              }
            } else {
              await aoResponderManual({ jid });
            }
            continue;
          }

          // Contas novas chegam com identificador @lid; o telefone vem em remoteJidAlt.
          const jidTelefone = isPnUser(jid) ? jid : msg.key.remoteJidAlt;
          await aoReceber({ jid, telefone: digitos(jidTelefone), texto: extrairTexto(msg.message) });
        } catch (erro) {
          console.error('[whatsapp] erro ao tratar mensagem:', erro.message);
        }
      }
    });
  }

  await iniciar();

  return {
    get conectado() {
      return estado.conectado;
    },
    // `resposta` é um texto ou { imagem, texto } (imagem = caminho local ou URL; texto vira legenda).
    async enviar(jid, resposta) {
      const { texto = '', imagem } = typeof resposta === 'string' ? { texto: resposta } : resposta;
      const mandar = async (conteudo) => {
        // O ID é registrado antes do envio para o bot nunca tratar a própria resposta como mensagem nova.
        const messageId = generateMessageIDV2(estado.sock.user?.id);
        enviadasPeloBot.add(messageId);
        if (enviadasPeloBot.size > 5000) enviadasPeloBot.delete(enviadasPeloBot.values().next().value);
        await estado.sock.sendMessage(jid, conteudo, { messageId });
      };
      if (imagem) {
        try {
          await mandar({ image: { url: imagem }, caption: texto || undefined });
          return;
        } catch (erro) {
          console.error(`[whatsapp] não consegui enviar a imagem "${imagem}" (${erro.message}); enviando só o texto`);
        }
      }
      if (texto) await mandar({ text: texto });
    },
    // Conversa "Mensagem para mim" do número conectado.
    meuJid() {
      return jidNormalizedUser(estado.sock.user?.id);
    },
    // Descobre o identificador real de um telefone (resolve o nono dígito). Nulo = sem WhatsApp.
    async resolverJid(telefone) {
      const [resultado] = (await estado.sock.onWhatsApp(telefone)) ?? [];
      return resultado?.exists ? resultado.jid : null;
    },
  };
}
