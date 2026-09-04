'use strict';

const BASE_URL = 'https://claude.ai';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code; // 'AUTH_EXPIRED' | 'NETWORK' | 'PARSE' | 'HTTP'
  }
}

function buildHeaders(cookieHeader) {
  return {
    Cookie: cookieHeader,
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
}

async function requestJson(url, cookieHeader) {
  let res;
  try {
    res = await fetch(url, { headers: buildHeaders(cookieHeader) });
  } catch (err) {
    throw new ApiError(`Network error calling ${url}: ${err.message}`, 'NETWORK');
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(`Authentication expired (HTTP ${res.status}) for ${url}`, 'AUTH_EXPIRED');
  }

  if (!res.ok) {
    throw new ApiError(`Unexpected HTTP ${res.status} calling ${url}`, 'HTTP');
  }

  try {
    return await res.json();
  } catch (err) {
    throw new ApiError(`Failed to parse JSON from ${url}: ${err.message}`, 'PARSE');
  }
}

/**
 * Fetches the list of organizations for the current session and returns
 * the uuid of the first one. Throws ApiError('AUTH_EXPIRED') on 401/403.
 */
async function fetchOrganizations(cookieHeader) {
  const data = await requestJson(`${BASE_URL}/api/organizations`, cookieHeader);

  if (!Array.isArray(data)) {
    throw new ApiError('Unexpected response shape for /api/organizations (expected an array).', 'PARSE');
  }

  const orgs = data
    .map((org) => ({
      uuid: org?.uuid ?? null,
      name: org?.name ?? org?.uuid ?? 'Unknown organization',
    }))
    .filter((org) => typeof org.uuid === 'string' && org.uuid.length > 0);

  if (orgs.length === 0) {
    throw new ApiError('No organizations found for this account.', 'PARSE');
  }

  return orgs;
}

/**
 * Fetches usage utilization for the given organization. The response
 * schema is undocumented and may change, so every field is read
 * defensively with optional chaining and sane fallbacks (null).
 */
async function fetchUsage(cookieHeader, orgUuid) {
  const data = await requestJson(`${BASE_URL}/api/organizations/${orgUuid}/usage`, cookieHeader);

  const fiveHour = {
    utilization: data?.five_hour?.utilization ?? null,
    resetsAt: data?.five_hour?.resets_at ?? null,
  };

  const sevenDay = {
    utilization: data?.seven_day?.utilization ?? null,
    resetsAt: data?.seven_day?.resets_at ?? null,
  };

  return { fiveHour, sevenDay, raw: data };
}

module.exports = { fetchOrganizations, fetchUsage, ApiError };
