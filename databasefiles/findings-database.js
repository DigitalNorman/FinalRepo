const DATA_FILES = {
    holdings: 'databasefiles/Final Baronum - Fief Holdings.csv',
    lords: 'databasefiles/Final Baronum - Lords and Soldiers.csv',
    geojson: 'databasefiles/limits_IT_municipalities.geojson'
};

const COLORS = ['#eadfcd', '#d7bb9d', '#c69080', '#a95d5f', '#8b7355', '#6b1a27'];

const state = {
    holdings: [],
    lords: [],
    features: [],
    query: ''
};

const elements = {
    search: document.getElementById('database-search'),
    stats: document.getElementById('database-stats'),
    mapStatus: document.getElementById('map-status'),
    map: document.getElementById('choropleth-map'),
    legend: document.getElementById('map-legend'),
    holdingsBody: document.querySelector('#fief-table tbody'),
    lordsBody: document.querySelector('#lord-table tbody')
};

function clean(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').trim();
}

function normalize(value) {
    return clean(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '')
        .toLowerCase();
}

function parseNumber(value) {
    const text = clean(value).replace(',', '.');
    const number = Number.parseFloat(text);
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const nextCharacter = text[index + 1];

        if (character === '"') {
            if (inQuotes && nextCharacter === '"') {
                cell += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (character === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
            continue;
        }

        if ((character === '\n' || character === '\r') && !inQuotes) {
            if (character === '\r' && nextCharacter === '\n') {
                continue;
            }

            if (cell.length || row.length) {
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
            }
            continue;
        }

        cell += character;
    }

    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }

    const headers = rows.shift() ?? [];
    return rows
        .filter((currentRow) => currentRow.some((value) => clean(value).length > 0))
        .map((currentRow) => {
            const record = {};
            headers.forEach((header, index) => {
                record[clean(header)] = clean(currentRow[index] ?? '');
            });
            return record;
        });
}

function escapeHtml(value) {
    return clean(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function matchesQuery(record, query) {
    if (!query) {
        return true;
    }

    return record.searchText.includes(query);
}

function buildHoldings(rows) {
    return rows.map((row) => {
        const modernCommune = clean(row.Mod_Com_Name);
        const oldCommune = clean(row.Cont_Com_Name);
        const province = clean(row.Modern_Province);
        const constable = clean(row.Comestabulia) || clean(row.Comitatus) || '—';
        const notes = clean(row.Notes) || '—';
        const feudi = parseNumber(row.Number_Feudi);

        return {
            type: 'Fief Holding',
            key: normalize(modernCommune),
            bookId: clean(row.Book_ID),
            lordId: clean(row.Lord_ID),
            modernCommune,
            oldCommune,
            province,
            feudi,
            constable,
            notes,
            searchText: [
                row.Book_ID,
                row.Lord_ID,
                modernCommune,
                oldCommune,
                province,
                row.Number_Feudi,
                constable,
                notes
            ].map(normalize).join(' ')
        };
    });
}

function buildLords(rows) {
    return rows.map((row) => {
        const name = [clean(row.Firstname), clean(row.Surname)]
            .filter((part) => part && part !== 'NA')
            .join(' ')
            .trim() || 'Unknown lord';

        const notes = clean(row.Notes) || '—';

        return {
            type: 'Lord and Soldiers',
            bookId: clean(row.Book_ID),
            lordId: clean(row.Lord_ID),
            name,
            milites: parseNumber(row.Milites),
            servientes: parseNumber(row.Servientes),
            feudiOwned: parseNumber(row.Feudi_Owned),
            notes,
            searchText: [
                row.Book_ID,
                row.Lord_ID,
                name,
                row.Milites,
                row.Servientes,
                row.Feudi_Owned,
                notes
            ].map(normalize).join(' ')
        };
    });
}

function aggregateHoldings(records) {
    const map = new Map();

    records.forEach((record) => {
        const current = map.get(record.key) ?? {
            name: record.modernCommune,
            province: record.province,
            totalFeudi: 0,
            count: 0,
            records: []
        };

        current.totalFeudi += record.feudi;
        current.count += 1;
        current.records.push(record);
        map.set(record.key, current);
    });

    return map;
}

function geometryToPath(geometry, project) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

    return polygons.map((polygon) => {
        return polygon.map((ring) => {
            return ring.map((point, pointIndex) => {
                const [x, y] = project(point);
                const command = pointIndex === 0 ? 'M' : 'L';
                return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
            }).join(' ') + ' Z';
        }).join(' ');
    }).join(' ');
}

function collectCoordinates(geometry, list = []) {
    if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach((ring) => {
            ring.forEach((point) => list.push(point));
        });
        return list;
    }

    if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygon) => {
            polygon.forEach((ring) => {
                ring.forEach((point) => list.push(point));
            });
        });
        return list;
    }

    return list;
}

function fitProjection(features, width = 1000, height = 620, padding = 28) {
    const coordinates = [];
    features.forEach((feature) => collectCoordinates(feature.geometry, coordinates));

    if (!coordinates.length) {
        return () => [0, 0];
    }

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    coordinates.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
    });

    const scaleX = (width - padding * 2) / Math.max(maxLng - minLng, 0.0001);
    const scaleY = (height - padding * 2) / Math.max(maxLat - minLat, 0.0001);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - (maxLng - minLng) * scale) / 2;
    const offsetY = (height - (maxLat - minLat) * scale) / 2;

    return ([lng, lat]) => {
        const x = (lng - minLng) * scale + offsetX;
        const y = height - ((lat - minLat) * scale + offsetY);
        return [x, y];
    };
}

function colorForValue(value, maxValue) {
    if (!value || !maxValue) {
        return COLORS[0];
    }

    const ratio = value / maxValue;
    if (ratio < 0.15) return COLORS[1];
    if (ratio < 0.3) return COLORS[2];
    if (ratio < 0.55) return COLORS[3];
    if (ratio < 0.8) return COLORS[4];
    return COLORS[5];
}

function renderLegend() {
    const legendEntries = [
        { label: 'No matching data', color: COLORS[0] },
        { label: 'Low holdings', color: COLORS[1] },
        { label: 'Moderate holdings', color: COLORS[3] },
        { label: 'High holdings', color: COLORS[4] },
        { label: 'Highest holdings', color: COLORS[5] }
    ];

    elements.legend.innerHTML = legendEntries.map((entry) => {
        return `<div class="legend-item"><span class="legend-swatch" style="background:${entry.color}"></span><span>${escapeHtml(entry.label)}</span></div>`;
    }).join('');
}

function renderStats(holdingRecords, lordRecords) {
    const totalFeudi = holdingRecords.reduce((sum, record) => sum + record.feudi, 0);
    const totalMilites = lordRecords.reduce((sum, record) => sum + record.milites, 0);
    const uniqueMunicipalities = new Set(holdingRecords.map((record) => record.key)).size;

    const cards = [
        { label: 'Fief records', value: holdingRecords.length },
        { label: 'Lord records', value: lordRecords.length },
        { label: 'Municipalities matched', value: uniqueMunicipalities },
        { label: 'Total fiefs', value: formatNumber(totalFeudi) },
        { label: 'Total milites', value: formatNumber(totalMilites) }
    ];

    elements.stats.innerHTML = cards.map((card) => {
        return `<div class="stat-card"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>`;
    }).join('');
}

function renderTableRows(body, rows, columns) {
    if (!rows.length) {
        body.innerHTML = `<tr><td class="empty-state" colspan="${columns.length}">No matching records found.</td></tr>`;
        return;
    }

    body.innerHTML = rows.map((row) => {
        const cells = columns.map((column) => `<td>${escapeHtml(column(row))}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
}

function renderMap(filteredHoldings, geojsonFeatures) {
    const groupedHoldings = aggregateHoldings(filteredHoldings);
    const features = geojsonFeatures.filter((feature) => groupedHoldings.has(normalize(feature.properties?.name)));

    if (!features.length) {
        elements.map.innerHTML = '';
        elements.mapStatus.textContent = 'No municipality geometries match the current search.';
        return;
    }

    const projection = fitProjection(features);
    const maxValue = Math.max(...features.map((feature) => {
        const key = normalize(feature.properties?.name);
        return groupedHoldings.get(key)?.totalFeudi ?? 0;
    }));

    const paths = features.map((feature) => {
        const key = normalize(feature.properties?.name);
        const aggregate = groupedHoldings.get(key);
        const value = aggregate?.totalFeudi ?? 0;
        const color = colorForValue(value, maxValue);
        const title = `${feature.properties?.name ?? 'Unknown'}: ${formatNumber(value)} feudi`;
        const pathData = geometryToPath(feature.geometry, projection);

        return `
            <path class="map-region ${value > 0 ? 'is-active' : 'no-data'}" fill="${color}" d="${pathData}" fill-rule="evenodd">
                <title>${escapeHtml(title)}</title>
            </path>
        `;
    }).join('');

    elements.map.setAttribute('viewBox', '0 0 1000 620');
    elements.map.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    elements.map.innerHTML = `
        <rect width="1000" height="620" fill="#f8f1e3"></rect>
        ${paths}
    `;

    elements.mapStatus.textContent = `${features.length} municipalities matched the current filter.`;
}

function applyFilter() {
    const query = normalize(elements.search.value);
    state.query = query;

    const filteredHoldings = state.holdings.filter((record) => matchesQuery(record, query));
    const filteredLords = state.lords.filter((record) => matchesQuery(record, query));

    renderStats(filteredHoldings, filteredLords);
    renderTableRows(elements.holdingsBody, filteredHoldings, [
        (row) => row.bookId,
        (row) => row.modernCommune,
        (row) => row.oldCommune,
        (row) => row.province,
        (row) => formatNumber(row.feudi),
        (row) => row.constable,
        (row) => row.notes
    ]);

    renderTableRows(elements.lordsBody, filteredLords, [
        (row) => row.bookId,
        (row) => row.name,
        (row) => formatNumber(row.milites),
        (row) => formatNumber(row.servientes),
        (row) => formatNumber(row.feudiOwned),
        (row) => row.notes
    ]);

    renderMap(filteredHoldings, state.features);
}

async function loadData() {
    try {
        const [holdingsText, lordsText, geojson] = await Promise.all([
            fetch(encodeURI(DATA_FILES.holdings)).then((response) => {
                if (!response.ok) {
                    throw new Error('Could not load the fief holdings CSV.');
                }
                return response.text();
            }),
            fetch(encodeURI(DATA_FILES.lords)).then((response) => {
                if (!response.ok) {
                    throw new Error('Could not load the lords and soldiers CSV.');
                }
                return response.text();
            }),
            fetch(encodeURI(DATA_FILES.geojson)).then((response) => {
                if (!response.ok) {
                    throw new Error('Could not load the GeoJSON file.');
                }
                return response.json();
            })
        ]);

        state.holdings = buildHoldings(parseCSV(holdingsText));
        state.lords = buildLords(parseCSV(lordsText));
        state.features = geojson.features ?? [];

        renderLegend();
        applyFilter();
    } catch (error) {
        console.error(error);
        elements.mapStatus.textContent = 'The database files could not be loaded. Open the project through a local server such as Live Server so the CSV and GeoJSON files can be fetched.';
        elements.stats.innerHTML = '<div class="stat-card"><span>Status</span><strong>Load failed</strong></div>';
        elements.holdingsBody.innerHTML = '<tr><td class="empty-state" colspan="7">Database unavailable until the source files can be loaded.</td></tr>';
        elements.lordsBody.innerHTML = '<tr><td class="empty-state" colspan="6">Database unavailable until the source files can be loaded.</td></tr>';
        elements.map.innerHTML = '';
        elements.legend.innerHTML = '';
    }
}

elements.search.addEventListener('input', applyFilter);
loadData();
