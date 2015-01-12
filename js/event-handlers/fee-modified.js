(function() {
	'use strict';

	var log = require(process.cwd() + '/build/server/logging.js').getLogger('handlers/FeeHandler.js');
	var objectTools = require(process.cwd() + '/build/server/ObjectTools.js');
	var universalDaoModule = require(process.cwd() + '/build/server/UniversalDao.js');
	var dateUtils = require(process.cwd()+'/build/server/DateUtils.js').DateUtils;
	var QueryFilter = require(process.cwd()+'/build/server/QueryFilter.js');

	function FeeHandler(ctx) {
		this.ctx=ctx;
		var self=this;

		this.handleFeeChange=function(event){

			var entity = event.entity;

			var eventScheduler = this.ctx.eventScheduler;

			eventScheduler.unscheduleEvents(entity.id,null,function(err,data){
				eventScheduler.scheduleEvent(new Date().getTime()+1000,'event-fee-recount',{entityId:entity.id},[entity.id],function(err,data){
						if (err){
							log.err(err);
							return;
						}
						log.debug('fees recount scheduled');
					} );
				if (entity.baseData.dueDate && dateUtils.isReverseAfterNow(entity.baseData.dueDate)){
					eventScheduler.scheduleEvent(dateUtils.reverseToDate(entity.baseData.dueDate).getTime(),'event-fee-recount',{entityId:entity.id},[entity.id],function(err,data){
							if (err){
								log.err(err);
								return;
							}
							log.debug('fees recount scheduled');
						} );
				}

			});

		};

		this.handleFeeRecount=function(event){

			var feesDao = new universalDaoModule.UniversalDao(
				this.ctx.mongoDriver,
				{collectionName: 'fees'}
			);
			var paymentsDao = new universalDaoModule.UniversalDao(
				this.ctx.mongoDriver,
				{collectionName: 'payments'}
			);

			log.error('event',event);

			feesDao.get(event.entityId,function(err,fee){
				if (err){
					log.error(err);
					return;
				}
				if (!fee){
					return;
				}
				var qf=QueryFilter.create();
				qf.addCriterium("baseData.variableSymbol","eq",fee.baseData.variableSymbol);
				qf.addCriterium("baseData.status","neq",'Standalone');
				qf.addSort('baseData.accountingDate','asc');
				paymentsDao.find(qf,function(err,data){
					if (err){
						log.error('paymentsDao',err);
						return;
					}

					var paymentSum=0;
					var paidDate=null;
					var payments=data.map(function(payment){
						paymentSum+=payment.baseData.amount;
						paidDate=payment.baseData.accountingDate;
						// return {registry:"payments",oid:payment.id};
					});
					// fee.listOfPayments={payments:payments};
					fee.baseData.membershipFeePaid=paymentSum;
					if (fee.baseData.membershipFee==paymentSum){
						fee.baseData.feePaymentStatus='refunded';
					}
					else{
						if (paymentSum!==0){
							fee.baseData.feePaymentStatus='differs';
						} else {
							if (fee.baseData.feePaymentStatus!=='canceled'){
								if (fee.baseData.dueDate && dateUtils.isReverseAfterNow(fee.baseData.dueDate)){
									fee.baseData.feePaymentStatus='created';
								}else {
									fee.baseData.feePaymentStatus='overdue';
								}
							}
						}
					}

					fee.baseData.dateOfPayment=paidDate;
					feesDao.save(fee,function(err,data){
						if (err){
							log.error(err);
							return;
						}
						log.debug('fee updated',fee);
					});
				});
			});

		};
	}


	FeeHandler.prototype.handle = function(event) {
		log.info('handle called',event,FeeHandler.prototype.ctx);

		if ("event-fee-created" === event.eventType){
			this.handleFeeChange(event);
		}else if ("event-fee-updated" === event.eventType){
			this.handleFeeChange(event);
		} else if ("event-fee-recount"===event.eventType ){
			this.handleFeeRecount(event);
		}
	};

	FeeHandler.prototype.getType=function(){
		return ['event-fee-updated','event-fee-created','event-fee-overdue','event-fee-recount'];
	};


	module.exports = function( ctx) {
		return new FeeHandler(ctx );
	};
}());
