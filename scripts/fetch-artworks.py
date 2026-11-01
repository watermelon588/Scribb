import requests, concurrent.futures, json
from pathlib import Path
items = [('roses',436534),('irises',436528),('cypresses',436535),('oleanders',436530),('olives',436536),('venice',437853)]
def download(item):
    name, identifier = item
    data = requests.get(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{identifier}',timeout=30).json()
    assert data['isPublicDomain'], name
    response = requests.get(data['primaryImageSmall'],timeout=45)
    response.raise_for_status()
    Path(f'public/artworks/{name}.jpg').write_bytes(response.content)
    return {'file':f'{name}.jpg','title':data['title'],'artist':data['artistDisplayName'],'source':data['objectURL'],'license':'CC0 / The Metropolitan Museum of Art Open Access','bytes':len(response.content)}
results = list(concurrent.futures.ThreadPoolExecutor(6).map(download,items))
Path('public/artworks/credits.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print([(r['file'],r['bytes']) for r in results])
