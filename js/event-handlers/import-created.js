(function() {
	'use strict';

	var log = require(process.cwd() + '/build/server/logging.js').getLogger('manglers/ImportHandler.js');
	var objectTools = require(process.cwd() + '/build/server/ObjectTools.js');
	var universalDaoModule = require(process.cwd() + '/build/server/UniversalDao.js');
	var dateUtils = require(process.cwd()+'/build/server/DateUtils.js').DateUtils;

	function ImportHandler(ctx) {
		this.ctx=ctx;
		var self=this;

		this.handleImportCreated=function(event){
		var entity = event.entity;
			log.verbose('handling',entity);
			self.ctx.importService.import(entity.baseData.type,entity.id,entity.baseData.file,function(err){
				if (err){
					log.error(err);
				}else {
					log.info('file imported');
				}
			});
		};
	}

	ImportHandler.prototype.handle = function(event) {
		log.info('handle called',event,ImportHandler.prototype.ctx);

		if ('event-import-created' === event.eventType){
			this.handleImportCreated(event);
		}
	};

	ImportHandler.prototype.getType=function(){
		return ['event-import-created'];
	};

	module.exports = function(ctx) {
		return new ImportHandler(ctx);
	};
}());
