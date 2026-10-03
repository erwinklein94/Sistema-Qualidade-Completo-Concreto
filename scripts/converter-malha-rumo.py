"""Converte os pontos do KMZ fornecido em GeoJSON, sem executar o HTML do KML.

Uso: python scripts/converter-malha-rumo.py arquivo.kmz.zip assets/data/malha-rumo.geojson
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser


class Texto(HTMLParser):
    def __init__(self):
        super().__init__()
        self.partes = []

    def handle_data(self, data):
        self.partes.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'div', 'p'):
            self.partes.append(' ')


def converter(origem, destino):
    ns = {'k': 'http://www.opengis.net/kml/2.2'}
    with zipfile.ZipFile(origem) as arquivo:
        nomes = [n for n in arquivo.namelist() if n.lower().endswith('.kml')]
        if len(nomes) != 1:
            raise ValueError('Esperado exatamente um KML dentro do arquivo.')
        raiz = ET.fromstring(arquivo.read(nomes[0]))
    pontos = []
    for item in raiz.findall('.//k:Placemark', ns):
        coordenadas = item.findall('k:Point/k:coordinates', ns)
        if len(coordenadas) != 1:
            raise ValueError('Geometria diferente de ponto: revisar antes de converter.')
        valores = [float(v) for v in coordenadas[0].text.strip().split(',')]
        lon, lat = valores[:2]
        if not all(math.isfinite(v) for v in valores) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError('Coordenadas inválidas no arquivo de origem.')
        texto = Texto()
        texto.feed(item.findtext('k:description', '', ns))
        pontos.append({
            'type': 'Feature',
            'properties': {
                'nome': item.findtext('k:name', '', ns),
                'descricao': ' '.join(''.join(texto.partes).split()),
            },
            'geometry': {'type': 'Point', 'coordinates': valores},
        })
    colecao = {
        'type': 'FeatureCollection',
        'metadata': {
            'origem': origem.name,
            'sha256': hashlib.sha256(origem.read_bytes()).hexdigest(),
            'totalPontos': len(pontos),
            'observacao': 'Pontos originais do KML; não foram inferidas linhas entre eles.',
        },
        'features': pontos,
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(colecao, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(pontos)} pontos preservados em {destino} ({destino.stat().st_size} bytes)')


if __name__ == '__main__':
    converter(Path(sys.argv[1]), Path(sys.argv[2]))
