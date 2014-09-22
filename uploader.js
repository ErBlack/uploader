/**
 * @typedef  {Object} Uploader — Хелпер для загрузки файлов
 * @property {String} name — имя поля для загрузки
 * @property {String} accept — mimetype для загрузки
 * @property {Boolean} multiple — позволять одновременную загрузку нескольких файлов
 * @property {Boolean} read — читать файл параллельно с загрузкой
 * @property {String} action — url для загрузки файлов
 * @property {Number} maxUpload — максимальное колличество загрузок за раз
 *
 * @method open — открыть диалог выбора файлов
 * @method on — добавить обработчик события
 * @method off — снять обработчик события
 * @method trigger — инициировать событие
 *
 * @event upload(event, files) — начало загрузки файлов
 *  @param {Event} event
 *  @param {[UploadingFile]} files — все загружаемые файлы
 * @event file(event, file) — загрузка файла
 *  @param {Event} event
 *  @param {UploadingFile} file — загружаемый файл
 * @event success(event, files) — успешная загрузка файлов
 *  @param {Event} event
 *  @param {[UploadingFile]} files — все загруженные файлы
 * @event error(event, files) — неудачная загрузка файлов
 *  @param {Event} event
 *  @param {[UploadingFile]} files — все загружаемые файлы
 */

/**
 * @typedef  {Object} UploadingFile — Хелпер для загрузки файлов
 *
 * @extends File
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File
 *
 * @property {jqXHR} _upload — запрос загрузки файла на сервер (лоступен не всегда, появляется асинхронно) @private @readonly
 *
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
    var initEmitter = function(target) {
        var emitter = $(target);

        ['on', 'off', 'trigger'].forEach(function(name) {
            Object.defineProperty(target, name, {
                value: emitter[name].bind(emitter)
            });
        });
    }

    var Uploader = function(options) {
        if (!(this instanceof Uploader)) {
            return new Uploader(options);
        }

        initEmitter(this);

        this.input = $('<input>', {
            type: 'file',
            change: this._change.bind(this)
        })[0];

        $.extend(this, options);
    };

    ['name', 'accept', 'multiple'].forEach(function(name) {
        Object.defineProperty(Uploader.prototype, name, {
            enumerable: true,
            get: function() {
                return this.input[name];
            },
            set: function(value) {
                return this.input[name] = value;
            }
        })
    });

    Object.defineProperties(Uploader.prototype, {
        action: {
            enumerable: true,
            writable: true,
            value: '/'
        },
        read: {
            enumerable: true,
            writable: true,
            value: true
        },
        maxUpload: {
            enumerable: true,
            value: 30
        },
        open: {
            enumerable: true,
            value: function() {
                $(this.input).click();
            }
        },
        _change: {
            enumerable: true,
            value: function() {
                if (!this.input.files.length) {
                    return;
                }

                var files = Array.prototype.slice.call(this.input.files, 0, this.maxUpload);

                files.forEach(function(file) {
                    initEmitter(file);
                });

                this.trigger('upload', files);

                $.when.apply($, files.map(function(file) {
                    this.trigger('file', file);

                    this._upload(file);
                    this._read(file);

                    return file._upload;
                }.bind(this))).then(function() {
                    this.trigger('success', files);
                }.bind(this), function() {
                    this.trigger('error', files);
                }.bind(this));
            }
        },
        _read: {
            value: function(file) {
                if (!this.read) {
                    return false;
                }

                var reader = new FileReader(),
                    finished = false;

                file._upload.always(function() {
                    finished = true;
                });

                reader.onload = function(event) {
                    if (!finished) {
                        file.trigger('read', event.target.result);
                    }
                };

                reader.readAsDataURL(file);
            }
        },
        _upload: {
            value: function(file) {
                var data = new FormData();

                data.append(this.name, file);

                Object.defineProperty(file, '_upload', {
                    value: $.ajax({
                        url: this.action,
                        data: data,
                        contentType: false,
                        processData: false,
                        type: 'POST',
                        success: function(json) {
                            file.trigger('success', json);
                        },
                        error: function() {
                            file.trigger('error');
                        }
                    })
                });

                return file.upload;
            }
        }
    });

    return Uploader;
}(jQuery));
