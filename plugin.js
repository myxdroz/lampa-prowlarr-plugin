class ProwlarrPlugin {
  constructor() {
    // Метаданные
    this.id = 'prowlarr';
    this.name = 'Prowlarr';
    this.version = '2.0';
    this.type = ['movie', 'series'];
    this.icon = 'https://raw.githubusercontent.com/myxdroz/lampa-prowlarr-plugin/main/icon.png';
    
    // Конфигурация (значения по умолчанию)
    this.config = {
      host: localStorage.getItem('prowlarr_host') || '146.103.102.160',
      port: localStorage.getItem('prowlarr_port') || '9696',
      apiKey: localStorage.getItem('prowlarr_apikey') || '',
      timeout: 15000
    };
    
    this.cache = new Map();
  }

  get settings() {
    return [
      {
        name: 'host',
        title: 'Prowlarr Server',
        type: 'text',
        default: this.config.host
      },
      {
        name: 'port',
        title: 'Port',
        type: 'number',
        default: this.config.port
      },
      {
        name: 'apiKey',
        title: 'API Key',
        type: 'password',
        default: this.config.apiKey
      }
    ];
  }

  async search(query, type) {
    const cacheKey = `${type}_${query}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const results = await this._makeRequest(query, type);
      const formatted = this._formatResults(results, type);
      
      this.cache.set(cacheKey, formatted);
      setTimeout(() => this.cache.delete(cacheKey), 300000);
      
      return formatted;
    } catch (error) {
      console.error('[Prowlarr] Error:', error);
      return [];
    }
  }

  async _makeRequest(query, type) {
    const url = new URL(`http://${this.config.host}:${this.config.port}/api/v1/search`);
    url.searchParams.append('query', query);
    url.searchParams.append('type', type === 'movie' ? 'movie' : 'tvsearch');
    url.searchParams.append('apikey', this.config.apiKey);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    
    const response = await fetch(url.toString(), {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  _formatResults(items, type) {
    return items.map(item => ({
      id: item.guid,
      title: item.title,
      year: item.year || new Date(item.publishDate).getFullYear(),
      poster: this._getPoster(item),
      description: item.description,
      seeds: item.seeders || 0,
      peers: item.leechers || 0,
      size: this._formatSize(item.size),
      quality: item.quality,
      material_data: {
        source: this.id,
        magnet: item.magnetUrl,
        tracker: item.indexer,
        type: type
      }
    }));
  }

  _formatSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  _getPoster(item) {
    return item.images?.find(img => img.coverType === 'poster')?.url || 
           'https://via.placeholder.com/300x450?text=No+Poster';
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('prowlarr_host', this.config.host);
    localStorage.setItem('prowlarr_port', this.config.port);
    localStorage.setItem('prowlarr_apikey', this.config.apiKey);
  }
}

// Автоматическое обновление
if (typeof Lampa !== 'undefined') {
  const plugin = new ProwlarrPlugin();
  Lampa.Plugin.register(plugin);
  
  // Проверка обновлений
  if (!localStorage['prowlarr_last_update']) {
    localStorage['prowlarr_last_update'] = Date.now();
  } else if (Date.now() - parseInt(localStorage['prowlarr_last_update']) > 86400000) {
    fetch('https://api.github.com/repos/myxdroz/lampa-prowlarr-plugin/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data.tag_name !== `v${plugin.version}`) {
          Lampa.Notify.show('Доступно обновление Prowlarr плагина');
        }
      })
      .finally(() => {
        localStorage['prowlarr_last_update'] = Date.now();
      });
  }
}
