(function() {
	'use strict';

	var log = require(process.cwd() + '/build/server/logging.js').getLogger('handlers/PaymentHandler.js');
	var objectTools = require(process.cwd() + '/build/server/ObjectTools.js');
	var universalDaoModule = require(process.cwd() + '/build/server/UniversalDao.js');
	var dateUtils = require(process.cwd()+'/build/server/DateUtils.js').DateUtils;
	var QueryFilter = require(process.cwd()+'/build/server/QueryFilter.js');

	function PaymentHandler(ctx) {
		this.ctx=ctx;
		var self=this;

		this.handlePaymentChange=function(event){

			var eventScheduler = this.ctx.eventScheduler;

			var payment = event.entity;


			var paymentDao = new universalDaoModule.UniversalDao(
					this.ctx.mongoDriver,
					{collectionName: 'payments'}
			);
			if (payment.baseData.status!='Standalone'){

				var feesDao = new universalDaoModule.UniversalDao(
					this.ctx.mongoDriver,
					{collectionName: 'fees'}
				);

				//Search for fee
				var qf=QueryFilter.create();
				qf.addCriterium("baseData.variableSymbol","eq",payment.baseData.variableSymbol);
				qf.addCriterium("baseData.feePaymentStatus","neq",'canceled');
				feesDao.find(qf,function(err,fees){
					//update fee.payments
					if (err){
						log.error(err);
						return;
					}
					var feesIdToRecount=[];

					if ( fees.length===1 ){
						//update payment.status
						var fee=fees[0];

							if (payment.baseData.feeId && payment.baseData.feeId!=fee.id){
								//throw recount old;
								feesIdToRecount.push(payment.baseData.feeId);
							}
							payment.baseData.fee={registry:"fees",oid:fee.id};
							payment.baseData.status='Paired';
							feesIdToRecount.push(payment.baseData.fee.oid);
							//throw  recount this
					} else {

						if (payment.baseData.fee){
							feesIdToRecount.push(payment.baseData.fee.oid);
						}
						payment.baseData.status='Unpaired';
						payment.baseData.fee=null;
					}

					paymentDao.save(payment,function(err,data){
						feesIdToRecount.map(function(feeId){

							eventScheduler.scheduleEvent(new Date().getTime()+1000,'event-fee-recount',{entityId:feeId},[feeId],function(err,data){
									if (err){
										log.err(err);
										return;
									}
									log.debug('fees recount scheduled');
								} );
						});

					});
				});

			}else {

				if (payment.baseData.fee){
					feesIdToRecount.push(payment.baseData.fee.oid);
				}
				payment.baseData.status='Unpaired';
				payment.baseData.fee=null;

				paymentDao.save(payment,function(err,data){
					feesIdToRecount.map(function(feeId){

						eventScheduler.scheduleEvent(new Date().getTime()+1000,'event-fee-recount',{entityId:feeId},[feeId],function(err,data){
								if (err){
									log.err(err);
									return;
								}
								log.debug('fees recount scheduled');
							} );
					});

				});

			}

		};
	}


	PaymentHandler.prototype.handle = function(event) {
		log.info('handle called',event,PaymentHandler.prototype.ctx);

		if ("event-payment-created" === event.eventType){
			this.handlePaymentChange(event);
		} else
		if ("event-payment-updated" === event.eventType){
				this.handlePaymentChange(event);
		} else{}


	};

	PaymentHandler.prototype.getType=function(){
		return ['event-payment-updated','event-payemnt-created'];
	};


	module.exports = function( ctx) {
		return new PaymentHandler(ctx);
	};
}());
