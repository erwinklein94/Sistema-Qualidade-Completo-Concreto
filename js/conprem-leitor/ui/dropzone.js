// Área de importação: clique, seleção por teclado e arrastar-e-soltar.

const ehPdf = (arquivo) =>
  arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);

/**
 * @param {HTMLElement} zona
 * @param {HTMLInputElement} entrada
 * @param {(arquivos: File[]) => void} aoReceber
 */
export function iniciarDropzone(zona, entrada, aoReceber) {
  const entregar = (lista) => {
    const arquivos = [...lista].filter(ehPdf);
    if (arquivos.length) aoReceber(arquivos);
  };

  entrada.addEventListener('change', () => {
    entregar(entrada.files);
    // permite reenviar o mesmo arquivo depois de limpar
    entrada.value = '';
  });

  for (const evento of ['dragenter', 'dragover']) {
    zona.addEventListener(evento, (e) => {
      e.preventDefault();
      zona.dataset.arrastando = 'true';
    });
  }

  for (const evento of ['dragleave', 'dragend']) {
    zona.addEventListener(evento, (e) => {
      // ignora a saída para elementos filhos
      if (e.relatedTarget && zona.contains(e.relatedTarget)) return;
      zona.dataset.arrastando = 'false';
    });
  }

  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.dataset.arrastando = 'false';
    entregar(e.dataTransfer?.files || []);
  });
}

/** Renderiza a lista de arquivos aceitos. */
export function desenharArquivos(alvo, arquivos, aoRemover) {
  alvo.replaceChildren();

  arquivos.forEach((item, indice) => {
    const li = document.createElement('li');
    li.className = 'arquivo';

    const info = document.createElement('div');
    const nome = document.createElement('div');
    nome.className = 'arquivo__nome';
    nome.textContent = item.arquivo.name;
    const meta = document.createElement('div');
    meta.className = 'arquivo__meta';
    meta.textContent = `${(item.arquivo.size / 1024).toFixed(0)} KB`;
    info.append(nome, meta);

    const selo = document.createElement('span');
    if (item.modelo) {
      selo.className = 'selo selo--ok';
      selo.textContent = item.modelo;
    } else if (item.erro) {
      selo.className = 'selo selo--erro';
      selo.textContent = 'não reconhecido';
    } else {
      selo.className = 'selo selo--info';
      selo.textContent = 'lendo…';
    }

    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'arquivo__remover';
    remover.innerHTML = '&times;';
    remover.setAttribute('aria-label', `Remover ${item.arquivo.name}`);
    remover.addEventListener('click', () => aoRemover(indice));

    li.append(info, selo, remover);
    alvo.append(li);
  });
}
