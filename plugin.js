// Обход CORS для GitHub Pages
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('myxdroz.github.io')) {
      if (!options) options = {};
      options.mode = 'cors';
      options.cache = 'no-cache';
    }
    return originalFetch(url, options);
  };
})();

// Плагин Prowlarr для Lampa
class ProwlarrPlugin {
  constructor() {
    this.id = 'prowlarr';
    this.name = 'Prowlarr';
    this.version = '2.1';
    this.type = ['movie', 'series'];
    this.icon = 'https://i.imgur.com/8Km9tLL.png';
    
    // Настройки по умолчанию (можно менять в Lampa)
    this.settings = {
      host: localStorage.getItem('prowlarr_host') || '146.103.102.160',
      port: localStorage.getItem('prowlarr_port') || '9696',
      apiKey: localStorage.getItem('prowlarr_apiKey') || '',
      timeout: 10000
    };
    
    this.cache = new Map();
  }

  // Конфигурация настроек для UI Lampa
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

  // Сохранение настроек
  setConfig(params) {
    this.settings = {
      ...this.settings,
      ...params
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('prowlarr_host', this.settings.host);
    localStorage.setItem('prowlarr_port', this.settings.port);
    localStorage.setItem('prowlarr_apiKey', this.settings.apiKey);
  }

  // Основная функция поиска
  async search(query, type) {
    const cacheKey = `${type}_${query}`;
    
    // Проверка кэша
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const results = await this.makeRequest(query, type);
      const formatted = this.formatResults(results, type);
      
      // Кэшируем на 5 минут
      this.cache.set(cacheKey, formatted);
      setTimeout(() => this.cache.delete(cacheKey), 300000);
      
      return formatted;
    } catch (error) {
      console.error('Prowlarr Error:', error);
      Lampa.Notify.show('Ошибка подключения к Prowlarr', 3000);
      return [];
    }
  }

  // Запрос к Prowlarr API
  async makeRequest(query, type) {
    const url = new URL(`http://${this.settings.host}:${this.settings.port}/api/v1/search`);
    url.searchParams.append('query', query);
    url.searchParams.append('type', type === 'movie' ? 'movie' : 'tvsearch');
    url.searchParams.append('apikey', this.settings.apiKey);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeout);
    
    const response = await fetch(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  }

  // Форматирование результатов
  formatResults(items, type) {
    return items.map(item => ({
      id: item.guid,
      title: item.title,
      year: item.year || new Date(item.publishDate).getFullYear(),
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

  // Форматирование размера
  formatSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Получение постера
  getPoster(item) {
    return item.images?.find(img => img.coverType === 'poster')?.url || 
           'https://i.imgur.com/zPBook0.png';
  }
}

// Регистрация плагина с проверкой CORS
(function() {
  // Проверяем, что код выполняется в Lampa
  if (typeof Lampa === 'undefined') return;
  
  // Создаем и регистрируем плагин
  const plugin = new ProwlarrPlugin();
  
  // Проверка обновлений (раз в день)
  const lastUpdate = localStorage.getItem('prowlarr_last_update');
  if (!lastUpdate || Date.now() - parseInt(lastUpdate) > 86400000) {
    fetch('https://api.github.com/repos/myxdroz/lampa-prowlarr-plugin/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data.tag_name !== `v${plugin.version}`) {
          Lampa.Notify.show('Доступно обновление Prowlarr плагина', 5000);
        }
      })
      .catch(() => {})
      .finally(() => {
        localStorage.setItem('prowlarr_last_update', Date.now().toString());
      });
  }
  
  // Регистрируем плагин
  Lampa.Plugin.register(plugin);
})();
