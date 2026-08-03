"""Create the SQLite database and load the demo catalogue.

Run from the backend directory:

    python -m database.seed

Re-running replaces the catalogue; the table is rewritten from scratch.
"""

from __future__ import annotations

import json
import sqlite3

from database.db import connect, get_db_path, init_schema

PACKAGES: list[dict[str, object]] = [
    {
        "id": 1,
        "name": "Paradise Beach Package",
        "destination": "Maragogi",
        "country": "Brazil",
        "category": "beach",
        "description": "Natural pools, warm water and all-inclusive resorts on the Alagoas coast.",
        "days": 7,
        "price": 3500.0,
        "max_people": 4,
        "best_months": ["December", "January", "February"],
    },
    {
        "id": 2,
        "name": "Gramado Winter Experience",
        "destination": "Gramado",
        "country": "Brazil",
        "category": "cold",
        "description": "Mountain town with chocolate shops, fondue and the Natal Luz festival.",
        "days": 5,
        "price": 2800.0,
        "max_people": 4,
        "best_months": ["June", "July"],
    },
    {
        "id": 3,
        "name": "Natal Beach Holiday",
        "destination": "Natal",
        "country": "Brazil",
        "category": "beach",
        "description": "Dunes, buggy rides and calm beaches along the Rio Grande do Norte shore.",
        "days": 6,
        "price": 4200.0,
        "max_people": 4,
        "best_months": ["December", "January"],
    },
    {
        "id": 4,
        "name": "Rio Highlights City Break",
        "destination": "Rio de Janeiro",
        "country": "Brazil",
        "category": "city",
        "description": "Christ the Redeemer, Sugarloaf and Copacabana in a compact long weekend.",
        "days": 4,
        "price": 2400.0,
        "max_people": 4,
        "best_months": ["March", "April", "September", "October"],
    },
    {
        "id": 5,
        "name": "Chapada Diamantina Trekking",
        "destination": "Chapada Diamantina",
        "country": "Brazil",
        "category": "adventure",
        "description": "Guided treks to waterfalls, caves and plateau viewpoints in Bahia.",
        "days": 8,
        "price": 5200.0,
        "max_people": 6,
        "best_months": ["May", "June", "July", "August"],
    },
    {
        "id": 6,
        "name": "Ouro Preto Colonial Route",
        "destination": "Ouro Preto",
        "country": "Brazil",
        "category": "culture",
        "description": "Baroque churches, cobbled streets and mining history in Minas Gerais.",
        "days": 4,
        "price": 1900.0,
        "max_people": 4,
        "best_months": ["April", "May", "September"],
    },
    {
        "id": 7,
        "name": "Amazon River Expedition",
        "destination": "Manaus",
        "country": "Brazil",
        "category": "nature",
        "description": "Riverboat lodging, igarape canoeing and wildlife spotting in the rainforest.",
        "days": 6,
        "price": 6800.0,
        "max_people": 8,
        "best_months": ["July", "August", "September"],
    },
    {
        "id": 8,
        "name": "Fernando de Noronha Escape",
        "destination": "Fernando de Noronha",
        "country": "Brazil",
        "category": "beach",
        "description": "Protected marine park with diving, snorkelling and near-empty beaches.",
        "days": 5,
        "price": 9800.0,
        "max_people": 2,
        "best_months": ["September", "October", "November"],
    },
    {
        "id": 9,
        "name": "Bariloche Snow Week",
        "destination": "Bariloche",
        "country": "Argentina",
        "category": "cold",
        "description": "Ski slopes on Cerro Catedral plus lakeside chalets in Patagonia.",
        "days": 7,
        "price": 7400.0,
        "max_people": 4,
        "best_months": ["June", "July", "August"],
    },
    {
        "id": 10,
        "name": "Buenos Aires Tango Weekend",
        "destination": "Buenos Aires",
        "country": "Argentina",
        "category": "city",
        "description": "Steakhouses, San Telmo markets and a tango show in the Argentine capital.",
        "days": 4,
        "price": 3100.0,
        "max_people": 4,
        "best_months": ["March", "April", "October", "November"],
    },
    {
        "id": 11,
        "name": "Cusco and Machu Picchu Trail",
        "destination": "Cusco",
        "country": "Peru",
        "category": "culture",
        "description": "Inca ruins, the Sacred Valley and a guided visit to Machu Picchu.",
        "days": 9,
        "price": 8600.0,
        "max_people": 6,
        "best_months": ["May", "June", "July", "August"],
    },
    {
        "id": 12,
        "name": "Bonito Freshwater Adventure",
        "destination": "Bonito",
        "country": "Brazil",
        "category": "nature",
        "description": "Snorkelling in crystal-clear rivers, caves and waterfalls in Mato Grosso do Sul.",
        "days": 5,
        "price": 4600.0,
        "max_people": 6,
        "best_months": ["March", "April", "May", "September"],
    },
]

_COLUMNS = (
    "id",
    "name",
    "destination",
    "country",
    "category",
    "description",
    "days",
    "price",
    "max_people",
    "best_months",
)


def seed(connection: sqlite3.Connection) -> int:
    init_schema(connection)
    connection.execute("DELETE FROM travel_packages")
    connection.executemany(
        f"INSERT INTO travel_packages ({', '.join(_COLUMNS)}) "
        f"VALUES ({', '.join('?' for _ in _COLUMNS)})",
        [
            tuple(
                json.dumps(package[column])
                if column == "best_months"
                else package[column]
                for column in _COLUMNS
            )
            for package in PACKAGES
        ],
    )
    connection.commit()
    return len(PACKAGES)


def main() -> None:
    connection = connect()
    try:
        count = seed(connection)
    finally:
        connection.close()
    print(f"Seeded {count} travel packages into {get_db_path()}")


if __name__ == "__main__":
    main()
