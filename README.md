# autoAtendimentoWhats

Bot de WhatsApp para lojas, que roda no seu próprio computador. Ele faz três coisas:

1. **Atendimento inicial:** responde com um menu, resolve as perguntas repetidas e passa o resto para um atendente humano.
2. **Venda pelo WhatsApp:** mostra o catálogo com foto e preço, coleta nome e endereço (por CEP), registra o pedido e envia o link de pagamento ou o Pix.
3. **Avisos de pedido:** avisa o cliente quando o pedido é pago, enviado, entregue ou cancelado, tanto nos pedidos feitos pelo WhatsApp quanto nos da loja online (Nuvemshop).

É um script único em Node.js, sem Docker e sem servidor de banco de dados: os dados ficam em um arquivo SQLite na sua máquina.

> **Atenção:** o bot conecta pelo WhatsApp Web usando a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys), que **não é a API oficial** da Meta. O número pode ser bloqueado pelo WhatsApp. Use um chip separado do número principal da loja e não use para disparo em massa.

## Como usar

**Leia o [MANUAL.md](MANUAL.md).** Ele mostra, passo a passo, a instalação e onde alterar cada coisa: textos, menu, produtos, fotos, Pix, avisos, horários e o dia a dia dos pedidos.

## Início rápido

Requisitos: [Node.js](https://nodejs.org) 22.13 ou mais novo e um número de WhatsApp para o bot.

```
git clone https://github.com/cheeetz/autoAtendimentoWhats.git
cd autoAtendimentoWhats
npm install
copy .env.example .env
copy config\bot.example.json config\bot.json
npm start
```

No Linux ou Mac, use `cp` no lugar de `copy` e `/` no lugar de `\`.

Na primeira vez aparece um QR Code no terminal. Escaneie em **WhatsApp > Dispositivos conectados > Conectar dispositivo**.

Depois, edite o `config/bot.json` com os dados da sua loja e reinicie o bot.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Inicia o bot |
| `npm run conferir` | Confere se o `config/bot.json` está correto |
| `npm run pedido` | Lista os pedidos feitos pelo WhatsApp |
| `npm run pedido -- W1 pago` | Muda o status de um pedido e avisa o cliente (`pago`, `enviado`, `entregue`, `cancelado`) |
| `npm test` | Roda os testes automatizados |

No Windows, o arquivo `iniciar.bat` inicia o bot e o reinicia sozinho se ele parar.

## O que nunca publicar

`auth/` (quem tem essa pasta está logado no seu número), `data/` (dados de clientes), `.env` e `config/bot.json`. Todos já estão no `.gitignore`.

## Licença

MIT
