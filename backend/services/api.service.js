const axios = require('axios');

class ApiService {
    /**
     * Fetches data from a REST API.
     * @param {object} config - { baseUrl, headers, authResultPath }
     * @param {string} endpointPath - The specific path/query to fetch.
     * @returns {Promise<any[]>}
     */
    async fetchData(config, endpointPath) {
        try {
            // 1. Authenticate (Once)
            const globalHeaders = { ...(config.headers || {}) };

            // Support Basic Auth (Axios handles this via config, but we might need it for manual headers if using nextUrl)
            // For simplicity, we trust axiosConfig for the first call, but for nextUrl we might need to carry over auth.

            if (config.authRequest) {
                await this._performAuth(config, globalHeaders);
            }

            // 2. Pagination Loop
            let allData = [];
            let page = 1;
            let offset = 0;
            let nextUrl = null;
            let hasMore = true;
            const MAX_PAGES = 50; // Safety break

            // Strategy Determination
            const strategy = config.pagination ? config.pagination.type : 'NONE'; // 'PAGE_PARAM', 'OFFSET', 'NEXT_URL'
            const pageKey = config.pagination?.key || 'page';
            const limit = config.pagination?.limit || 100;

            console.log(`[API START] Fetching ${endpointPath} with strategy: ${strategy}`);

            while (hasMore && page <= MAX_PAGES) {
                // Construct URL
                let requestUrl;
                if (strategy === 'NEXT_URL' && nextUrl) {
                    requestUrl = nextUrl;
                } else {
                    const baseUrl = config.baseUrl;
                    // Ensure endpoint appends to path (strip leading slash)
                    const safeEndpoint = (baseUrl && endpointPath.startsWith('/')) ? endpointPath.slice(1) : endpointPath;
                    requestUrl = baseUrl ? new URL(safeEndpoint, baseUrl).toString() : endpointPath;
                    const urlObj = new URL(requestUrl);

                    if (strategy === 'PAGE_PARAM') {
                        urlObj.searchParams.set(pageKey, page);
                    } else if (strategy === 'OFFSET') {
                        urlObj.searchParams.set('offset', offset);
                        urlObj.searchParams.set('limit', limit);
                    }
                    requestUrl = urlObj.toString();
                }
                console.log('API URL: ' + requestUrl + ' , ' + endpointPath);
                // Execute Request
                const response = await this._executeRequest(requestUrl, config, globalHeaders);
                const rawData = response.data;

                // Extract Data Array
                let pageData = rawData;
                if (config.dataPropertyPath && config.dataPropertyPath.trim() !== '') {
                    pageData = this._resolvePath(rawData, config.dataPropertyPath);
                }

                // Append
                if (Array.isArray(pageData) && pageData.length > 0) {
                    allData = allData.concat(pageData);
                    console.log(`[API PAGE ${page}] Fetched ${pageData.length} rows.`);

                    // Prepare Next Iteration
                    page++;
                    offset += pageData.length;

                    // Strategy Updates
                    if (strategy === 'NONE') {
                        hasMore = false; // Only one request if no pagination
                    } else if (strategy === 'NEXT_URL') {
                        // Resolve next link from response
                        // Config should ideally specify where next link is: pagination.nextPath
                        const nextPath = config.pagination?.nextPath || 'next';
                        const resolvedNext = this._resolvePath(rawData, nextPath);
                        if (resolvedNext) {
                            nextUrl = resolvedNext;
                        } else {
                            hasMore = false;
                        }
                    } else {
                        // For Page/Offset, stop if fewer items than limit or empty
                        // Heuristic: If we got 0 items, stop.
                        // If we assume a fixed page size, we could check if count < limit.
                        if (pageData.length === 0) hasMore = false;
                    }

                } else {
                    console.log(`[API PAGE ${page}] Empty or invalid data results. Stopping.`);
                    hasMore = false;
                }
            }

            return allData;

        } catch (error) {
            console.error(`API Fetch Error [${endpointPath}]:`, error.message);
            throw error;
        }
    }

    async _performAuth(config, targetHeaders) {
        try {
            // Allow relative URL for authRequest
            const authUrl = config.baseUrl && !config.authRequest.url.startsWith('http')
                ? new URL(config.authRequest.url, config.baseUrl).toString()
                : config.authRequest.url;

            console.log('Performing Auth Request to:', authUrl);
            const authRes = await axios({
                method: config.authRequest.method || 'POST',
                url: authUrl,
                data: config.authRequest.body || {},
                headers: config.authRequest.headers || {}
            });

            // Extract Token
            const token = this._resolvePath(authRes.data, config.authRequest.tokenPath || 'token');
            if (token) {
                targetHeaders['Authorization'] = `Bearer ${token}`;
            } else {
                console.warn('Auth Request succeeded but token not found at path:', config.authRequest.tokenPath);
            }
        } catch (authErr) {
            console.error('Auth Request Failed:', authErr.message);
            throw new Error('Authentication Failed: ' + authErr.message);
        }
    }

    async _executeRequest(url, config, headers) {
        const axiosConfig = {
            method: 'GET',
            url: url,
            headers: headers,
        };
        // Basic Auth
        if (config.auth) {
            axiosConfig.auth = config.auth;
        }
        return axios(axiosConfig);
    }

    _resolvePath(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}

module.exports = new ApiService();
