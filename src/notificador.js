import { numeroPermitido } from './teste.js';
import { aleatorioEntre, esperar } from './util.js';

export function dentroDoHorario(horario, data = new Date()) {
  if (!horario) return true;
  const [inicio, fim] = horario;
  const hora = data.getHours();
  return hora >= inicio && hora < fim;
}

/**
 * Envia a fila de avisos de pedido, uma mensagem por vez, com intervalo
 * aleatório entre elas e só dentro do horário configurado.
 */
export async function iniciarNotificador({ db, bot, whats }) {
  const cfg = bot.notificacoes ?? {};
  const [min, max] = cfg.intervalo_segundos ?? [8, 20];

  for (;;) {
    // Fora do horário, clientes esperam; avisos para o dono da loja saem na hora.
    const soDono = !dentroDoHorario(cfg.horario_envio);
    const item = whats.conectado ? db.proximaNotificacao({ soDono }) : null;
    if (!item) {
      await esperar(15000);
      continue;
    }
    const paraDono = item.telefone === 'dono';
    if (!paraDono && !numeroPermitido(bot, item.telefone)) {
      db.marcarNotificacao(item.id, 'ignorada', { erro: 'modo de teste: número fora da lista' });
      continue;
    }
    try {
      const jid = paraDono ? whats.meuJid() : await whats.resolverJid(item.telefone);
      if (!jid) {
        db.marcarNotificacao(item.id, 'falhou', { erro: 'número sem WhatsApp' });
      } else {
        await whats.enviar(jid, item.texto);
        db.marcarNotificacao(item.id, 'enviada');
        console.log(`[aviso] pedido ${item.pedido_id}: ${item.evento} enviado`);
      }
    } catch (erro) {
      db.marcarNotificacao(item.id, 'falhou', { erro: erro.message });
      console.error(`[aviso] pedido ${item.pedido_id}: falhou (${erro.message})`);
    }
    await esperar(aleatorioEntre(min, max) * 1000);
  }
}
