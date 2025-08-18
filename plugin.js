// Обход CORS для GitHub Pages
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string') {
      // Для всех запросов к GitHub
      if (url.includes('github.io') || url.includes('github.com')) {
        options = options || {};
        options.mode = 'cors';
        options.cache = 'no-cache';
      }
      // Автоматическое преобразование http → https если текущая страница https
      if (window.location.protocol === 'https:' && url.startsWith('http:')) {
        url = url.replace('http://', 'https://');
      }
    }
    return originalFetch(url, options);
  };
})();

class ProwlarrPlugin {
  constructor() {
    this.id = 'prowlarr';
    this.name = 'Prowlarr';
    this.version = '2.2';
    this.type = ['movie', 'series'];
    this.icon = 'https://i.imgur.com/8Km9tLL.png';
    
    // Настройки
    this.settings = {
      host: localStorage.getItem('prowlarr_host') || '146.103.102.160',
      port: localStorage.getItem('prowlarr_port') || '9696',
      apiKey: localStorage.getItem('prowlarr_apiKey') || '',
      timeout: 10000
    };
    
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 минут кэширования
  }

  get configuration() {
    return [
      {
        title: 'Настройки Prowlarr',
        params: [
          {
            name: 'host',
            title: 'IP/домен сервера',
            type: 'text',
            value: this.settings.host
          },
          {
            name: 'port',
            title: 'Порт',
            type: 'number',
            value: this.settings.port
          },
          {
            name: 'apiKey',
            title: 'API ключ',
            type: 'password',
            value: this.settings.apiKey
          }
        ]
      }
    ];
  }

  setConfig(params) {
    this.settings = { ...this.settings, ...params };
    ['host', 'port', 'apiKey'].forEach(key => {
      localStorage.setItem(`prowlarr_${key}`, this.settings[key]);
    });
  }

  async search(query, type) {
    if (!this.settings.host || !this.settings.apiKey) {
      Lampa.Notify.show('Настройте подключение к Prowlarr', 3000);
      return [];
    }

    const cacheKey = `${type}_${query}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const results = await this.makeRequest(query, type);
      const formatted = this.formatResults(results, type);
      
      this.cache.set(cacheKey, {
        data: formatted,
        timestamp: Date.now()
      });
      
      return formatted;
    } catch (error) {
      console.error('Prowlarr Error:', error);
      Lampa.Notify.show(`Ошибка: ${error.message}`, 3000);
      return [];
    }
  }

  async makeRequest(query, type) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const url = new URL(`${protocol}//${this.settings.host}:${this.settings.port}/api/v1/search`);
    
    url.searchParams.append('query', query);
    url.searchParams.append('type', type === 'movie' ? 'movie' : 'tvsearch');
    url.searchParams.append('apikey', this.settings.apiKey);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const error = new Error(`HTTP error! Status: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Request Error:', error);
      if (error.name === 'AbortError') {
        error.message = 'Таймаут подключения к серверу';
      } else if (error.status === 401) {
        error.message = 'Неверный API ключ';
      }
      throw error;
    }
  }

  formatResults(items, type) {
    if (!Array.isArray(items)) return [];
    
    return items.map(item => ({
      id: item.guid || Math.random().toString(36).substring(2),
      title: item.title || 'Без названия',
      year: item.year || new Date(item.publishDate).getFullYear() || '',
      poster: this.getPoster(item),
      description: item.description || 'Нет описания',
      seeds: item.seeders || 0,
      peers: item.leechers || 0,
      size: this.formatSize(item.size),
      quality: item.quality || 'HD',
      material_data: {
        source: this.id,
        magnet: item.magnetUrl,
        tracker: item.indexer || 'Unknown',
        type: type
      }
    }));
  }

  formatSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  getPoster(item) {
    return item.images?.find(img => img.coverType === 'poster')?.url || 
           'https://i.imgur.com/zPBook0.png';
  }
}

// Инициализация плагина
(function() {
  if (typeof Lampa === 'undefined' || !Lampa.Plugin) {
    console.error('Lampa не обнаружена или несовместимая версия');
    return;
  }

  const plugin = new ProwlarrPlugin();
  
  // Проверка обновлений
  const checkUpdates = () => {
    if (!localStorage['prowlarr_last_update'] || 
        Date.now() - parseInt(localStorage['prowlarr_last_update']) > 86400000) {
      fetch('https://api.github.com/repos/myxdroz/lampa-prowlarr-plugin/releases/latest', {
        cache: 'no-cache'
      })
        .then(res => res.json())
        .then(data => {
          if (data.tag_name !== `v${plugin.version}`) {
            Lampa.Notify.show('Доступно обновление Prowlarr плагина', 5000);
          }
        })
        .finally(() => {
          localStorage['prowlarr_last_update'] = Date.now();
        });
    }
  };

  // Задержка перед проверкой обновлений
  setTimeout(checkUpdates, 10000);
  
  Lampa.Plugin.register(plugin);
})();
