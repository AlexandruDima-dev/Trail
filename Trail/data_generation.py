# trail_cli.py
import sqlite3
import requests
import json
from rich import print
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from rich.table import Table

console = Console()

# ===== CONFIG =====
API_KEY = "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"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
FREE_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

DB_FILE = "database.db"

# ===== DATABASE CONNECTION =====
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

# ===== FUNCTION: ASK AI FOR TRAILS =====
def ask_ai_for_trails(country, number):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    prompt = f"""
    Give me {number} hiking trails in {country} in JSON format.
    Each trail must have:
    name, description, difficulty, length_km, elevation_gain_m, geom, country, region, environmental_info.
    Output a JSON array like:
    [
      {{
        "name": "...",
        "description": "...",
        "difficulty": "...",
        "length_km": 0,
        "elevation_gain_m": 0,
        "geom": "[[lon,lat],[lon,lat],...]",
        "country": "...",
        "region": "...",
        "environmental_info": "..."
      }}
    ]
    """

    data = {
        "model": FREE_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post(OPENROUTER_URL, headers=headers, json=data)
    try:
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        return content
    except Exception as e:
        console.print(f"[red]Error fetching AI data:[/red] {e}")
        return None

# ===== FUNCTION: INSERT INTO DATABASE =====
def insert_trail(trail):
    cursor.execute("""
    INSERT INTO trails
    (name, description, difficulty, length_km, elevation_gain_m, geom, country, region, environmental_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trail.get("name"),
        trail.get("description"),
        trail.get("difficulty"),
        trail.get("length_km"),
        trail.get("elevation_gain_m"),
        trail.get("geom"),
        trail.get("country"),
        trail.get("region"),
        trail.get("environmental_info")
    ))
    conn.commit()
    console.print(f"[green]✅ '{trail.get('name')}' saved to the database![/green]")

# ===== FUNCTION: DISPLAY TRAIL =====
def display_trail(trail):
    table = Table(title="Trail Preview", style="bright_cyan")
    table.add_column("Field", style="yellow", no_wrap=True)
    table.add_column("Value", style="white")
    for key, value in trail.items():
        table.add_row(key, str(value))
    console.print(table)

# ===== FUNCTION: PARSE AI JSON =====
def parse_ai_json(content):
    try:
        start = content.find("[")
        end = content.rfind("]") + 1
        json_str = content[start:end]
        trails = json.loads(json_str)
        return trails
    except Exception as e:
        console.print(f"[red]Failed to parse AI JSON:[/red] {e}")
        return None

# ===== MAIN LOOP =====
def main():
    console.print(Panel("[bold bright_green]Trail Generator CLI[/bold bright_green]", expand=False))

    country = Prompt.ask("[bold cyan]Enter the country for trails[/bold cyan]")
    number = Prompt.ask("[bold cyan]How many trails to generate?[/bold cyan]", default="1")
    try:
        number = int(number)
    except ValueError:
        console.print("[red]Invalid number, defaulting to 1[/red]")
        number = 1

    ai_response = ask_ai_for_trails(country, number)
    if not ai_response:
        return

    trails = parse_ai_json(ai_response)
    if not trails:
        console.print("[red]AI returned invalid data.[/red]")
        return

    for trail in trails:
        display_trail(trail)
        if Confirm.ask("[bold yellow]Save this trail to the database?[/bold yellow]"):
            insert_trail(trail)

    console.print("[bold green]All done![/bold green]")

if __name__ == "__main__":
    main()


#API KEY FROM OPEN ROUTER - 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

