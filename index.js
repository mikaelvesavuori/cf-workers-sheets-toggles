const DOCUMENT_ID = DOC_ID;
const SHEET_NAME = GOOGLE_SHEET_NAME.replace(/ /g, '%20'); // Replace spaces with URL encoding fix
const URL = `https://docs.google.com/spreadsheets/d/${DOCUMENT_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

/**
 * @description
 * Get cached result for a given Google Sheets document
 * If cache key is empty, do a request and fill cache key with the expected data
 *
 * @async
 * @function
 * @param {Request} request - The incoming request data
 * @returns {Response} - Return cached or fetched (formatted) data to user
 */
async function getSheetsToggles(request) {
  if (request.method !== 'GET')
    return new Response('Unallowed HTTP method! Use GET method instead.', {
      'Content-Type': 'text/plain',
      status: 405
    });

  // START timer
  let timeStart = Date.now();

  // Get data
  console.log(`Attempting to get cached data for document ${DOCUMENT_ID}`);
  let responseData = await TOGGLES_CACHE.get(DOCUMENT_ID);
  if (!responseData) responseData = await getData(URL, DOCUMENT_ID);

  // END timer
  let timeEnd = Date.now();
  console.log('Call took', timeEnd - timeStart, 'ms');

  // Return data
  if (typeof responseData !== "string") responseData = JSON.stringify(responseData)
  return new Response(responseData, {
    'Content-Type': 'application/json',
    status: 200
  });
}

/**
 * @description Get fresh data from Google
 *
 * @async
 * @function
 * @param {*} url - Complete URL to sheet
 * @param {*} documentId - The ID part of the URL
 */
async function getData(url, documentId) {
  console.log(`No cached data found, so doing a fresh pull`);

  let responseData = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    method: 'GET'
  })
    .then((res) => res.text())
    .then((res) => res.replace('/*O_o*/\ngoogle.visualization.Query.setResponse(', ''))
    .then((res) => res.slice(0, res.length - 2))
    .then((res) => JSON.parse(res))
    .then((res) => res.table)

  responseData = formatData(responseData);
  await cacheData(documentId, responseData);
  return responseData;
}

/**
 * @description Cache data in KV
 *
 * @async
 * @function
 * @param {string} key - KV key
 * @param {string} data - Data (HTML) to store
 * @param {number} ttlSeconds - Time-to-live value in seconds, defaults to 60 seconds
 */
async function cacheData(key, data, ttlSeconds = 60) {
  const TTL = ttlSeconds;
  await TOGGLES_CACHE.put(key, JSON.stringify(data), { expirationTtl: TTL });
  console.log(`Finished putting new data in cache at key ${key}`);
}

/**
 * @description Format data to be easily consumed
 *
 * @function
 * @param {*} data Google Sheets data
 */
function formatData(data) {
  // Check if we got correctly parsed headers, else use first row for headers
  const HAS_PARSED_HEADERS = data.parsedNumHeaders > 0;
  const labels = (() =>
    HAS_PARSED_HEADERS
      ? data.cols.map((col) => col.label)
      : data.rows[0].c.map((row) => Object.values(row)))();

  const rows = data.rows;
  if (!HAS_PARSED_HEADERS) rows.shift();

  return rows.map((col, index) => {
    const row = rows[index].c;
    const obj = {};

    labels.forEach(
      (label, index) => (obj[labels[index]] = row[index] ? Object.values(row[index])[0] : null)
    );

    return obj;
  });
}

addEventListener('fetch', (event) => {
  event.respondWith(getSheetsToggles(event.request));
});
