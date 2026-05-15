// @ts-nocheck: TODO: Remove this when this file is properly typed
import { debug } from '../logger.ts';
import type { Route } from '../types.ts';

const pattern = /^\/athlete\/segments\/starred$/;

/**
 * Handler for the starred segments page.
 */
const handler = () => {
	debug('Setting up starred segments page');

	// Constants/config

	const MSG = {
		rowNum: '#',
		recordDiffSeconds: 'PR Diff Time',
		recordDiffPercent: 'PR Diff %',
		gender: 'Compare with Gender',
		itemsPerPage: 'Items per Page',
		genderAny: 'Any',
		genderMen: 'Men',
		genderWomen: 'Women',
		kilometersSuffix: 'km',
		milesSuffix: 'mi',
		feetSuffix: 'ft',
		metersSuffix: 'm',
		percentSuffix: '%',
		secondsSuffix: 's',
		plusPrefix: '+',
		minusPrefix: '-',
		placeholderValue: '—',
	};
	const SORT_INDICATOR = {
		1: ' ▲',
		'-1': ' ▼',
	};
	const ITEMS_PER_PAGE = [20, 50, 100, 200, 500, 1000, 2000];
	const GENDER = {
		any: MSG.genderAny,
		men: MSG.genderMen,
		women: MSG.genderWomen,
	};
	const QUERY_PARAM = {
		itemsPerPage: 'per_page',
		pageNum: 'page',
	};

	const COL_INDEX = {
		rowNum: 0,
		star: 1,
		sport: 2,
		name: 3,
		category: 4,
		distance: 5,
		elevationDiff: 6,
		avgGrade: 7,
		menRecord: 8,
		womenRecord: 9,
		myRecord: 10,
		myGoal: 11,
		recordDiffSeconds: 12,
		recordDiffPercentage: 13,
	};
	const COLS = [
		{
			parseFn: Number.parseInt,
			title: MSG.rowNum,
		},
		{},
		{
			parseFn: parseText,
		},
		{
			parseFn: parseText,
		},
		{},
		{
			parseFn: parseDistance,
		},
		{
			parseFn: parseDistance,
		},
		{
			parseFn: parsePercentage,
		},
		{
			parseFn: parseDuration,
		},
		{
			parseFn: parseDuration,
		},
		{
			parseFn: parseDuration,
		},
		{
			parseFn: parseDuration,
		},
		{
			parseFn: parseDuration,
			title: MSG.recordDiffSeconds,
		},
		{
			parseFn: parsePercentage,
			title: MSG.recordDiffPercent,
		},
	];
	const DEFAULT = {
		itemsPerPage: ITEMS_PER_PAGE[0],
		gender: GENDER.any,
		sortColIndex: COL_INDEX.rowNum,
		sortDirection: 1,
	};

	// Runtime vars

	const sortIndicatorRegex = RegExp(
		` [${Object.values(SORT_INDICATOR).join('')}]$`,
	);
	const state = {
		gender: DEFAULT.gender,
		sort: { colIndex: DEFAULT.sortColIndex, direction: DEFAULT.sortDirection },
	};
	const [table, headerRow, rows] = buildTable();

	updateTable();
	sortTableByCol(0);

	// Functions

	/**
	 * Asserts that a value exists (not null or undefined) and returns it
	 * @param {any} value - The value to check
	 * @param {string} msg - Error message to throw if value doesn't exist
	 * @returns {any} - The original value if it exists
	 * @throws {Error} - If value is null or undefined
	 */
	function assertExists(value, msg) {
		if (value === null || value === undefined) throw new Error(msg);
		return value;
	}

	/**
	 * Formats time difference in seconds to a readable string
	 * @param {number} secondsDiff - Time difference in seconds
	 * @returns {string} - Formatted time string (e.g., "5s" or "1:30")
	 */
	function formatTimeDiff(secondsDiff) {
		const absSecondsDiff = Math.abs(secondsDiff);

		if (absSecondsDiff < 60) return `${absSecondsDiff}${MSG.secondsSuffix}`;

		const minutes = Math.floor(absSecondsDiff / 60);
		const secondsString = String(absSecondsDiff % 60).padStart(2, '0');

		return `${minutes}:${secondsString}`;
	}

	/**
	 * Returns the appropriate sign prefix for a number
	 * @param {number} number - The number to get the sign for
	 * @returns {string} - "+" for positive, "-" for negative, "" for zero
	 */
	function getSignFor(number) {
		return number < 0 ? MSG.minusPrefix : number > 0 ? MSG.plusPrefix : '';
	}

	/**
	 * Gets a query parameter from the current URL
	 *
	 * @param {*} key - The key of the query parameter
	 * @returns {string | null} - The value of the query parameter, or null if not found
	 */
	function getQueryParam(key) {
		return new URLSearchParams(window.location.search).get(key);
	}

	/**
	 * Generates a color based on a value using OKLCH color space
	 * @param {number} value - The value to generate color for
	 * @returns {string} - OKLCH color string
	 */
	function getColorFor(value) {
		const lightness = 0.7;
		const chroma = 0.15;
		const hue = 150 - Math.sign(value) * Math.abs(value) ** (1 / 5) * 30;

		return `oklch(${lightness} ${chroma} ${hue})`;
	}

	/**
	 * Parses a duration string into seconds
	 * @param {string} durationString - Duration string to parse (e.g., "1:30" or "5s")
	 * @returns {number|null} - Duration in seconds or null if placeholder value
	 */
	function parseDuration(durationString) {
		if (durationString === MSG.placeholderValue) return null;

		if (durationString.includes(':')) {
			const [min, sec] = durationString.split(':').map(Number);
			return min * 60 + sec;
		}

		if (durationString.endsWith('s')) {
			return Number.parseInt(durationString, 10);
		}

		return Number.parseFloat(durationString);
	}

	/**
	 * Parses a percentage string into a number
	 * @param {string} percentageString - Percentage string to parse
	 * @returns {number} - Percentage as a number
	 */
	function parsePercentage(percentageString) {
		if (percentageString === MSG.placeholderValue) return null;

		return Number.parseFloat(percentageString);
	}

	/**
	 * Parses a distance string into meters
	 * @param {string} distanceString - Distance string with unit suffix
	 * @returns {number} - Distance in meters
	 */
	function parseDistance(distanceString) {
		const distanceValue = Number.parseFloat(distanceString);

		if (distanceString.endsWith(MSG.kilometersSuffix))
			return distanceValue * 1000;
		if (distanceString.endsWith(MSG.milesSuffix))
			return distanceValue * 1609.344;
		if (distanceString.endsWith(MSG.feetSuffix)) return distanceValue * 0.3048;

		return distanceValue;
	}

	/**
	 * Parses text for sorting (converts to lowercase)
	 * @param {string} textString - Text to parse
	 * @returns {string} - Lowercase text
	 */
	function parseText(textString) {
		return textString.toLowerCase();
	}

	/**
	 * Creates a table column header element
	 * @param {number} colIndex - Index of the column to create
	 * @returns {HTMLTableCellElement} - The created table header cell
	 */
	function createCol(colIndex) {
		const colHeader = document.createElement('th');

		colHeader.textContent = COLS[colIndex].title;
		colHeader.style.cursor = 'pointer';

		return colHeader;
	}

	/**
	 * Creates a dropdown selector with options
	 * @param {string} title - Title of the selector
	 * @param {string[]} optionNames - Array of option names
	 * @param {string} defaultOptionName - Default selected option
	 * @param {function(Event): void} onChange - Event handler for option change
	 * @returns {DocumentFragment} - Fragment containing the selector
	 */
	function createSelector(title, optionNames, defaultOptionName, onChange) {
		const fragment = document.createDocumentFragment();
		const wrapperDiv = document.createElement('div');

		wrapperDiv.className = 'edit-js editable-setting editing inset';
		wrapperDiv.style.background = '#f7f7fa';
		wrapperDiv.style.borderTop = '1px solid #f0f0f5';
		wrapperDiv.style.borderBottom = '1px solid #f0f0f5';
		wrapperDiv.style.marginTop = '20px';
		wrapperDiv.style.marginBottom = '-1px';

		const form = document.createElement('form');

		form.noValidate = true;

		const labelDiv = document.createElement('div');

		labelDiv.className = 'setting-label';
		labelDiv.textContent = title;
		labelDiv.style.color = '#494950';
		labelDiv.style.position = 'relative';

		const valueDiv = document.createElement('div');

		valueDiv.className = 'setting-value';
		valueDiv.style.marginTop = '6px';

		const select = document.createElement('select');

		select.className = 'valid';

		for (const optionName of optionNames) {
			const option = document.createElement('option');

			option.value = optionName;
			option.textContent = optionName;
			option.selected = optionName === defaultOptionName;

			select.appendChild(option);
		}

		select.addEventListener('change', onChange);

		valueDiv.appendChild(select);
		form.appendChild(labelDiv);
		form.appendChild(valueDiv);
		wrapperDiv.appendChild(form);
		fragment.appendChild(wrapperDiv);

		return fragment;
	}

	/**
	 * Adds table options selectors above the table
	 * @param {HTMLTableElement} table - The table to add options to
	 */
	function buildTableOptions(table) {
		const tableParent = assertExists(
			table.parentElement,
			'Table parent not found.',
		);
		const currentItemsPerPage =
			Number(getQueryParam(QUERY_PARAM.itemsPerPage)) ?? DEFAULT.itemsPerPage;

		const itemsPerPageSelector = createSelector(
			MSG.itemsPerPage,
			ITEMS_PER_PAGE,
			currentItemsPerPage,
			({ target }) => {
				const url = new URL(window.location.href);

				url.searchParams.set(QUERY_PARAM.itemsPerPage, target.value);

				window.location.href = url.toString();
			},
		);
		const genderSelector = createSelector(
			MSG.gender,
			Object.values(GENDER),
			DEFAULT.gender,
			({ target }) => {
				state.gender = target.value;

				updateTable();
				sortTableByCol();
			},
		);

		tableParent.insertBefore(itemsPerPageSelector, table);
		tableParent.insertBefore(genderSelector, table);
	}

	/**
	 * Adds and configures table header elements
	 * @param {HTMLTableElement} table - The table to add headers to
	 */
	function buildTableHeaders(headerRow) {
		const rowNumCol = createCol(COL_INDEX.rowNum);
		const recordDiffSecondsCol = createCol(COL_INDEX.recordDiffSeconds);
		const recordDiffPercentageCol = createCol(COL_INDEX.recordDiffPercentage);

		headerRow.insertBefore(rowNumCol, headerRow.firstChild);
		headerRow.appendChild(recordDiffSecondsCol);
		headerRow.appendChild(recordDiffPercentageCol);

		// Enable sorting on all headers
		[...headerRow.children].forEach((th, i) => {
			th.style.cursor = 'pointer';
			th.addEventListener('click', () => sortTableByCol(i, true));
		});
	}

	/**
	 * Adds row numbers and extra columns to the table
	 * @param {HTMLTableElement} table - The table to add columns to
	 */
	function buildTableCols(rows) {
		const pageNum = Number(getQueryParam(QUERY_PARAM.pageNum) ?? 1);
		const startIndex = (pageNum - 1) * DEFAULT.itemsPerPage + 1;

		rows.forEach((row, i) => {
			const indexCell = row.insertCell(0);

			indexCell.textContent = startIndex + i;

			row.insertCell();
			row.insertCell();
		});
	}

	/**
	 * Initializes the table with all custom features
	 * @returns {HTMLTableElement} - The configured Strava segments table
	 */
	function buildTable() {
		const table = assertExists(
			document.querySelector('table.starred-segments'),
			'Table not found.',
		);
		const headerRow = assertExists(
			table.querySelector('thead tr'),
			'Table header row not found.',
		);
		const rows = [...table.querySelectorAll('tbody tr')];

		buildTableOptions(table);
		buildTableHeaders(headerRow);
		buildTableCols(rows);

		return [table, headerRow, rows];
	}

	/**
	 * Calculates record differences and updates table data based on the selected gender
	 */
	function updateTable() {
		const gender = state.gender;

		for (const row of rows) {
			const cells = row.children;
			const [menRecordSeconds, womenRecordSeconds, myRecordSeconds] = [
				'menRecord',
				'womenRecord',
				'myRecord',
			].map((key) => parseDuration(cells[COL_INDEX[key]].textContent.trim()));

			let recordSeconds = menRecordSeconds;

			if (gender === GENDER.women) {
				recordSeconds = womenRecordSeconds;
			} else if (gender === GENDER.any) {
				recordSeconds = Math.min(
					menRecordSeconds ?? Number.POSITIVE_INFINITY,
					womenRecordSeconds ?? Number.POSITIVE_INFINITY,
				);
			}

			const recordDiffSecondsCell = cells[COL_INDEX.recordDiffSeconds];
			const recordDiffPercentageCell = cells[COL_INDEX.recordDiffPercentage];

			if (recordSeconds != null && myRecordSeconds != null) {
				const secondsDiff = myRecordSeconds - recordSeconds;
				const percentDiff = (secondsDiff / recordSeconds) * 100;
				const color = getColorFor(percentDiff);

				recordDiffSecondsCell.textContent = `${getSignFor(secondsDiff)}${formatTimeDiff(secondsDiff)}`;
				recordDiffPercentageCell.textContent = `${getSignFor(percentDiff)}${Math.abs(percentDiff).toFixed(0)}${MSG.percentSuffix}`;
				recordDiffSecondsCell.style.color = color;
				recordDiffPercentageCell.style.color = color;
			} else {
				recordDiffSecondsCell.textContent = MSG.placeholderValue;
				recordDiffPercentageCell.textContent = MSG.placeholderValue;
				recordDiffSecondsCell.style.color = '';
				recordDiffPercentageCell.style.color = '';
			}
		}
	}

	/**
	 * Sorts the table by the specified column
	 * @param {number} [colIndex=state.sort.colIndex] - Index of column to sort by
	 * @param {boolean} [toggleDirection=false] - Whether to toggle sort direction
	 */
	function sortTableByCol(
		colIndex = state.sort.colIndex,
		toggleDirection = false,
	) {
		const { parseFn } = COLS[colIndex];

		if (!parseFn) {
			console.warn(`No parse function defined for column ${colIndex}`);

			return;
		}

		const direction = state.sort.direction * (toggleDirection ? -1 : 1);

		state.sort.colIndex = colIndex;
		state.sort.direction = direction;

		rows.sort((rowA, rowB) => {
			const [valA, valB] = [rowA, rowB].map(
				(row) =>
					parseFn(row.children[colIndex].textContent.trim()) ??
					Number.POSITIVE_INFINITY,
			);

			if (typeof valA === 'number' && typeof valB === 'number') {
				return (valA - valB) * direction;
			}

			return String(valA).localeCompare(String(valB)) * direction;
		});

		[...headerRow.children].forEach((th, i) => {
			th.innerHTML = th.innerHTML.replace(sortIndicatorRegex, '');

			if (i === colIndex) {
				th.innerHTML += SORT_INDICATOR[direction];
			}
		});

		const tbody = table.querySelector('tbody');

		for (const row of rows) {
			tbody.appendChild(row);
		}
	}
};

export const starredSegmentsRoute: Route = {
	pattern,
	handler,
};
