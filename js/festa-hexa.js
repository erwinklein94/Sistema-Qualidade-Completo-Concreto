/* =====================================================================
   FESTA-HEXA.JS — Comemoração da Copa do Mundo "Rumo ao Hexa!!!"
   20260610-copa-hexa-v1

   Sempre que uma gravação no Supabase é confirmada (novo documento ou
   lançamento), o site solta confetes nas cores do Brasil, bolas de
   futebol e o letreiro "Rumo ao Hexa!!!" caindo do topo da tela.

   - Gancho automático: embrulha todas as funções salvar* dos stores
     (StoreSupabase e StoreSubcomponentesSupabase). Telas que gravam
     direto no Supabase (Data books, migração) chamam FestaHexa.celebrar().
   - Liga/desliga GLOBAL: o admin alterna na página Dados do Sistema e a
     decisão vale para TODOS os perfis (admin, fiscalização e consulta).
     A configuração fica no Supabase (configuracoes_sistema, chave
     festa_hexa_ativa) e é lida no carregamento de cada página; o
     localStorage funciona apenas como cache local da leitura.
   ===================================================================== */

const FestaHexa = (() => {
  const CHAVE_CONFIG = 'festa_hexa_ativa';      // chave global no Supabase
  const CHAVE_CACHE = 'sq_festa_hexa_ativa';    // cache local da última leitura
  const DURACAO_MS = 4500;
  let rodando = false;
  let cssInjetado = false;

  function ativa() {
    try { return localStorage.getItem(CHAVE_CACHE) !== '0'; } catch (e) { return true; }
  }

  function gravarCache(ligada) {
    try { localStorage.setItem(CHAVE_CACHE, ligada ? '1' : '0'); } catch (e) { /* ignora */ }
  }

  // Lê a configuração global no Supabase e atualiza o cache local.
  // Valor '0' = desativada; ausência da chave ou qualquer outro valor = ativada.
  async function sincronizar() {
    try {
      if (!window.StoreSupabase?.obterConfiguracaoSistema) return ativa();
      const cfg = await StoreSupabase.obterConfiguracaoSistema(CHAVE_CONFIG);
      gravarCache(String(cfg?.valor ?? '1').trim() !== '0');
    } catch (e) { /* sem conexão/tabela: mantém o cache */ }
    return ativa();
  }

  // Admin: grava a decisão no Supabase para valer em todo o site.
  async function definir(ligada) {
    gravarCache(ligada);
    await StoreSupabase.salvarConfiguracaoSistema({
      chave: CHAVE_CONFIG,
      valor: ligada ? '1' : '0',
    });
    return ativa();
  }

  function alternar() { return definir(!ativa()); }

  /* ---------- estilos (injetados uma única vez) ---------- */
  function injetarCss() {
    if (cssInjetado) return;
    cssInjetado = true;
    const st = document.createElement('style');
    st.id = 'festaHexaCss';
    st.textContent = `
      .festa-hexa-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden}
      .festa-hexa-confete{position:absolute;top:-4vh;border-radius:2px;opacity:.95;
        animation:festaHexaQueda linear forwards}
      .festa-hexa-emoji{position:absolute;top:-8vh;line-height:1;
        animation:festaHexaQuedaEmoji ease-in forwards;
        text-shadow:0 4px 12px rgba(0,0,0,.25)}
      @keyframes festaHexaQueda{
        0%{transform:translateY(0) rotate(0deg)}
        100%{transform:translateY(112vh) rotate(720deg)}
      }
      @keyframes festaHexaQuedaEmoji{
        0%{transform:translateY(0) rotate(-20deg)}
        50%{transform:translateY(55vh) rotate(15deg)}
        100%{transform:translateY(112vh) rotate(-25deg)}
      }
      .festa-hexa-banner{position:absolute;left:0;right:0;top:42%;display:flex;justify-content:center;
        animation:festaHexaBanner 4.4s cubic-bezier(.22,1.1,.36,1) forwards}
      .festa-hexa-banner span{
        font-weight:900;font-size:clamp(34px,7vw,84px);letter-spacing:1px;white-space:nowrap;
        background:linear-gradient(180deg,#FEDD00 0%,#FEDD00 42%,#009739 58%,#009739 100%);
        -webkit-background-clip:text;background-clip:text;color:transparent;
        -webkit-text-stroke:2px #002776;
        filter:drop-shadow(0 6px 18px rgba(0,39,118,.45));
        transform:rotate(-3deg)}
      @keyframes festaHexaBanner{
        0%{transform:translateY(-70vh);opacity:0}
        18%{opacity:1}
        55%{transform:translateY(0)}
        62%{transform:translateY(-2.5vh)}
        70%{transform:translateY(0)}
        86%{opacity:1}
        100%{transform:translateY(0);opacity:0}
      }
      @media (prefers-reduced-motion: reduce){
        .festa-hexa-overlay{display:none}
      }
    `;
    document.head.appendChild(st);
  }

  /* ---------- a festa em si ---------- */
  function celebrar() {
    sincronizar(); // em segundo plano: abas abertas captam a decisão do admin no próximo evento
    if (!ativa() || rodando || !document.body) return;
    rodando = true;
    injetarCss();

    const overlay = document.createElement('div');
    overlay.className = 'festa-hexa-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    // Confetes nas cores do Brasil
    const cores = ['#009739', '#FEDD00', '#002776', '#FFFFFF'];
    for (let i = 0; i < 130; i++) {
      const c = document.createElement('div');
      c.className = 'festa-hexa-confete';
      const lado = 6 + Math.random() * 9;
      c.style.left = (Math.random() * 100) + 'vw';
      c.style.width = lado + 'px';
      c.style.height = (lado * (0.6 + Math.random())) + 'px';
      c.style.background = cores[i % cores.length];
      c.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * 0.9) + 's';
      overlay.appendChild(c);
    }

    // Itens de futebol caindo junto
    const emojis = ['⚽', '🏆', '🇧🇷', '⚽', '🥅', '⚽', '🏆', '🇧🇷', '👟', '⚽', '🎉', '⚽'];
    emojis.forEach((e, i) => {
      const el = document.createElement('div');
      el.className = 'festa-hexa-emoji';
      el.textContent = e;
      el.style.left = (4 + Math.random() * 92) + 'vw';
      el.style.fontSize = (26 + Math.random() * 22) + 'px';
      el.style.animationDuration = (2.6 + Math.random() * 1.6) + 's';
      el.style.animationDelay = (i * 0.12 + Math.random() * 0.4) + 's';
      overlay.appendChild(el);
    });

    // Letreiro central caindo de cima para baixo
    const banner = document.createElement('div');
    banner.className = 'festa-hexa-banner';
    banner.innerHTML = '<span>Rumo ao Hexa!!!</span>';
    overlay.appendChild(banner);

    document.body.appendChild(overlay);
    setTimeout(() => { overlay.remove(); rodando = false; }, DURACAO_MS);
  }

  /* ---------- gancho automático nas gravações dos stores ---------- */
  function embrulharStore(store) {
    if (!store || store.__festaHexa) return;
    Object.keys(store).forEach(nome => {
      if (!/^salvar/.test(nome) || typeof store[nome] !== 'function') return;
      const original = store[nome];
      store[nome] = function (...args) {
        const resultado = original.apply(this, args);
        if (resultado && typeof resultado.then === 'function') {
          resultado.then(() => celebrar()).catch(() => { /* erro: sem festa */ });
        } else {
          celebrar();
        }
        return resultado;
      };
    });
    store.__festaHexa = true;
  }

  function instalarGanchos() {
    embrulharStore(window.StoreSupabase);
    embrulharStore(window.StoreSubcomponentesSupabase);
  }

  instalarGanchos();
  document.addEventListener('DOMContentLoaded', () => {
    instalarGanchos();
    sincronizar(); // lê a decisão global do admin no Supabase
  });

  return { celebrar, ativa, definir, alternar, sincronizar };
})();

window.FestaHexa = FestaHexa;
