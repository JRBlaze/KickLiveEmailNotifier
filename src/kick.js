function valueAt(object, path) {
  return path.split('.').reduce((current, key) => {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      return current[key];
    }
    return undefined;
  }, object);
}

function firstValue(object, paths, fallback = '') {
  for (const path of paths) {
    const value = valueAt(object, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
}

function normalizeKickPayload(slug, payload) {
  const channel = payload.channel || payload.data?.[0] || payload.data || payload;
  const stream = channel.livestream || channel.stream || payload.livestream || payload.stream || null;
  const isLive = Boolean(
    channel.is_live ||
    channel.isLive ||
    (stream && (stream.is_live !== false && stream.isLive !== false))
  );

  const startedAt = firstValue({ channel, stream }, [
    'stream.created_at',
    'stream.start_time',
    'stream.started_at',
    'channel.stream.start_time',
    'channel.livestream.created_at'
  ], null);

  const title = firstValue({ channel, stream }, [
    'stream.session_title',
    'stream.title',
    'channel.stream_title',
    'channel.streamTitle'
  ]);

  const category = firstValue({ channel, stream }, [
    'stream.category.name',
    'stream.categories.0.name',
    'channel.category.name'
  ]);

  const liveId = firstValue({ channel, stream }, [
    'stream.id',
    'stream.key',
    'stream.slug',
    'channel.livestream.id'
  ], startedAt || title || null);

  return {
    slug: channel.slug || channel.name || slug,
    displayName: channel.name || channel.slug || slug,
    isLive,
    liveKey: isLive ? String(liveId || `${slug}-${startedAt || title || 'live'}`) : null,
    title,
    category,
    viewers: Number(firstValue({ channel, stream }, [
      'stream.viewer_count',
      'stream.viewers',
      'channel.viewer_count'
    ], 0)) || null,
    startedAt,
    url: firstValue({ channel, stream }, ['stream.url'], `https://kick.com/${slug}`),
    thumbnail: firstValue({ channel, stream }, [
      'stream.thumbnail',
      'channel.thumbnail',
      'channel.profile_image',
      'channel.profilePicture'
    ])
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      'user-agent': 'KickLiveEmailAlerts/0.1',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Kick request failed (${response.status})`);
  }

  return response.json();
}

async function getChannelStatus(slug) {
  const endpoints = [
    `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`
  ];

  let lastError;
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint);
      return normalizeKickPayload(slug, payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch Kick status.');
}

module.exports = {
  getChannelStatus,
  normalizeKickPayload
};
