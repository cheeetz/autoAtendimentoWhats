import { existsSync, readFileSync } from 'node:fs';

// Carrega o .env (se existir) e o config/bot.json.
// Sem bot.json, usa o exemplo para o bot subir já no primeiro teste.
export function carregarConfig() {
  if (existsSync('.env')) process.loadEnvFile('.env');

  let caminho = 'config/bot.json';
  if (!existsSync(caminho)) {
    caminho = 'config/bot.example.json';
    console.warn('[config] config/bot.json não encontrado; usando config/bot.example.json');
  }
  const bot = JSON.parse(readFileSync(caminho, 'utf8'));

  return {
    bot,
    plataforma: (process.env.LOJA_PLATAFORMA || 'nenhuma').toLowerCase(),
    syncIntervaloMin: Number(process.env.SYNC_INTERVALO_MINUTOS || 5),
    env: process.env,
  };
}
