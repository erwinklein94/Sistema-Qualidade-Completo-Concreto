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

      const chip=document.getElementById('user-chip');
      if(chip)chip.textContent=`${perfil.nome||perfil.email} · ${Auth.rotuloPerfil(perfil)}`;
      iniciarRealtime(cliente);
      document.body.classList.remove('auth-loading');
      document.body.classList.add('authed');
      await carregar('js/madeira-lei-operacao.js?v=20260914-integrado-v1');
      await carregar('js/madeira-lei-tema.js?v=20260914-integrado-v1');
    }catch(err){
      console.error('Falha ao iniciar a área operacional de madeira',err);
      if(estado)estado.textContent=`Não foi possível abrir a área: ${err.message||err}`;
    }
  });
})();
