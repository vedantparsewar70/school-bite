import sqlite3
import json

con = sqlite3.connect('prisma/dev.db')
con.row_factory = sqlite3.Row
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").fetchall()]
print(f"Total Tables in SQLite: {len(tables)}")

data = {}
for t in tables:
    rows = [dict(r) for r in cur.execute(f'SELECT * FROM "{t}"').fetchall()]
    data[t] = rows
    print(f"  {t}: {len(rows)} rows")

with open('prisma/sqlite_dump.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, default=str)

print("\nDumped full SQLite database to prisma/sqlite_dump.json successfully!")
