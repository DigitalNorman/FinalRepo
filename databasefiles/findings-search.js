const FILES = {
    holdings: 'databasefiles/Final Baronum - Fief Holdings.csv',
    lords: 'databasefiles/Final Baronum - Lords and Soldiers.csv',
    original: 'databasefiles/Final Baronum - Original Text.csv'
};

const ui = {
    search: document.getElementById('db-search'),
    onlyMatches: document.getElementById('db-only-matches'),
    toggleCombined: document.getElementById('db-toggle-combined'),
    toggleSources: document.getElementById('db-toggle-sources'),
    status: document.getElementById('db-status'),
    combinedPanel: document.getElementById('db-combined-panel'),
    sourcesPanel: document.getElementById('db-sources-panel'),
    combinedHead: document.getElementById('db-combined-head'),
    combinedBody: document.getElementById('db-combined-body'),
    lordsHead: document.getElementById('db-lords-head'),
    lordsBody: document.getElementById('db-lords-body'),
    holdingsHead: document.getElementById('db-holdings-head'),
    holdingsBody: document.getElementById('db-holdings-body'),
    originalHead: document.getElementById('db-original-head'),
    originalBody: document.getElementById('db-original-body')
};

const state = {
    query: '',
    onlyMatches: true,
    combinedHidden: false,
    sourcesHidden: true,
    combinedRows: [],
    sourceLordsRows: [],
    sourceHoldingsRows: [],
    sourceOriginalRows: []
};

function clean(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').trim();
}

function normalize(value) {
    return clean(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function escapeHtml(value) {
    return clean(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
        const char = csvText[i];
        const next = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') {
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

        cell += char;
    }

    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }

    if (!rows.length) {
        return [];
    }

    const headers = rows[0].map((header) => clean(header));
    return rows.slice(1)
        .filter((values) => values.some((value) => clean(value).length > 0))
        .map((values) => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = clean(values[index]);
            });
            return record;
        });
}

function numericLordId(value) {
    const parsed = Number.parseInt(clean(value), 10);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function comestabuliaOrComitatus(holding) {
    const comestabulia = clean(holding.Comestabulia);
    if (comestabulia && normalize(comestabulia) !== 'na') {
        return comestabulia;
    }

    const comitatus = clean(holding.Comitatus);
    if (comitatus && normalize(comitatus) !== 'na') {
        return comitatus;
    }

    return 'NA';
}

function modCommuneWithFeudi(holding) {
    const commune = clean(holding.Mod_Com_Name);
    const numberFeudi = clean(holding.Number_Feudi);

    if (commune && numberFeudi) {
        return `${commune} (${numberFeudi})`;
    }

    return commune || numberFeudi || 'NA';
}

function rowSearchText(values) {
    return values.map(normalize).join(' ');
}

function sourceRowsFromRecords(records, headers) {
    return records.map((record) => {
        const values = headers.map((header) => clean(record[header]));
        return {
            values,
            searchText: rowSearchText(values)
        };
    });
}

function combinedRows(lords, holdings) {
    const lordMap = new Map();

    lords.forEach((lord) => {
        const lordId = clean(lord.Lord_ID);
        if (!lordId) {
            return;
        }

        if (!lordMap.has(lordId)) {
            lordMap.set(lordId, lord);
        }
    });

    const holdingsByLord = new Map();
    holdings.forEach((holding) => {
        const lordId = clean(holding.Lord_ID);
        if (!lordId) {
            return;
        }

        if (!holdingsByLord.has(lordId)) {
            holdingsByLord.set(lordId, []);
        }
        holdingsByLord.get(lordId).push(holding);
    });

    const allLordIds = Array.from(new Set([
        ...lordMap.keys(),
        ...holdingsByLord.keys()
    ])).sort((a, b) => {
        const diff = numericLordId(a) - numericLordId(b);
        if (diff !== 0) {
            return diff;
        }
        return a.localeCompare(b);
    });

    const rows = [];

    allLordIds.forEach((lordId) => {
        const lord = lordMap.get(lordId) || {};
        const relatedHoldings = (holdingsByLord.get(lordId) || []).slice();

        if (!relatedHoldings.length) {
            relatedHoldings.push({});
        }

        relatedHoldings.forEach((holding, index) => {
            const firstRow = index === 0;

            const firstName = clean(lord.Firstname) || 'NA';
            const surname = clean(lord.Surname) || 'NA';
            const milites = clean(lord.Milites) || 'NA';
            const servientes = clean(lord.Servientes) || 'NA';
            const feudiOwned = clean(lord.Feudi_Owned) || 'NA';
            const comestabuliaValue = comestabuliaOrComitatus(holding);
            const modCommuneValue = modCommuneWithFeudi(holding);
            const province = clean(holding.Modern_Province) || 'NA';

            const rowValues = [
                firstRow ? lordId : '',
                firstRow ? firstName : '',
                firstRow ? surname : '',
                firstRow ? milites : '',
                firstRow ? servientes : '',
                firstRow ? feudiOwned : '',
                comestabuliaValue,
                modCommuneValue,
                province
            ];

            const searchValues = [
                lordId,
                firstName,
                surname,
                milites,
                servientes,
                feudiOwned,
                comestabuliaValue,
                modCommuneValue,
                province
            ];

            rows.push({
                values: rowValues,
                searchText: rowSearchText(searchValues),
                isContinuation: !firstRow
            });
        });
    });

    return rows;
}

function renderTable(headElement, bodyElement, headers, rows, rowClassResolver) {
    headElement.innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;

    if (!rows.length) {
        bodyElement.innerHTML = `<tr><td class="empty-state" colspan="${headers.length}">No rows to display.</td></tr>`;
        return;
    }

    bodyElement.innerHTML = rows.map((row, index) => {
        const className = rowClassResolver ? rowClassResolver(row, index) : '';
        const classAttribute = className ? ` class="${className}"` : '';
        const cells = row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join('');
        return `<tr data-row="${index}"${classAttribute}>${cells}</tr>`;
    }).join('');
}

function filterTableRows(bodyElement, rows) {
    const rowElements = Array.from(bodyElement.querySelectorAll('tr[data-row]'));
    let visibleCount = 0;

    rowElements.forEach((rowElement) => {
        const index = Number(rowElement.getAttribute('data-row'));
        const row = rows[index];
        const isMatch = !state.query || row.searchText.includes(state.query);

        if (state.onlyMatches) {
            rowElement.classList.toggle('is-filtered-out', !isMatch);
        } else {
            rowElement.classList.remove('is-filtered-out');
        }

        if (state.onlyMatches) {
            if (isMatch) {
                visibleCount += 1;
            }
        } else {
            visibleCount += 1;
        }
    });

    return visibleCount;
}

function updateStatus(visible, total) {
    const modeText = state.onlyMatches ? 'showing only matching rows' : 'showing all rows';
    ui.status.textContent = `${visible} of ${total} combined rows visible (${modeText}).`;
}

function applyFilter() {
    state.query = normalize(ui.search.value);
    state.onlyMatches = ui.onlyMatches.checked;

    const visibleCombined = filterTableRows(ui.combinedBody, state.combinedRows);
    filterTableRows(ui.lordsBody, state.sourceLordsRows);
    filterTableRows(ui.holdingsBody, state.sourceHoldingsRows);
    filterTableRows(ui.originalBody, state.sourceOriginalRows);
    updateStatus(visibleCombined, state.combinedRows.length);
}

function toggleCombinedPanel() {
    state.combinedHidden = !state.combinedHidden;
    ui.combinedPanel.classList.toggle('is-hidden', state.combinedHidden);
    ui.toggleCombined.textContent = state.combinedHidden ? 'Show Combined Table' : 'Hide Combined Table';
}

function toggleSourcesPanel() {
    state.sourcesHidden = !state.sourcesHidden;
    ui.sourcesPanel.classList.toggle('is-hidden', state.sourcesHidden);
    ui.toggleSources.textContent = state.sourcesHidden ? 'Show Source Tables' : 'Hide Source Tables';
}

async function loadAndBuildTables() {
    ui.status.textContent = 'Loading and combining tables...';

    try {
        const [lordsResponse, holdingsResponse, originalResponse] = await Promise.all([
            fetch(encodeURI(FILES.lords)),
            fetch(encodeURI(FILES.holdings)),
            fetch(encodeURI(FILES.original))
        ]);

        if (!lordsResponse.ok || !holdingsResponse.ok || !originalResponse.ok) {
            throw new Error('Could not load one or more source CSV files.');
        }

        const [lordsText, holdingsText, originalText] = await Promise.all([
            lordsResponse.text(),
            holdingsResponse.text(),
            originalResponse.text()
        ]);

        const lordsRecords = parseCSV(lordsText);
        const holdingsRecords = parseCSV(holdingsText);
        const originalRecords = parseCSV(originalText);

        state.sourceLordsRows = sourceRowsFromRecords(lordsRecords, [
            'Book_ID', 'Lord_ID', 'Firstname', 'Surname', 'Milites', 'Servientes', 'Feudi_Owned', 'Notes'
        ]);
        state.sourceHoldingsRows = sourceRowsFromRecords(holdingsRecords, [
            'Book_ID', 'Lord_ID', 'Cont_Com_Name', 'Mod_Com_Name', 'Modern_Province', 'Number_Feudi', 'Comitatus', 'Comestabulia', 'Notes'
        ]);
        state.sourceOriginalRows = sourceRowsFromRecords(originalRecords, [
            'Book_ID', 'Original_Text'
        ]);
        state.combinedRows = combinedRows(lordsRecords, holdingsRecords);

        renderTable(
            ui.combinedHead,
            ui.combinedBody,
            [
                'Lord_ID',
                'Firstname',
                'Surname',
                'Total Knights',
                'Soldiers',
                'Fiefs',
                'Constable or Count',
                'City and # of Knights Owed',
                'Province'
            ],
            state.combinedRows,
            (row) => (row.isContinuation ? 'lord-continued' : '')
        );

        renderTable(
            ui.lordsHead,
            ui.lordsBody,
            ['Book_ID', 'Lord_ID', 'Firstname', 'Surname', 'Milites', 'Servientes', 'Feudi_Owned', 'Notes'],
            state.sourceLordsRows
        );

        renderTable(
            ui.holdingsHead,
            ui.holdingsBody,
            ['Book_ID', 'Lord_ID', 'Cont_Com_Name', 'Mod_Com_Name', 'Modern_Province', 'Number_Feudi', 'Comitatus', 'Comestabulia', 'Notes'],
            state.sourceHoldingsRows
        );

        renderTable(
            ui.originalHead,
            ui.originalBody,
            ['Book_ID', 'Original_Text'],
            state.sourceOriginalRows
        );

        applyFilter();
    } catch (error) {
        console.error(error);
        ui.status.textContent = 'Could not load the database files. If needed, open this site with Live Server.';
    }
}

ui.search.addEventListener('input', applyFilter);
ui.onlyMatches.addEventListener('change', applyFilter);
ui.toggleCombined.addEventListener('click', toggleCombinedPanel);
ui.toggleSources.addEventListener('click', toggleSourcesPanel);

loadAndBuildTables();
