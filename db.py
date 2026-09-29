import sqlite3
import os
from config import Config

def get_db():
    """Returns a SQLite connection configured with Row factory."""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initializes the database using schema.sql and ensures required directories exist."""
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(Config.SAMPLE_FOLDER, exist_ok=True)
    
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
        
    conn = get_db()
    with conn:
        conn.executescript(schema_sql)
    conn.close()
    print("Database initialized successfully.")

def query_db(query, args=(), one=False):
    """Convenience helper to query database rows as dictionaries."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    cur.close()
    conn.close()
    if one:
        return dict(rv[0]) if rv else None
    return [dict(row) for row in rv]

def execute_db(query, args=(), return_id=False):
    """Executes a database write statement."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    last_id = cur.lastrowid
    cur.close()
    conn.close()
    return last_id if return_id else True
