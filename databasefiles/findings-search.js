const FILES = {
    holdings: 'databasefiles/Final Baronum - Fief Holdings.csv',
    lords: 'databasefiles/Final Baronum - Lords and Soldiers.csv',
    original: 'databasefiles/Final Baronum - Original Text.csv'
};

const ui = {
    search: document.getElementById('db-search'),
    onlyMatches: document.getElementById('db-only-matches'),
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
    sourcesHidden: true,
    combinedSort: {
        columnIndex: 0,
        direction: 'asc'
    },
    combinedRows: [],
    sourceLordsRows: [],
    sourceHoldingsRows: [],
    sourceOriginalRows: []
};

const COMBINED_SORTABLE_HEADERS = [
    'Lord_ID',
    'Firstname',
    'Surname',
    'Total Knights',
    'Soldiers',
    'Fiefs'
];

const COMBINED_HEADERS = [...COMBINED_SORTABLE_HEADERS, 'Details'];

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

        const firstName = clean(lord.Firstname) || 'NA';
        const surname = clean(lord.Surname) || 'NA';
        const milites = clean(lord.Milites) || 'NA';
        const servientes = clean(lord.Servientes) || 'NA';
        const feudiOwned = clean(lord.Feudi_Owned) || 'NA';

        const detailRows = relatedHoldings.map((holding) => ({
            constableOrCount: comestabuliaOrComitatus(holding),
            contemporaryCity: clean(holding.Cont_Com_Name) || 'NA',
            modernCity: clean(holding.Mod_Com_Name) || 'NA',
            knightsOwed: clean(holding.Number_Feudi) || 'NA',
            province: clean(holding.Modern_Province) || 'NA'
        }));

        const detailSearch = detailRows.flatMap((detail) => [
            detail.constableOrCount,
            detail.contemporaryCity,
            detail.modernCity,
            detail.knightsOwed,
            detail.province
        ]);

        const rowValues = [
            lordId,
            firstName,
            surname,
            milites,
            servientes,
            feudiOwned
        ];

        const searchValues = [
            lordId,
            firstName,
            surname,
            milites,
            servientes,
            feudiOwned,
            ...detailSearch
        ];

        rows.push({
            values: rowValues,
            sortValues: rowValues,
            detailRows,
            searchText: rowSearchText(searchValues)
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

function parseSortableNumber(value) {
    const cleaned = clean(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned) {
        return null;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function sortCompare(aValue, bValue, direction) {
    const a = clean(aValue);
    const b = clean(bValue);
    const aEmpty = !a || normalize(a) === 'na';
    const bEmpty = !b || normalize(b) === 'na';

    if (aEmpty && bEmpty) {
        return 0;
    }
    if (aEmpty) {
        return 1;
    }
    if (bEmpty) {
        return -1;
    }

    const aNumeric = parseSortableNumber(a);
    const bNumeric = parseSortableNumber(b);

    let result = 0;
    if (aNumeric !== null && bNumeric !== null) {
        result = aNumeric - bNumeric;
    } else {
        result = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }

    return direction === 'asc' ? result : -result;
}

function sortCombinedRowsInPlace() {
    const { columnIndex, direction } = state.combinedSort;
    state.combinedRows.sort((a, b) => {
        const aValues = Array.isArray(a.sortValues) ? a.sortValues : a.values;
        const bValues = Array.isArray(b.sortValues) ? b.sortValues : b.values;
        const primary = sortCompare(aValues[columnIndex], bValues[columnIndex], direction);
        if (primary !== 0) {
            return primary;
        }

        return sortCompare(aValues[0], bValues[0], 'asc');
    });
}

function renderCombinedDetails(row) {
    if (!row.detailRows || !row.detailRows.length) {
        return '<details class="combined-row-details"><summary>Show details</summary><div class="combined-empty-details">No holding details available.</div></details>';
    }

    const detailRowsHtml = row.detailRows.map((detail) => `
        <tr>
            <td>${escapeHtml(detail.constableOrCount)}</td>
            <td>${escapeHtml(detail.contemporaryCity)}</td>
            <td>${escapeHtml(detail.modernCity)}</td>
            <td>${escapeHtml(detail.knightsOwed)}</td>
            <td>${escapeHtml(detail.province)}</td>
        </tr>
    `).join('');

    return `
        <details class="combined-row-details">
            <summary>Show details (${row.detailRows.length})</summary>
            <div class="combined-details-wrap">
                <table class="combined-details-table">
                    <thead>
                        <tr>
                            <th>Constable or Count</th>
                            <th>Contemporary City name</th>
                            <th>Modern City Name</th>
                            <th># of Knights Owed</th>
                            <th>Province</th>
                        </tr>
                    </thead>
                    <tbody>${detailRowsHtml}</tbody>
                </table>
            </div>
        </details>
    `;
}

function renderCombinedTable() {
    ui.combinedHead.innerHTML = `<tr>${COMBINED_HEADERS.map((header, index) => {
        if (index >= COMBINED_SORTABLE_HEADERS.length) {
            return `<th>${escapeHtml(header)}</th>`;
        }

        const isActive = state.combinedSort.columnIndex === index;
        const arrow = isActive
            ? (state.combinedSort.direction === 'asc' ? '[^]' : '[v]')
            : '[^v]';
        return `<th><button type="button" class="sortable-header-btn${isActive ? ' is-active' : ''}" data-sort-col="${index}"><span>${escapeHtml(header)}</span><span class="sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
    }).join('')}</tr>`;

    if (!state.combinedRows.length) {
        ui.combinedBody.innerHTML = `<tr><td class="empty-state" colspan="${COMBINED_HEADERS.length}">No rows to display.</td></tr>`;
        return;
    }

    ui.combinedBody.innerHTML = state.combinedRows.map((row, index) => {
        const cells = row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join('');
        return `<tr data-row="${index}">${cells}<td>${renderCombinedDetails(row)}</td></tr>`;
    }).join('');
}

function onCombinedHeaderSortClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }

    const button = target.closest('button[data-sort-col]');
    if (!button) {
        return;
    }

    const column = Number.parseInt(button.getAttribute('data-sort-col'), 10);
    if (!Number.isFinite(column)) {
        return;
    }

    if (state.combinedSort.columnIndex === column) {
        state.combinedSort.direction = state.combinedSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.combinedSort.columnIndex = column;
        state.combinedSort.direction = 'asc';
    }

    sortCombinedRowsInPlace();
    renderCombinedTable();
    applyFilter();
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
    ui.status.textContent = `${visible} of ${total} database rows visible (${modeText}).`;
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

function toggleSourcesPanel() {
    state.sourcesHidden = !state.sourcesHidden;
    ui.sourcesPanel.classList.toggle('is-hidden', state.sourcesHidden);
    ui.toggleSources.textContent = state.sourcesHidden ? 'Show Source Tables' : 'Hide Source Tables';
}

async function loadAndBuildTables() {
    ui.status.textContent = 'Loading and combining tables...';

    try {
        const cacheBuster = `?t=${Date.now()}`;
        const [lordsResponse, holdingsResponse, originalResponse] = await Promise.all([
            fetch(encodeURI(FILES.lords) + cacheBuster),
            fetch(encodeURI(FILES.holdings) + cacheBuster),
            fetch(encodeURI(FILES.original) + cacheBuster)
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
        sortCombinedRowsInPlace();

        renderCombinedTable();

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
ui.toggleSources.addEventListener('click', toggleSourcesPanel);
ui.combinedHead.addEventListener('click', onCombinedHeaderSortClick);

loadAndBuildTables();
