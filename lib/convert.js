var childProcess = require('child_process'),
  logger = require('./logger'),
  fs = require('fs');

/**
 * Options:
 * page: 'A4', 'A3'
 * type: 'png', 'jpg'
 * logLevel: 1 = info, 0, error (default)
 * tmpPath: '/path/to/tmp' (optional),
 * autoRemoveTmp: true, false (default)
 */

var TiffConverter = function(options){
  var _this = this;

  _this.converted = [];
  _this.total = 0;
  _this.location = '';
  _this.tiffs = [];
  _this.options = options;
  _this.errors = [];

  if (options) {
    _this.options.autoRemoveTmp =  options.autoRemoveTmp || false;
  }

  /**
   * Callback to show the amount converted.
   */
  _this.progress = function(converted, total){}

  _this.complete = function(errors, converted, total){
    if(errors.length > 0 && _this.options.logLevel === 0) {
      return logger.error(errors);
    }
  }

  logger.level = options && options.logLevel ? options.logLevel : 0;
};

/**
 * Creates the directory the PNG's will sit
 */
TiffConverter.prototype.createDir = function(target, filename, cb){
  fs.exists(target, function(exists) {
    if (exists) {
      logger.title(filename, 'exists');
      return cb();
    }
    logger.title(filename, 'created');
    fs.mkdir(target, '0755', cb);
  });
}

TiffConverter.prototype.count = function(converted, key, value){
  var num = 0;
  for(var i = 0; i < converted.length; i++){
    if(converted[i][key] === value){
      num++;
    }
  }
  return num;
}

TiffConverter.prototype.convert = function(){

  var _this = this,
    type = _this.options.type ? _this.options.type : 'png',
    prefix = _this.options.prefix ? _this.options.prefix : 'page',
    suffix = _this.options.suffix ? _this.options.suffix : '';

  var original = _this.tiffs[_this.converted.length];

  var filenameRegex = new RegExp('([^\\|\/]*(?=[.][a-zA-Z]+$))', 'g'),
    filename = original.match(filenameRegex)[0];
    target = _this.options.saveFolder ? _this.location + '/' + _this.options.saveFolder : _this.location + '/' + filename;

  // Create the director
  _this.createDir(target, filename, function(err){

    if(err) logger.error(err);

    var command = 'convert';

    if (_this.options.tmpPath) {
      command += ' -define registry:temporary-path=' + _this.options.tmpPath;
    }

    command += ' ' + original + ' -scene 1 ' + target + '/' + prefix + '%d' + suffix + '.' + type;

    childProcess.exec(command, function(err, stdout, stderr){

      if(err){
        logger.tabbed('Conversion failed', false);
        _this.errors.push({
          target: target,
          error: err
        });
      }else{
        logger.tabbed('Successful conversion', true);
      }

      _this.converted.push({
        original: original,
        target: target,
        success: !err ? true : false
      });

      _this.progress(_this.converted, _this.total);

      if(_this.converted.length === _this.total){
        // All of the Tiffs have been converted
        logger.space();
        logger.success(_this.count(_this.converted, 'success', true) + ' Converted.');
        logger.fail(_this.count(_this.converted, 'success', false) + ' Failed.');
        logger.space();

        if(_this.errors.length > 0){
          _this.errors.forEach(function(error){
            logger.debugError(error.target, error.error);
            logger.space();
          });
        }

        // Process complete, if there is a tmpPath set, remove any files
        if (_this.options.tmpPath && _this.options.autoRemoveTmp) {
          fs.readdir(_this.options.tmpPath, function(err, files) {
            if (err) logger.error(err);
            files.forEach(function(file) {
              var pattern = new RegExp('magick-');
              if (pattern.test(file)) {
                fs.unlink(_this.options.tmpPath + '/' + file);
              }
            });
          });
        }

        return _this.complete(_this.errors, _this.converted, _this.total);
      }

      _this.convert();

    });

  });

};

TiffConverter.prototype.convertArray = function(tiffs, location){

  var _this = this;

  if(!tiffs || tiffs.length === 0) 
    return logger.error('An array of tiffs is required');

  if(!location || location === "")
    return logger.error('The location folder is required');

  // Reset all variables
  _this.converted = [];
  _this.errors = [];

  /**
   * Call the convert method with a callback
   * which will call the convert until it is
   * complete
   */
  _this.total = tiffs.length;
  _this.location = location;
  _this.tiffs = tiffs;
  _this.convert();

};

module.exports = TiffConverter;
