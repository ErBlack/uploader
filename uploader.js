/**
 * @typedef  {Object} Uploader — Хелпер для загрузки файлов
 *
 * @property {String} name — имя поля для загрузки
 * @property {String} accept — mimetype для загрузки
 * @property {Boolean} multiple — позволять одновременную загрузку нескольких файлов
 * @property {Boolean} read — читать файл параллельно с загрузкой
 * @property {String} action — url для загрузки файлов
 * @property {Number} retryTimeout — таймаут между попытками загрузки файла в миллисекундах
 * @property {Number} maxRetries — максимальное колличество попыток загрузить файл
 * @property {Number} maxUploadSize — максимальный размер загрузки в байтах
 * @property {Boolean} autoUpload — автоматически загружать добавленные файлы
 * @property {Number} maxAutoUploads — максимальное колличество одновременно загружаемых автоматически файлов
 * @property {Object} headers — заголовки для запроса к серверу
 * @property {Object} pendingQueue — очередь файлов в ожидании
 * @property {Object} uploadingQueue — очередь файлов в загрузке
 *
 * @property {Number} maxUpload — максимальное колличество загрузок за раз
 *
 * @method add(file) — добавить файл в очередь
 *  @param {File} — объект file из поля или drag'n'drop области
 * @method open — открыть диалог выбора файлов
 * @method on — добавить обработчик события
 * @method off — снять обработчик события
 * @method trigger — инициировать событие
 *
 * @event upload(event, files) — начало загрузки файлов
 *  @param {Event} event
 *  @param {[UploaderFile]} files — все загружаемые файлы
 * @event file(event, file) — добавление файла
 *  @param {Event} event
 *  @param {UploaderFile} file — добавленный файл
 * @event complete(event) — завершение загрузки файлов
 *  @param {Event} event
 */

/**
 * @typedef  {Object} UploaderFile — Хелпер для загрузки файлов
 *
 * @extends File
 *
 * @property {File} file — объект file из поля или drag'n'drop области
 *  @see https://developer.mozilla.org/en-US/docs/Web/API/File
 * @property {String} mime — mime-тип файла (@example image/jpg)
 * @property {String} type — тип файла (@example image)
 * @property {String} name — имя файла
 * @property {Number} size — размер файла в байтах
 * @property {Date} modifiedDate — дата последнего изменения
 * @property {Number} uploadTries — колличество попыток загруки файла
 * @property {Number} id — id файла
 *
 * @method read — прочитать содержимое файла
 * @method remove — удалить файл из очереди и отменить его загрузку
 * @method on — добавить обработчик события
 * @method off — снять обработчик события
 * @method trigger — инициировать событие
 *
 * @event read(event, raw) — завершение чтения файла
 *  @param {Event} event
 *  @param {String} raw — содержимое файла
 * @event success(event, files) — успешная загрузка файлов
 *  @param {Event} event
 *  @param {Object} json — ответ сервера
 * @event error(event, files) — неудачная загрузка файлов
 *  @param {Event} event
 */

var Uploader = (function($) {
    'use strict';
    var id = 0;

    function initEmitter(wrap, target) {
        var emitter = $(wrap);

        ['on', 'off', 'trigger'].forEach(function(name) {
            Object.defineProperty(target, name, {
                enumerable: true,
                value: emitter[name].bind(emitter)
            });
        });
    }

    /* UploaderFile */
    function UploaderFile(file) {
        if (!(this instanceof UploaderFile)) {
            return new UploaderFile(file);
        }

        initEmitter(file, this);

        Object.defineProperty(this, 'id', {
            enumerable: true,
            value: id++
        });

        this.file = file;
    }

    Object.defineProperties(UploaderFile.prototype, {
        mime: {
            enumerable: true,
            get: function() {
                return this.file && this.file.type;
            }
        },
        type: {
            enumerable: true,
            get: function() {
                return this.file && this.file.type.slice(0, this.file.type.indexOf('/'));
            }
        },
        name: {
            enumerable: true,
            get: function() {
                return this.file && this.file.name;
            }
        },
        size: {
            enumerable: true,
            get: function() {
                return this.file && this.file.size;
            }
        },
        modifiedDate: {
            enumerable: true,
            get: function() {
                return this.file && this.file.lastModifiedDate;
            }
        },
        uploadTries: {
            enumerable: true,
            writable: true,
            value: 0
        },
        read: {
            enumerable: true,
            value: function() {
                if (!this.file) {
                    return;
                }

                var reader = new FileReader();

                reader.onload = function(event) {
                    this.trigger('read', event.target.result);
                }.bind(this);

                reader.readAsDataURL(this.file);
            }
        }
    });

    /* Uploader */
    var Uploader = function(options) {
        if (!(this instanceof Uploader)) {
            return new Uploader(options);
        }

        initEmitter(this, this);

        this.input = $('<input>', {
            type: 'file',
            change: this._change.bind(this)
        })[0];

        Object.defineProperties(this, {
            pendingQueue: {
                enumerable: true,
                value: {}
            },
            uploadingQueue: {
                enumerable: true,
                value: {}
            },
            _uploading: {
                value: 0,
                writable: true
            },
            _inProgress: {
                value: false,
                writable: true
            }
        });

        $.extend(this, options);
    };

    ['name', 'accept', 'multiple'].forEach(function(name) {
        Object.defineProperty(Uploader.prototype, name, {
            enumerable: true,
            get: function() {
                return this.input[name];
            },
            set: function(value) {
                this.input[name] = value;
            }
        });
    });

    Object.defineProperties(Uploader.prototype, {
        action: {
            enumerable: true,
            writable: true,
            value: '/'
        },
        retryTimeout: {
            enumerable: true,
            value: 1000
        },
        maxRetries: {
            enumerable: true,
            writable: true,
            value: 1
        },
        maxUploadSize: {
            enumerable: true,
            writable: true,
            value: 0
        },
        autoUpload: {
            enumerable: true,
            writable: true,
            value: true
        },
        maxAutoUploads: {
            enumerable: true,
            writable: true,
            value: 10
        },
        headers: {
            enumerable: true,
            writable: true,
            value: {}
        },
        open: {
            enumerable: true,
            value: function() {
                $(this.input).click();
            }
        },
        add: {
            enumerable: true,
            value: function(file) {
                file = new UploaderFile(file);

                if (this.maxUploadSize && file.size > this.maxUploadSize) {
                    return false;
                }

                file.remove = this._remove.bind(this, file);
                file.upload = this._upload.bind(this, file);

                this.pendingQueue[file.id] = file;
                this.trigger('file', file);

                this._continueUpload();

                return file;
            }
        },
        _change: {
            value: function() {
                if (!this.input.files.length) {
                    return;
                }

                var files = Array.prototype.map.call(this.input.files, this.add.bind(this));
            }
        },
        _upload: {
            value: function(file) {
                if (file.request) {
                    return;
                }

                if (!file.ajaxSettings) {
                    var xhr = new XMLHttpRequest(),
                        data = new FormData();

                    data.append(this.name, file.file);

                    xhr.upload.onprogress = function(event) {
                        if (event.lengthComputable) {
                            file.trigger('progress', (event.loaded / event.total) * 100);
                        }
                    };

                    file.ajaxSettings = {
                        url: this.action,
                        xhr: function() {
                            return xhr;
                        },
                        data: data,
                        headers: this.headers,
                        dataType: 'json',
                        contentType: false,
                        processData: false,
                        type: 'POST',
                        success: function(json) {
                            this._remove(file);

                            file.trigger('success', json);
                        }.bind(this),
                        error: function() {
                            delete file.request;

                            if (file.uploadTries <= this.maxRetries) {
                                file.trigger('retry');

                                setTimeout(function() {
                                    this._upload(file);
                                }.bind(this), this.retryTimeout);
                            } else {
                                this._remove(file);

                                file.trigger('error');
                            }
                        }.bind(this)
                    }
                }

                if (this.pendingQueue[file.id]) {
                    delete this.pendingQueue[file.id];
                }

                if (!this.uploadingQueue[file.id]) {
                    this.uploadingQueue[file.id] = file;
                    this._uploading++;
                }

                file.uploadTries++;

                file.request = $.ajax(file.ajaxSettings);

                file.trigger('upload');

                this._checkProgress();

                return file.request;
            }
        },
        _remove: {
            value: function(file) {
                if (file.request) {
                    file.request.abort();

                    delete file.request;
                }

                if (this.uploadingQueue[file.id]) {
                    this._uploading--;
                }

                delete this.pendingQueue[file.id];
                delete this.uploadingQueue[file.id];

                delete file.upload;
                delete file.remove;
                delete file.ajaxSettings;
                delete file.file;

                this._continueUpload();
            }
        },
        /**
         * Проверяет, остались ли файлы которые нужно загрузить
         */
        _checkProgress: {
            value: function() {
                if (!!this._uploading != this._inProgress) {
                    this._inProgress = !this._inProgress;

                    this.trigger(this._inProgress ? 'upload' : 'complete');
                }
            }
        },
        /**
         * Если включена автозагрузка и есть файлы ожидающие загрузки, поставит на загрузку файлы если в очереди появилось место
         */
        _continueUpload: {
            value: function() {
                if (this.autoUpload) {
                    var length = this.maxAutoUploads - this._uploading,
                        queue = Object.keys(this.pendingQueue);

                    while (length > 0 && queue.length) {
                        this._upload(this.pendingQueue[queue.shift()]);

                        length--;
                    }
                }

                this._checkProgress();
            }
        }
    });

    return Uploader;
}(jQuery));