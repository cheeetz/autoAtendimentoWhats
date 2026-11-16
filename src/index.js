import './logs.js';
import { carregarConfig } from './config.js';
import { abrirBanco } from './db.js';
import { criarLoja } from './lojas/index.js';
import { iniciarNotificador } from './notificador.js';
import { sincronizar } from './sync.js';
import { modoTesteAtivo, numeroPermitido } from './teste.js';
import { encerrarInativas, responder } from './triagem.js';
import { aleatorioEntre, esperar } from './util.js';
import { conectar } from './whatsapp.js';

const HORA = 60 * 60 * 1000;

const { bot, plataforma, syncIntervaloMin, env } = carregarConfig();
const db = abrirBanco();
const loja = await criarLoja(plataforma, env);

const emTeste = modoTesteAtivo(bot);
if (emTeste) {
  console.log(`[teste] modo de teste ativo: respondo só a "Mensagem para mim" e a ${JSON.stringify(bot.modo_teste.numeros ?? [])}`);
}

const whats = await conectar({
  aceitarConversaPropria: emTeste,
  async aoReceber({ jid, telefone, texto, propria }) {
    if (!propria && !numeroPermitido(bot, telefone)) return;
    const respostas = await responder({ db, bot, jid, telefone, texto });
    for (const resposta of respostas) {
      await esperar(aleatorioEntre(1000, 2500)); // resposta instantânea demais parece robô
      await whats.enviar(jid, resposta);
    }
  },
  async aoResponderManual({ jid }) {
    if (emTeste) return; // em teste, suas conversas normais não mexem no estado do bot
    const agora = Date.now();
    db.pausarConversa(jid, agora + (bot.pausa_atendente_horas ?? 12) * HORA, agora);
  },
});

if (loja) {
  console.log(`[sync] plataforma: ${plataforma}, a cada ${syncIntervaloMin} min`);
  const rodar = () => sincronizar({ db, loja, bot }).catch((e) => console.error('[sync] falhou:', e.message));
  await rodar();
  setInterval(rodar, syncIntervaloMin * 60 * 1000);
} else {
  console.log('[sync] LOJA_PLATAFORMA=nenhuma: sem sincronização com plataforma de loja');
}

// Encerra atendimentos parados. Ao iniciar, fecha em silêncio o que ficou aberto
// enquanto o bot estava desligado, para não mandar aviso com horas de atraso.
encerrarInativas({ db, bot });
setInterval(async () => {
  if (!whats.conectado) return;
  for (const { jid, texto } of encerrarInativas({ db, bot })) {
    await whats.enviar(jid, texto).catch((e) => console.error('[sessao] falha ao avisar encerramento:', e.message));
  }
}, 30 * 1000);

// Avisos de pedido (da plataforma e dos pedidos feitos pelo WhatsApp).
iniciarNotificador({ db, bot, whats });
