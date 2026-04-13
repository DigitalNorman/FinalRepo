# Digitalizing the Catalogus Baronum

A database that include the first 99 entries in the Catalogus Baronum, an important fuedal registry from the 12th century Kingdom of Sicily.

## Live Site

https://digitalnorman.github.io/Digitalizing-the-Catalogus-Baronum/index.html

## Repository Files

- `index.html` - The home page with the main site navigation and introductory content.
- `findings.html` - The database page that loads the CSV data and displays the searchable combined table.
- `planning.html` - The planning page with the design notes and planning images.
- `sustainability.html` - The sustainability page with citations and ways to maintain and operate the website.
- `medieval.css` - The shared stylesheet for the full site.
- `databasefiles/findings-search.js` - The JavaScript file that reads the CSV files, combines the data, and controls the findings database.
- `databasefiles/Final Baronum - Lords and Soldiers.csv` - Source data for lord names and military values.
- `databasefiles/Final Baronum - Fief Holdings.csv` - Source data for holdings, city names, and province details.
- `databasefiles/Final Baronum - Original Text.csv` - Source data for the original Latin text.
- `databasefiles/Italy_comunes.csv` - Supporting geographic data file (Not yet in use).
- `databasefiles/limits_IT_municipalities.geojson` - Supporting geographic boundary file (not yet in use).
- `images/` - Planning page image assets.

## Data Sources

The website uses the following data sources:

- `Final Baronum - Lords and Soldiers.csv`
- `Final Baronum - Fief Holdings.csv`
- `Final Baronum - Original Text.csv`

These CSV files provide the data that powers the findings database.

## Viewing the Site Locally

1. Download or clone the repository.
2. Keep the folder structure unchanged so the HTML, CSS, CSV, and image files stay in the correct locations.
3. Open the project folder in Visual Studio Code or another editor.
4. Use a local web server to view the site. The easiest option is VS Code Live Server.
5. Open `index.html` or `findings.html` through the local server.

The findings page should be opened through a local server because it loads CSV files with JavaScript and may not work correctly if opened directly from the file system.

## Deploying With GitHub Pages

1. Push the repository to GitHub.
2. Open the repository settings on GitHub.
3. Go to the Pages section.
4. Set the source branch to `main` and choose the root folder.
5. Save the settings and wait for GitHub Pages to build the site.
6. Open the live URL shown in the Pages settings.

If the site is already deployed, the live version is available at the URL listed above.

(This page was made with the aid of AI)


