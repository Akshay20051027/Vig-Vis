/**
 * Backend API index (single source of truth)
 *
 * This file is intentionally a plain JS spec (not an Express router).
 * Use it as documentation + a quick reference for frontend/backend integration.
 *
 * Base server:
 * - Node/Express: http://localhost:5000
 */

const API = {
  app: 'Mahotsav-26 / Vignan University Campus Navigator',
  updatedAt: '2026-03-09',

  servers: {
    backend: {
      name: 'Node API',
      baseUrl: 'http://localhost:5000',
      notes: [
        'Serves /api/* JSON endpoints',
        'Serves static assets under /public/*',
        'In production, serves the built frontend from ../frontend/build',
      ],
    },
  },

  endpoints: [
    // ---------------------------
    // Blocks / Map (MongoDB + fallback)
    // ---------------------------
    {
      group: 'Blocks',
      method: 'GET',
      path: '/api/blocks',
      purpose: 'List all blocks for the campus map (DB; returns fallback blocks if DB is down).',
      request: { query: {}, body: null },
    },
    {
      group: 'Blocks',
      method: 'GET',
      path: '/api/blocks/:name',
      purpose: 'Fetch one block by its name (DB; returns fallback block if DB is down).',
      request: { params: { name: 'a-block' }, body: null },
    },
    {
      group: 'Blocks',
      method: 'POST',
      path: '/api/blocks',
      purpose: 'Create a new block (DB required). Supports JSON or multipart/form-data; if an image file is uploaded it is saved to disk and the DB stores only the image URL.',
      request: {
        headers: {
          'Content-Type': 'application/json OR multipart/form-data',
        },
        bodyExamples: [
          {
            type: 'application/json',
            body: {
              name: 'b-block',
              displayName: 'B-block',
              image: '',
              sections: [],
              coordinates: { x: 10, y: 10, width: 5, height: 5 },
            },
          },
          {
            type: 'multipart/form-data',
            body: {
              image: '<file>',
              data: '{"name":"b-block","displayName":"B-block","coordinates":{"x":10,"y":10,"width":5,"height":5}}',
            },
          },
        ],
      },
    },
    {
      group: 'Blocks',
      method: 'PUT',
      path: '/api/blocks/:id',
      purpose: 'Update a block by Mongo ObjectId (DB required). Supports JSON or multipart/form-data; if an image file is uploaded it is saved to disk and the DB stores only the image URL.',
      request: {
        params: { id: '<mongoObjectId>' },
        bodyExamples: [
          { type: 'application/json', body: { displayName: 'B-block (Updated)' } },
          {
            type: 'multipart/form-data',
            body: {
              image: '<file>',
              data: '{"displayName":"B-block (Updated)"}',
            },
          },
        ],
      },
    },
    {
      group: 'Blocks',
      method: 'PUT',
      path: '/api/blocks/name/:name',
      purpose: 'Update a block by its name (used for coordinate updates from the map; DB required).',
      request: {
        params: { name: 'a-block' },
        body: { coordinates: { x: 75.25, y: 73.58, width: 8.57, height: 4.14 } },
      },
    },

    // Explicit, field-specific endpoints (optional but handy for UI)
    {
      group: 'Blocks',
      method: 'PUT',
      path: '/api/blocks/name/:name/coordinates',
      purpose: 'Set/update only the block coordinates (DB required).',
      request: {
        params: { name: 'a-block' },
        body: { coordinates: { x: 75.25, y: 73.58, width: 8.57, height: 4.14 } },
      },
    },
    {
      group: 'Blocks',
      method: 'DELETE',
      path: '/api/blocks/name/:name/coordinates',
      purpose: 'Clear/remove block coordinates (DB required).',
      request: { params: { name: 'a-block' }, body: null },
    },
    {
      group: 'Blocks',
      method: 'PUT',
      path: '/api/blocks/name/:name/image',
      purpose: 'Upload/replace a block image (multipart/form-data). Saves to disk; DB stores only URL.',
      request: {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { name: 'a-block' },
        body: { image: '<file>' },
      },
    },
    {
      group: 'Blocks',
      method: 'DELETE',
      path: '/api/blocks/name/:name/image',
      purpose: 'Delete a block image (also deletes the disk file if it is under /public/blocks).',
      request: { params: { name: 'a-block' }, body: null },
    },
    {
      group: 'Blocks',
      method: 'PUT',
      path: '/api/blocks/name/:name/sections/:sectionName/video',
      purpose: 'Set/update a section video link for a block (DB required).',
      request: {
        params: { name: 'a-block', sectionName: 'labs' },
        body: { video: '/public/a-block/labs/video.mp4' },
      },
    },
    {
      group: 'Blocks',
      method: 'DELETE',
      path: '/api/blocks/name/:name/sections/:sectionName/video',
      purpose: 'Remove/clear a section video link (DB required).',
      request: { params: { name: 'a-block', sectionName: 'labs' }, body: null },
    },
    {
      group: 'Blocks',
      method: 'DELETE',
      path: '/api/blocks/:identifier',
      purpose: 'Delete a block by Mongo ObjectId OR by name (DB required).',
      request: { params: { identifier: '<mongoObjectId OR a-block>' }, body: null },
    },
    {
      group: 'Blocks',
      method: 'GET',
      path: '/api/blocks/image/:name',
      purpose: 'Legacy compatibility endpoint. Responds with a redirect (302) to the block image URL stored on the block document.',
      request: { params: { name: 'a-block' }, body: null },
      response: { notes: ['Returns HTTP 302 redirect when the block has an image URL.'] },
    },
    {
      group: 'Map',
      method: 'GET',
      path: '/api/blocks/map-image',
      purpose: 'Serve the campus map image from disk (backend/public/assets/campus-map.* with fallback locations).',
      request: {
        query: {
          t: '(optional) cache-buster version from /map-metadata.lastUpdated',
        },
        body: null,
      },
      response: {
        notes: [
          'If ?t=<timestamp> is provided, Cache-Control is long-lived (immutable).',
          'Supports 304 responses via If-Modified-Since when possible.',
        ],
      },
    },
    {
      group: 'Map',
      method: 'GET',
      path: '/api/blocks/map-metadata',
      purpose: 'Get a stable lastUpdated timestamp for the campus map (based on map file mtime).',
      request: { query: {}, body: null },
      responseExample: { lastUpdated: 1710000000000 },
    },
    {
      group: 'Map',
      method: 'POST',
      path: '/api/blocks/upload-map',
      purpose: 'Upload a new campus map image to disk (backend/public/assets).',
      request: {
        headers: { 'Content-Type': 'multipart/form-data' },
        body: { map: '<file>' },
      },
      responseExample: {
        message: 'Map uploaded successfully',
        path: '/api/blocks/map-image',
        timestamp: 1710000000000,
      },
    },

    // ---------------------------
    // Auth
    // ---------------------------
    {
      group: 'Auth',
      method: 'POST',
      path: '/api/auth/login',
      purpose: 'Admin login (demo auth). Returns a base64 token.',
      request: {
        body: { username: '<username>', password: '<password>' },
      },
      responseNotes: [
        'If no admin accounts exist in the database yet, the API returns 401 with message "No admin account is configured yet".',
      ],
      responseExample: {
        success: true,
        token: '<base64>',
        username: 'admin',
        message: 'Login successful',
      },
    },
    {
      group: 'Auth',
      method: 'POST',
      path: '/api/auth/bootstrap',
      purpose: 'Create the FIRST admin (only works when there are zero admins). Returns a base64 token.',
      request: {
        body: { username: '<username>', password: '<password>' },
      },
      responseNotes: [
        'Returns 409 if an admin already exists (bootstrap disabled).',
        'Use this once to initialize an empty database.',
      ],
    },
    {
      group: 'Auth',
      method: 'GET',
      path: '/api/auth/verify',
      purpose: 'Verify token (demo).',
      request: {
        headers: { Authorization: 'Bearer <token>' },
      },
      responseExample: { success: true, user: 'admin' },
    },
    {
      group: 'Auth',
      method: 'GET',
      path: '/api/auth/admins',
      purpose: 'List admin accounts (requires Bearer token).',
      request: { headers: { Authorization: 'Bearer <token>' } },
    },
    {
      group: 'Auth',
      method: 'POST',
      path: '/api/auth/admins',
      purpose: 'Create a new admin account (requires Bearer token).',
      request: {
        headers: { Authorization: 'Bearer <token>' },
        body: { username: '<username>', password: '<password>' },
      },
    },
    {
      group: 'Auth',
      method: 'PUT',
      path: '/api/auth/admins/:id',
      purpose: 'Update an admin username and/or password (requires Bearer token).',
      request: {
        headers: { Authorization: 'Bearer <token>' },
        params: { id: '<mongoObjectId>' },
        body: { username: '(optional)', password: '(optional)' },
      },
    },
    {
      group: 'Auth',
      method: 'DELETE',
      path: '/api/auth/admins/:id',
      purpose: 'Delete an admin account (requires Bearer token).',
      request: {
        headers: { Authorization: 'Bearer <token>' },
        params: { id: '<mongoObjectId>' },
      },
    },

    // ---------------------------
    // Video Proxy
    // ---------------------------
    {
      group: 'Video Proxy',
      method: 'GET',
      path: '/api/video-proxy/onedrive-resolve',
      purpose: 'Resolve a OneDrive share URL and provide a best-effort embed candidate URL.',
      request: { query: { url: 'https://1drv.ms/... OR https://onedrive.live.com/...' }, body: null },
      responseExample: { input: '<url>', resolved: '<resolvedUrl>', embedCandidate: '<embedUrlOrEmpty>' },
    },
    {
      group: 'Video Proxy',
      method: 'GET',
      path: '/api/video-proxy/gdrive/:fileId',
      purpose: 'Stream a Google Drive video by fileId (supports Range requests when possible).',
      request: { params: { fileId: '<driveFileId>' }, headers: { Range: 'bytes=0-' } },
    },
    {
      group: 'Video Proxy',
      method: 'GET',
      path: '/api/video-proxy/onedrive',
      purpose: 'Stream a OneDrive/SharePoint shared video (public links required).',
      request: { query: { url: 'https://1drv.ms/... OR https://onedrive.live.com/...' }, headers: { Range: 'bytes=0-' } },
    },

    // ---------------------------
    // Static Assets
    // ---------------------------
    {
      group: 'Static',
      method: 'GET',
      path: '/public/*',
      purpose: 'Static files served by backend (images, videos, etc).',
      request: { body: null },
    },
  ],
};

module.exports = API;

// Allow: node api.js (quick listing)
if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(`${API.app} API index (updatedAt=${API.updatedAt})`);
  // eslint-disable-next-line no-console
  console.table(API.endpoints.map((e) => ({
    group: e.group,
    method: e.method,
    path: e.path,
    purpose: e.purpose,
  })));
}
