#!/usr/bin/env python3
"""Generate a Folium map from Italian municipalities GeoJSON."""

from __future__ import annotations

import json
from pathlib import Path

import folium

ROOT = Path(__file__).resolve().parent
GEOJSON_PATH = ROOT / "databasefiles" / "limits_IT_municipalities.geojson"
OUTPUT_PATH = ROOT / "folium_map.html"


def build_map() -> None:
    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = data.get("features", [])

    m = folium.Map(
        location=[41.9, 12.5],
        zoom_start=6,
        tiles="OpenStreetMap",
        control_scale=True,
    )

    tooltip_fields = []
    tooltip_aliases = []
    if features:
        props = features[0].get("properties", {}) or {}
        for field, alias in (
            ("name", "Municipality"),
            ("prov_name", "Province"),
            ("reg_name", "Region"),
        ):
            if field in props:
                tooltip_fields.append(field)
                tooltip_aliases.append(alias)

    tooltip = None
    if tooltip_fields:
        tooltip = folium.GeoJsonTooltip(
            fields=tooltip_fields,
            aliases=tooltip_aliases,
            localize=True,
            sticky=True,
            labels=True,
        )

    folium.GeoJson(
        data,
        name="Italian Municipalities",
        style_function=lambda _: {
            "fillColor": "#d8b07a",
            "color": "#6b1a27",
            "weight": 0.5,
            "fillOpacity": 0.2,
        },
        highlight_function=lambda _: {
            "fillColor": "#f2d7ad",
            "color": "#9b1422",
            "weight": 1.2,
            "fillOpacity": 0.35,
        },
        tooltip=tooltip,
    ).add_to(m)

    folium.LayerControl(collapsed=True).add_to(m)

    m.save(str(OUTPUT_PATH))
    print(f"Wrote {OUTPUT_PATH.name} with {len(features)} municipalities.")


if __name__ == "__main__":
    build_map()
