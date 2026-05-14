
GROQ_API_KEY = "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"
import sqlite3
import requests
import json
import time

# =========================
# CONFIG
# =========================

GROQ_API_KEY = "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"
DB_NAME = "trail.db"


# =========================
# DATABASE SETUP
# =========================

def create_database():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        distance REAL,
        duration INTEGER,
        difficulty TEXT,
        trail_type TEXT,
        elevation_gain REAL,
        start_lat REAL,
        start_lng REAL,
        end_lat REAL,
        end_lng REAL,
        geometry TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


def clean_json(text):
    # remove ```json and ```
    text = text.replace("```json", "")
    text = text.replace("```", "")
    return text.strip()


# =========================
# AI FUNCTION
# =========================

def ai(place, geometry, distance, duration, start_lat, start_lng, end_lat, end_lng):

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    prompt = f"""
You are a trail data generator.

Return ONLY valid JSON.

CRITICAL RULES:
- start and end MUST be objects with lat/lng
- NEVER return strings for coordinates
- NO extra text

INPUT:
Place: {place}
Distance (meters): {distance}
Duration (seconds): {duration}
Geometry: {json.dumps(geometry)}

Start: {start_lat}, {start_lng}
End: {end_lat}, {end_lng}

OUTPUT JSON FORMAT:
{{
  "name": "",
  "description": "",
  "distance_km": 0,
  "duration_minutes": 0,
  "difficulty": "easy",
  "trail_type": "",
  "elevation_gain_m": 0,

  "start": {{
    "lat": {start_lat},
    "lng": {start_lng}
  }},

  "end": {{
    "lat": {end_lat},
    "lng": {end_lng}
  }},

  "location": "{place}",
  "geometry": {{}},
  "waypoints": [],
  "safety_notes": [],
  "tags": [],
  "image_suggestions": []
}}
"""

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4
    }

    response = requests.post(url, headers=headers, json=payload)

    # SAFETY CHECK
    try:
        result = response.json()
    except:
        print("❌ Invalid API response:", response.text)
        return None

    if "choices" not in result:
        print("❌ Groq error:", result)
        return None

    content = result["choices"][0]["message"]["content"]

    try:
        cleaned = clean_json(content)
        return json.loads(cleaned)
    except:
        print("❌ JSON parsing failed:")
        print(content)
        return None


# =========================
# SAVE FUNCTION
# =========================

def save_to_db(trail):

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO trails (
        name, description, distance, duration,
        difficulty, trail_type, elevation_gain,
        start_lat, start_lng, end_lat, end_lng,
        geometry, location
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trail["name"],
        trail["description"],
        trail["distance_km"],
        trail["duration_minutes"],
        trail["difficulty"],
        trail["trail_type"],
        trail["elevation_gain_m"],
        trail["start"]["lat"],
        trail["start"]["lng"],
        trail["end"]["lat"],
        trail["end"]["lng"],
        json.dumps(trail["geometry"]),
        trail["location"]
    ))

    conn.commit()
    conn.close()


# =========================
# DISPLAY FUNCTION
# =========================

def show_trail(trail):

    print("\n" + "="*50)
    print("🚶 GENERATED TRAIL")
    print("="*50)

    print("Name:", trail["name"])
    print("Location:", trail["location"])
    print("Distance:", trail["distance_km"], "km")
    print("Duration:", trail["duration_minutes"], "mins")
    print("Difficulty:", trail["difficulty"])

    print("\nDescription:")
    print(trail["description"])

    print("\nTags:", trail["tags"])


# =========================
# CLI
# =========================

def cli():

    print("🚀 Trail Generator Admin Tool")
    time.sleep(1)

    place = input("Enter place: ")

    print("\nGenerating trail...\n")

    geometry = {
        "type": "LineString",
        "coordinates": [[-0.1276, 51.5074], [-0.1425, 51.5155]]
    }

    trail = ai(
        place,
        geometry,
        3200,
        1800,
        51.5074,
        -0.1276,
        51.5155,
        -0.1425
    )

    if not trail:
        print("❌ Failed to generate trail")
        return

    show_trail(trail)

    confirm = input("\nSave to database? (yes/no): ").lower()

    if confirm == "yes":
        save_to_db(trail)
        print("✅ Saved!")
    else:
        print("❌ Discarded")


# =========================
# RUN
# =========================

if __name__ == "__main__":
    create_database()
    cli()