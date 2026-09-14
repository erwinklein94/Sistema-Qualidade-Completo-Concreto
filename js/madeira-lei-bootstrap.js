'use strict';
(function(){
  function carregar(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`Não foi possível carregar ${src}.`));
      document.body.appendChild(script);
    });
  }

  function iniciarRealtime(cliente){
    let canal=null;
    window.SiteRealtime={
      start(){
        if(canal||!cliente)return;
        canal=cliente.channel('madeira-lei-operacao')
          .on('postgres_changes',{event:'*',schema:'public',table:'madeira_lei_registros'},payload=>{
            window.dispatchEvent(new CustomEvent('site:data-changed',{detail:payload}));
          })
          .subscribe();
      },
      stop(){
        if(!canal)return;
        cliente.removeChannel(canal);
        canal=null;
      }
    };
    window.SiteRealtime.start();
  }

  const paginas={
    dashboard:{
      menu:'madeira-lei-dashboard',
      titulo:'Dashboard Operacional — DM Lei',
      subtitulo:'Acompanhamento de pedidos, inspeção e transporte de dormentes de madeira de lei'
    },
    registros:{
      menu:'madeira-lei-registros',
      titulo:'Registros Operacionais — DM Lei',
      subtitulo:'Consulta dos pedidos e volumes operacionais de dormentes de madeira de lei'
    }
  };

  function viewAtual(){
    const view=(location.hash||'#dashboard').slice(1);
    return paginas[view]?view:'dashboard';
  }

  function sincronizarTemaModulo(){
    const escuro=App.temaAtual()==='escuro';
    if(escuro)document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    if(window.DashboardUI?.onThemeChange)window.DashboardUI.onThemeChange();
  }

  window.MadeiraLeiAtualizarCabecalho=view=>{
    const pagina=paginas[view]||paginas.dashboard;
    App.paginaAtiva=pagina.menu;
    const titulo=document.querySelector('.topo-identidade h1');
    const subtitulo=document.querySelector('.topo-identidade .subtitulo');
    if(titulo)titulo.textContent=pagina.titulo;
    if(subtitulo)subtitulo.textContent=pagina.subtitulo;
    App.atualizarMenuPorPermissoes();
  };

  document.addEventListener('DOMContentLoaded',async()=>{
    const estado=document.getElementById('integracaoEstado');
    try{
      if(!await Auth.exigirLogin())return;
      const perfil=window.USUARIO_ATUAL?.perfil;
      const cliente=Auth.cliente();
      if(!perfil||!cliente)throw new Error('Sessão do sistema principal indisponível.');

      window.sbClient=cliente;
      window.currentProfile={
        id:perfil.id,
        nome:perfil.nome,
        email:perfil.email,
        role:perfil.perfil
      };
      window.AccessControl={
        isFull:role=>role==='admin'||role==='fiscalizacao',
        canView:view=>view==='dashboard'||view==='registros'
      };

      const pagina=paginas[viewAtual()];
      App.montarLayout(pagina.menu,pagina.titulo,pagina.subtitulo);
      sincronizarTemaModulo();
      window.addEventListener('temaAlterado',sincronizarTemaModulo);
      iniciarRealtime(cliente);
      document.body.classList.remove('auth-loading');
      document.body.classList.add('authed');
      if(estado)estado.remove();
      await carregar('js/madeira-lei-operacao.js?v=20260914-dm-lei-cabecalho-v1');
    }catch(err){
      console.error('Falha ao iniciar a área operacional de madeira',err);
      if(estado)estado.textContent=`Não foi possível abrir a área: ${err.message||err}`;
    }
  });
})();
