/**
 * Prowlarr Plugin for Lampa
 * @version 1.1.0
 * @license MIT
 */

class ProwlarrPlugin {
  constructor() {
    // Метаданные
    this.id = 'prowlarr';
    this.name = 'Prowlarr';
    this.version = '1.1.0';
    this.type = ['movie', 'series'];
    this.icon = 'https://raw.githubusercontent.com/<ваш-username>/lampa-prowlarr-plugin/main/icon.png';
    
    // Конфигурация
    this.config = {
      host: '146.103.102.160',
      port: '9696',
      apiKey: 'd69e437df6de464a86cd3aceb6436ae0',
      timeout: 10000
    };
    
    // Кэш
    this.cache = new Map();
  }

  async search(query, type) {
    const cacheKey = `${type}_${query}`;
    
    // Проверка кэша
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const results = await this._fetchFromProwlarr(query, type);
      const formatted = this._formatResults(results);
      
      // Кэширование на 5 минут
      this.cache.set(cacheKey, formatted);
      setTimeout(() => this.cache.delete(cacheKey), 300000);
      
      return formatted;
    } catch (error) {
      console.error('[Prowlarr] Error:', error);
      return [];
    }
  }

  async _fetchFromProwlarr(query, type) {
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
    return await response.json();
  }

  _formatResults(items) {
    return items.map(item => ({
      id: item.guid,
      title: item.title,
      year: item.year || new Date(item.publishDate).getFullYear(),
      poster: this._getPoster(item),
      description: item.description,
      rating: item.rating,
      seeds: item.seeders,
      size: this._formatSize(item.size),
      material_data: {
        source: this.id,
        magnet: item.magnetUrl,
        tracker: item.indexer
      }
    }));
  }

  _formatSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _getPoster(item) {
    return item.images?.find(img => img.coverType === 'poster')?.url || 
           'https://via.placeholder.com/300x450?text=No+Poster';
  }
}

// Автоматическое обновление
if (typeof Lampa !== 'undefined') {
  Lampa.Plugin.register(new ProwlarrPlugin());
  
  // Проверка обновлений (раз в день)
  if (!localStorage['prowlarr_last_update']) {
    localStorage['prowlarr_last_update'] = Date.now();
  } else if (Date.now() - parseInt(localStorage['prowlarr_last_update']) > 86400000) {
    fetch('https://api.github.com/repos/<ваш-username>/lampa-prowlarr-plugin/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data.tag_name !== 'v1.1.0') {
          Lampa.Notify.show('Доступно обновление Prowlarr плагина');
        }
      });
  }
}
