#!/usr/bin/env python3
"""Agrège séismes (USGS) et événements naturels (NASA EONET) en un JSON unique."""
import json
import urllib.request
from datetime import datetime, timezone, timedelta

USGS_URL = (
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
)
EONET_URL = (
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300&days=20"
)

EONET_CATEGORY_MAP = {
    "wildfires": "feu",
    "severeStorms": "tempete",
    "volcanoes": "volcan",
    "floods": "inondation",
    "drought": "secheresse",
    "seaLakeIce": "glace",
    "landslides": "glissement",
    "snow": "neige",
    "tempExtremes": "temperature",
    "dustHaze": "poussiere",
}


def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "catastrophes-mondiales-bot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def quake_severity(mag):
    if mag >= 7:
        return "extreme"
    if mag >= 6:
        return "severe"
    if mag >= 5:
        return "modere"
    return "faible"


def build_earthquakes():
    events = []
    try:
        data = fetch_json(USGS_URL)
    except Exception as exc:
        print(f"USGS fetch failed: {exc}")
        return events

    for feature in data.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
        mag = props.get("mag")
        if mag is None:
            continue
        ts = props.get("time")
        date_iso = (
            datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
            if ts
            else None
        )
        events.append(
            {
                "id": "usgs-" + str(feature.get("id")),
                "source": "USGS",
                "category": "seisme",
                "title": props.get("place") or "Séisme",
                "lat": coords[1],
                "lon": coords[0],
                "magnitude": mag,
                "severity": quake_severity(mag),
                "date": date_iso,
                "url": props.get("url"),
            }
        )
    return events


def build_eonet():
    events = []
    try:
        data = fetch_json(EONET_URL)
    except Exception as exc:
        print(f"EONET fetch failed: {exc}")
        return events

    for item in data.get("events", []):
        categories = item.get("categories", [])
        cat_id = categories[0].get("id") if categories else None
        category = EONET_CATEGORY_MAP.get(cat_id, "autre")
        geometries = item.get("geometry", [])
        if not geometries:
            continue
        geo = geometries[-1]
        coords = geo.get("coordinates")
        if not coords:
            continue
        # Points EONET : [lon, lat] ; certains polygones (feux) : ignorés ici.
        if geo.get("type") != "Point":
            continue
        lon, lat = coords[0], coords[1]
        sources = item.get("sources", [])
        url = sources[0].get("url") if sources else None
        events.append(
            {
                "id": "eonet-" + str(item.get("id")),
                "source": "NASA EONET",
                "category": category,
                "title": item.get("title") or "Événement",
                "lat": lat,
                "lon": lon,
                "magnitude": None,
                "severity": "modere",
                "date": geo.get("date"),
                "url": url,
            }
        )
    return events


def main():
    events = build_earthquakes() + build_eonet()
    events.sort(key=lambda e: e.get("date") or "", reverse=True)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(events),
        "sources": ["USGS Earthquake Hazards Program", "NASA EONET"],
        "events": events,
    }

    with open("disasters.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {len(events)} events")


if __name__ == "__main__":
    main()
