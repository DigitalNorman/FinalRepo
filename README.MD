# Digitalizing the Catalogus Baronum

A database that include the first 99 entries in the Catalogus Baronum, an important fuedal registry from the 12th century Kingdom of Sicily.

## Live Site

https://digitalnorman.github.io/Digitalizing-the-Catalogus-Baronum/index.html

## Required Dependencies

### For Viewing the Website Locally

- A modern web browser (Chrome, Edge, Firefox, or Safari).
- A local web server (required for CSV fetch and iframe behavior).
	- Recommended: VS Code Live Server extension.
	- Alternative: Python built-in server.

Start a local server with Python (from project root):

- `python -m http.server 5500`

Then open:

- `http://localhost:5500/index.html`
- `http://localhost:5500/folium_map.html`

### For Regenerating the Folium Map File

- Python 3.9+ (recommended).
- Python package:
	- `folium`

Install map-generation dependency:

- `pip install folium`

Quick dependency checks:

- `python --version`
- `python -c "import folium; print(folium.__version__)"`

## Repository Files

- `index.html` - The home page with the main site navigation and introductory content.
- `findings.html` - The database page that loads the CSV data and displays the searchable combined table.
- `folium_map.html` - The interactive Folium map page with the lord selection panel and commune highlighting logic.
- `folium_map_inner.html` - The generated standalone Folium map rendered inside an iframe on the map page.
- `generate_folium_inner.py` - Python script that regenerates `folium_map_inner.html` from the municipal boundary GeoJSON.
- `generate_folium_map.py` - Legacy generator that writes to `folium_map.html`.
- `sustainability.html` - The sustainability page with citations and ways to maintain and operate the website.
- `medieval.css` - The shared stylesheet for the full site.
- `databasefiles/findings-search.js` - The JavaScript file that reads the CSV files, combines the data, and controls the findings database.
- `databasefiles/Final Baronum - Lords and Soldiers.csv` - Source data for lord names and military values.
- `databasefiles/Final Baronum - Fief Holdings.csv` - Source data for holdings, city names, and province details.
- `databasefiles/Final Baronum - Original Text.csv` - Source data for the original Latin text.
- `databasefiles/limits_IT_municipalities.geojson` - Municipal boundary GeoJSON used to build the Folium map.
- `images/` - Image assets.

## Data Sources

The website uses the following data sources:

- `Final Baronum - Lords and Soldiers.csv`
- `Final Baronum - Fief Holdings.csv`
- `Final Baronum - Original Text.csv`
- `limits_IT_municipalities.geojson`

These CSV files provide the data that powers the findings database.

The GeoJSON file provides the municipal boundaries used by the Folium map.

## Map Data Sources

The Folium map uses:

- `databasefiles/limits_IT_municipalities.geojson` for municipal boundaries.
- `databasefiles/Final Baronum - Lords and Soldiers.csv` and `databasefiles/Final Baronum - Fief Holdings.csv` for the lord-selection data shown in the custom map panel.

The file `databasefiles/Italy_comunes.csv` is currently not part of the map-generation workflow.

## Viewing the Site Locally

1. Download or clone the repository.
2. Keep the folder structure unchanged so the HTML, CSS, CSV, and image files stay in the correct locations.
3. Open the project folder in Visual Studio Code or another editor.
4. Use a local web server to view the site. The easiest option is VS Code Live Server.
5. Open `index.html`, `findings.html`, `sustainability.html`, or `folium_map.html` through the local server.

The findings page should be opened through a local server because it loads CSV files with JavaScript and may not work correctly if opened directly from the file system.

The Folium map page should also be opened through a local server because it uses an iframe plus JavaScript fetch calls to local data files.

## Folium Map Setup (Required)

Use these steps when setting up the project on a new machine or after changes to municipal boundary data.

1. Make sure Python 3 is installed.
2. Install Folium:
	- `pip install folium`
3. From the project root, regenerate the iframe map file:
	- `python generate_folium_inner.py`
4. Confirm `folium_map_inner.html` was updated.
5. Start a local server (for example, VS Code Live Server) and open `folium_map.html` through that server.

### Important Note

- Do not run `generate_folium_map.py` for normal updates. That legacy script writes directly to `folium_map.html` and will overwrite the custom interactive wrapper page.

## Deploying With GitHub Pages

1. Push the repository to GitHub.
2. Open the repository settings on GitHub.
3. Go to the Pages section.
4. Set the source branch to `main` and choose the root folder.
5. Save the settings and wait for GitHub Pages to build the site.
6. Open the live URL shown in the Pages settings.

If the site is already deployed, the live version is available at the URL listed above.

(This page along with the code used to make this website was made with the aid of AI)


