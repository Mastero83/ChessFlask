from pymongo import MongoClient

client = MongoClient('localhost', 27017)
db = client['chessclub']
coll = db['library_games']

indexes = [
    'opening',
    'headers.White',
    'headers.Black',
    'headers.Date',
    'headers.Result',
    'headers.Event',
    'headers.Site',
]

for field in indexes:
    result = coll.create_index(field)
    print(f"Created index: {result} on field: {field}") 