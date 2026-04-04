import sqlite3
import requests
import json

conn = sqlite3.connect("test.db")
cursor = conn.cursor()

cursor.execute("""

CREATE TABLE IF NOT EXISTS trails(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL,
    length_km REAL,
    elevation_gain_m REAL,
    geom TEXT NOT NULL,
    country TEXT,
    region TEXT,
    environmental_info TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")

# Functions
def import_data(
    name,
    description,
    difficulty,
    length_km,
    elevation,
    geom,
    country,
    region,
    environmental_info,
    last_updated
):


    query = """
    INSERT INTO trails (
        name,
        description,
        difficulty,
        length_km,
        elevation,
        geom,
        country,
        region,
        environmental_info,
        last_updated
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    data = (
        name,
        description,
        difficulty,
        length_km,
        elevation,
        geom,
        country,
        region,
        environmental_info,
        last_updated
    )

    cursor.execute(query, data)
    conn.commit()

def ai_content():
    
    API_KEY = "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"
    response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "model": "mistralai/mistral-7b-instruct:free",
        "messages": [
            {"role": "user", "content": "Explain Python like I'm 10 years old"}
        ]
    }
    )

    data = response.json()

    print(data)


ai_content()