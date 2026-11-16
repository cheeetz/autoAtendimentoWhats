// A biblioteca de criptografia usada pelo Baileys (libsignal) imprime no terminal
// o conteúdo das sessões, com chaves privadas, a cada troca de sessão.
// Este filtro descarta essas linhas; os demais logs passam normalmente.
const RUIDO = /^(Closing session|Opening session|Removing old closed session|Session already (closed|open)|Migrating session|Closing open session|Decrypted message with closed session)/;

for (const nivel of ['info', 'warn']) {
  const original = console[nivel].bind(console);
  console[nivel] = (...args) => {
    if (typeof args[0] === 'string' && RUIDO.test(args[0])) return;
    original(...args);
  };
}
