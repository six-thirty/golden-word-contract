var async = require('async');
var Promise = require('bluebird');
var moment = require('moment-timezone')

var ntvuUtils = require('./util/ntvuUtils');
var NTVToken = artifacts.require("./NTVToken.sol");
var NTVUToken = artifacts.require("./NTVUToken.sol");

function advanceTime(delay, done) {
	web3.currentProvider.sendAsync({
		jsonrpc: "2.0",
		"method": "evm_increaseTime",
		params: [delay]}, done)
}

function snapshot(done) {
	web3.currentProvider.sendAsync({
		jsonrpc: "2.0",
		"method": "evm_snapshot",
		params: []}, done)
}

function revert(done) {
	web3.currentProvider.sendAsync({
		jsonrpc: "2.0",
		"method": "evm_revert",
		params: []}, done)
}

function mine(done) {
	web3.currentProvider.sendAsync({
		jsonrpc: "2.0",
		"method": "evm_mine",
		params: []}, done)
}


function wait(timeout, done) {
	setTimeout(done, timeout)
}

function setTimeAt(date, done) {
    var targetTime = new Date(date).getTime() / 1000;

    web3.eth.getBlock('latest', function(err, block){
        if(err) return done(err);

        var jumpTime = targetTime - block.timestamp;
        if (jumpTime <= 0) {
            return done("targetTime less than block.timestamp!");
        }

        advanceTime(jumpTime, function(err){
            if(err) return done(err);

            done();
        });
    });
}

function nextYear(next) {
    web3.eth.getBlock('latest', function(err, block){
        if(err) return done(err);

        var date = new Date(block.timestamp * 1000);
        var year = moment(date).format("YYYY");
        next(null, parseInt(year) + 1);
    });
}

var advanceTimeAsync = Promise.promisify(advanceTime);
var snapshotAsync = Promise.promisify(snapshot);
var revertAsync = Promise.promisify(revert);
var mineAsync = Promise.promisify(mine);
var setTimeAtAsync = Promise.promisify(setTimeAt);
var nextYearAsync = Promise.promisify(nextYear);
var waitAsync = Promise.promisify(wait);

var accountIndex = 0;

contract('NTVToken', function(accounts) {
	var ntvToken;
	var curYear;
	var onlineTime;
	var mainAccount;
	var secordAccount;
	var threeAccount;
	var ethSaver;

	beforeEach(function(done) {
		accountIndex++;
		
		mainAccount = accounts[accountIndex % accounts.length];
		secordAccount = accounts[(accountIndex+1) % accounts.length];
		threeAccount = accounts[(accountIndex+2) % accounts.length];
		ethSaver = accounts[(accountIndex+3) % accounts.length];

        done();
	});
	
    beforeEach(function(done) {
        nextYearAsync().then(function(year){
            curYear = year;
            done();
        });
    });
	
	beforeEach(function(done) {
		onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;
		done();
	});
	
    beforeEach(function(done) {
        NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
			ntvToken = instance;
			done();
        });
	});

	describe("#startup", function(){
		it("startup should be Ok", function(done) {
			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid) {
				return ntvToken.onlineTime();
			}).then(function(time) {
				expect(ntvuUtils.toDate(time)).to.equal(curYear + "-03-29 00:00:00");
				done();
			});
		});

		it("startup with no all day should be Fail", function(done) {
			var onlineTime = new Date(curYear + "-03-29 12:11:00").getTime()/1000;

			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid) {
				return ntvToken.onlineTime();
			}).then(function(time) {
				done("onlineTime should be all day time, like '" + curYear + "-03-29 00:00:00'");
			}).catch(function(e){
				expect(e).not.null;
				done();
			});
		});

		it("startup onlineTime less than now should be Fail", function(done) {
			var onlineTime = new Date((curYear - 2) + "-02-26 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid) {
				return ntvToken.onlineTime();
			}).then(function(time) {
				done("onlineTime less than now should be fail");
			}).catch(function(e){
				expect(e).not.null;
				done();
			});
		});
	});


	describe("#dayFor", function(){
		beforeEach(function(done) {
			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(){
				done();
			});
		});

		it("'curYear-02-23 12:00:00' should be 0 day", function(done) {
			var dayTime = new Date(curYear + "-02-23 12:00:00").getTime()/1000;

			ntvToken.dayFor(dayTime).then(function(day) {
				expect(day.toNumber()).to.equal(0);
				done();
			});
		});

		it("'curYear-03-29 00:00:00' should be 1 day", function(done) {
			var dayTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.dayFor(dayTime).then(function(day) {
				expect(day.toNumber()).to.equal(1);
				done();
			});
		});

		it("'curYear-03-30 12:00:00' should be 2 day", function(done) {
			var dayTime = new Date(curYear + "-03-30 12:00:00").getTime()/1000;

			ntvToken.dayFor(dayTime).then(function(day) {
				expect(day.toNumber()).to.equal(2);
				done();
			});
		});

		it("'curYear-04-01 12:00:00' should be 4 day", function(done) {
			var dayTime = new Date(curYear + "-04-01 12:00:00").getTime()/1000;

			ntvToken.dayFor(dayTime).then(function(day) {
				expect(day.toNumber()).to.equal(4);
				done();
			});
		});
	});

	describe("#todayNumberFor", function(){
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(){
				done();
			});
		});

		it("'curYear-03-29 00:00:00' should be 1 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(1);
				done();
			});
		});

		it("'curYear-03-29 01:00:00' should be 1 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 01:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(1);
				done();
			});
		});

		it("'curYear-03-28 01:00:00' should be 0 num", function(done) {
			var timeAt = new Date(curYear + "-03-28 01:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(0);
				done();
			});
		});

		it("'curYear-03-29 04:00:00' should be 0 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 04:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(0);
				done();
			})
		});

		it("'curYear-03-29 11:00:00' should be 2 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 11:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(2);
				done();
			});
		});

		it("'curYear-03-29 13:00:00' should be 3 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 13:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(3);
				done();
			});
		});

		it("'curYear-03-29 19:00:00' should be 4 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 19:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(4);
				done();
			});
		});

		it("'curYear-03-29 21:00:00' should be 5 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 21:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(5);
				done();
			});
		});

		it("'curYear-03-29 23:00:00' should be 6 num", function(done) {
			var timeAt = new Date(curYear + "-03-29 23:00:00").getTime()/1000;

			ntvToken.numberFor(timeAt).then(function(num) {
				expect(num.toNumber()).to.equal(6);
				done();
			});
		});
	});
	
	describe("#createNTVU", function(){
		beforeEach(function(done) {
			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(){
				done();
			});
		});

		it("createNTVU should be ok", function() {
			return ntvToken.createNTVU({from: mainAccount, gas: 6000000})
				.then(txid => ntvToken.totalTimeRange())
				.then(count => expect(count.toNumber()).to.equal(1));
		});

		it("createNTVU FOTs should be ok", function(done) {
			async.series([
				// 第1天
				function(done) {
					// FOT01，首拍
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(0, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT01");
							expect(ntvInfo.name).to.equal("FOT01");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 00:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-29 02:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT02，第一个私募
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(1, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT02");
							expect(ntvInfo.name).to.equal("FOT02");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 10:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-29 12:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT03
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(2, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT03");
							expect(ntvInfo.name).to.equal("FOT03");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 12:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-29 14:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT04
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(3, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT04");
							expect(ntvInfo.name).to.equal("FOT04");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 18:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-29 20:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT05
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(4, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT05");
							expect(ntvInfo.name).to.equal("FOT05");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 20:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-29 22:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT06
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(5, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT06");
							expect(ntvInfo.name).to.equal("FOT06");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-27 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-28 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-29 22:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-30 00:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},

				// 第二天

				function(done) {
					// FOT07，第二天第1个时段
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(6, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT07");
							expect(ntvInfo.name).to.equal("FOT07");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-29 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-29 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-30 00:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-30 02:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT08，第二天第2个时段
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(7, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT08");
							expect(ntvInfo.name).to.equal("FOT08");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-29 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-29 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-30 10:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-30 12:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				},
				function(done) {
					// FOT09，第二天第3个时段
					ntvToken.createNTVU({from: mainAccount, gas: 5000000})
						.then(function(){
							return ntvToken.queryNTVUs(8, 1);
						}).then(function(ntvs) {
							return NTVUToken.at(ntvs[0]);
						}).then(function(ntvuToken){
							return ntvuToken.getInfo();
						}).then(function(result){
							var ntvInfo = ntvuUtils.toNTVU(result);

							expect(ntvInfo.symbol).to.equal("FOT09");
							expect(ntvInfo.name).to.equal("FOT09");
							
							expect(web3.fromWei(ntvInfo.bidStartValue, "ether").toNumber()).to.equal(0.1);
							expect(ntvuUtils.toDate(ntvInfo.bidStartTime)).to.equal(curYear + "-03-29 18:30:00");
							expect(ntvuUtils.toDate(ntvInfo.bidEndTime)).to.equal(curYear + "-03-29 22:00:00");

							expect(ntvuUtils.toDate(ntvInfo.tvUseStartTime)).to.equal(curYear + "-03-30 12:00:00");
							expect(ntvuUtils.toDate(ntvInfo.tvUseEndTime)).to.equal(curYear + "-03-30 14:00:00");

							expect(ntvInfo.isPrivate).to.be.false;

							done();
						});
				}
			], done);
		});

		it("createNTVU All should be ok", function(done) {
			function wait(done) {
				setTimeout(done, 200);
			}

			function createOne(done) {
				return ntvToken.createNTVU({from: mainAccount, gas: 6000000})
					.then(function(){
						mine(function(){
							wait(done);
						});
					});
			}

			var all = [];
			for(var i=0; i<66; i++) {
				if (i % 5 == 0) {
					all.push(wait);
				}

				all.push(createOne);
			}

			async.series(all, function(){
				ntvToken.totalTimeRange().then(function(count){
					expect(count.toNumber()).to.equal(66);

					ntvToken.createNTVU({from: mainAccount, gas: 6000000})
						.then(function(){
							done("More than 66 should fail!");
						}).catch(function(e){
							done();
						});
				});
			});
		});
	});
	

	describe("#auditNTVUText and getText", function(){
		var ntvuToken;

		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
					ntvuToken = NTVUToken.at(ntvs[0]);
					done();
				});
			});
		});

		// 出价
        beforeEach(function(done) {
            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("10", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                return ntvuToken.end({from: mainAccount, gas: 5000000, value: web3.toWei(0, "ether")}); // 结束竞拍
            }).then(function(){
                done();
            });
        });

		// 设置文本
		beforeEach(function(done) {
			ntvuToken.setText("Hello World!", {from: secordAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.text();
			}).then(function(text){
				expect(text).to.equal("Hello World!");
                done();
            });
		});

		it("auditNTVUText should be Ok", function(done) {
			var _text = "Hello World!";

			setTimeAtAsync(curYear + "-03-28 23:31:00").then(function(){
				return ntvToken.auditNTVUText(0, 1, _text, {from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-29 00:01:00"); // 设置区块时间到时段时间
			}).then(function(txid) {
				return ntvToken.getText();
			}).then(function(text) {
				expect(text).to.equal(_text);
				done();
			});
		});

		it("auditNTVUText not pass should be Ok", function(done) {
			var _text = "Not Pass";

			setTimeAtAsync(curYear + "-03-28 23:31:00").then(function(){
				return ntvToken.auditNTVUText(0, 2, _text, {from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-29 00:01:00"); // 设置区块时间到时段时间
			}).then(function(txid) {
				return ntvToken.getText();
			}).then(function(text) {
				expect(text).to.equal(_text);
				done();
			});
		});

		it("not auditNTVUText should be Ok", function(done) {
			var _text = "浪花有意千里雪，桃花无言一队春。";

			setTimeAtAsync(curYear + "-03-29 00:01:00").then(function(txid) {
				return ntvToken.getText();
			}).then(function(text) {
				expect(text).to.equal(_text);
				done();
			});
		});

		it("auditNTVUText when two timeRange should be Ok", function(done) {
			var fot02;
			var fot03;

			ntvToken.createNTVU({from: mainAccount, gas: 5000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000}); // FOT02 10:00 - 12:00
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000}); // FOT03 12:00 - 14:00
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 3).then(function(ntvs) {
					expect(ntvs.length).to.equal(3);

					fot02 = ntvs[1];
					fot03 = ntvs[2];

					var _default_text = "浪花有意千里雪，桃花无言一队春。";
					var _not_pass_text_fot02 = "Not pass 02";
					var _not_pass_text_fot03 = "Not pass 03";

					setTimeAtAsync(curYear + "-03-29 09:36:00").then(function(){
						return ntvToken.auditNTVUText(1, 2, _not_pass_text_fot02, {from: mainAccount, gas: 5000000});
					}).then(function(txid) {
						return setTimeAtAsync(curYear + "-03-29 11:36:00");
					}).then(function(){
						return ntvToken.auditNTVUText(2, 2, _not_pass_text_fot03, {from: mainAccount, gas: 5000000});
					}).then(function(txid) {
						return ntvToken.playingNTVU();
					}).then(function(ntvu) {
						expect(ntvu).to.equal(fot02);
						return ntvToken.getText();
					}).then(function(text) {
						expect(text).to.equal(_not_pass_text_fot02);
					}).then(function(txid) {
						return setTimeAtAsync(curYear + "-03-29 12:40:00"); // 设置区块时间到时段时间
					}).then(function(txid) {
						return ntvToken.getText();
					}).then(function(text) {
						expect(text).to.equal(_not_pass_text_fot03);
						done();
					})
				});
			});
		});
	});


	describe("#queryNTVUs", function(){
		it("queryNTVUs should be OK", function(done) {
			ntvToken.queryNTVUs(0, 0).then(function(results) {
				expect(results.length).to.equal(0);
				done();
			});
		});

		it("queryNTVUs should be 0", function(done) {
			ntvToken.queryNTVUs(1, 0).then(function(results) {
				expect(results.length).to.equal(0);
				done();
			});
		});

		it("queryNTVUs should be 0", function(done) {
			ntvToken.queryNTVUs(100, 0).then(function(results) {
				expect(results.length).to.equal(0);
				done();
			});
		});

		it("queryNTVUs one ntvus should be 1", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
					expect(ntvs.length).to.equal(1);
					done();
				});
			});
		});

		it("queryNTVUs two ntvus should be 2", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 2).then(function(ntvs) {
					expect(ntvs.length).to.equal(2);
					done();
				});
			});
		});

		it("queryNTVUs three ntvus should be 2", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 3).then(function(ntvs) {
					expect(ntvs.length).to.equal(2);
					done();
				});
			});
		});

		it("queryNTVUs three ntvus should be 2", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(1, 3).then(function(ntvs) {
					expect(ntvs.length).to.equal(2);
					done();
				});
			});
		});
	});
 
	describe("#playingNTVU", function(){
		var playing;
		var playing1;
		var playing2;

		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		beforeEach(function(done) {
			onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;
			done();
		});
		
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});
		
		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, mainAccount, {from: mainAccount, gas: 6700000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 6700000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 6700000});
			}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 6700000});
			}).then(function(txid) {
				return ntvToken.queryNTVUs(0, 2);
			}).then(function(ntvs) {
				playing = ntvs[0];
				playing1 = ntvs[1];
				playing2 = ntvs[1];

				done();
			});
		});

		it("query playingNTVU should be Ok", function(done) {
			setTimeAtAsync(curYear + "-03-29 00:21:00").then(function(){
				return ntvToken.playingNTVU();
			}).then(function(ntv) {
				expect(ntv).to.equal(playing);
				done();
			});
		});

		it("query playingNTVU should be OK at '03-29 00:00:00'", function(done) {
			setTimeAtAsync(curYear + "-03-29 00:00:00").then(function(){
				return ntvToken.playingNTVU();
			}).then(function(ntv) {
				expect(ntv).to.equal(playing);
				done();
			});
		});

		it("query playingNTVU should be Fail at '03-29 02:00:00'", function(done) {
			setTimeAtAsync(curYear + "-03-29 02:00:00").then(function(){
				return ntvToken.playingNTVU();
			}).then(function(ntv) {
				expect(ntv).to.equal("0x0000000000000000000000000000000000000000");
				done();
			});
		});

		it("query playingNTVU should be Fail at '03-29 11:00:00'", function(done) {
			setTimeAtAsync(curYear + "-03-29 11:00:00").then(function(){
				return ntvToken.playingNTVU();
			}).then(function(ntv) {
				expect(ntv).to.equal(playing1);
				done();
			});
		});

		it("query playingNTVU before up time should be 0", function(done) {
			setTimeAtAsync(curYear + "-03-27 23:59:59").then(function(){
					return ntvToken.playingNTVU();
				}).then(function(ntv) {
					expect(ntv).to.equal("0x0000000000000000000000000000000000000000");
					done();
				});
		});

		it("query playingNTVU not found timeRange should be 0", function(done) {
			setTimeAtAsync(curYear + "-03-29 04:59:59").then(function(){
					return ntvToken.playingNTVU();
				}).then(function(ntv) {
					expect(ntv).to.equal("0x0000000000000000000000000000000000000000");
					done();
				});
		});
	});

	describe("#totalAuctorCount", function(){
		var ntvuToken;
		var ethSaverValue;

		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, ethSaver, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
					ntvuToken = NTVUToken.at(ntvs[0]);
					done();
				});
			});
		});


		it("totalAuctorCount should be 1", function(done) {
			ethSaverValue = web3.eth.getBalance(ethSaver);

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("10", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                ntvToken.totalAuctorCount().then(function(result) {
					expect(result.toNumber()).to.equal(1);
					done();
				});
			});
		});

		it("totalAuctorCount tow should be 2", function(done) {
			ethSaverValue = web3.eth.getBalance(ethSaver);

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("10", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 08:05:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                return ntvuToken.bid({from: threeAccount, gas: 5000000, value: web3.toWei("15", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                ntvToken.totalAuctorCount().then(function(result) {
					expect(result.toNumber()).to.equal(2);
					done();
				});
			});
		});

	});

	describe("#totalBidCount", function(){
		var ntvuToken;
		var ethSaverValue;

		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, ethSaver, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
					ntvuToken = NTVUToken.at(ntvs[0]);
					done();
				});
			});
		});

		// 出价
        beforeEach(function(done) {
			ethSaverValue = web3.eth.getBalance(ethSaver);

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("10", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return waitAsync(200); // 延迟200 ms
			}).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 08:05:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("15", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                done();
            });
		});

		it("totalBidCount should be 2", function(done) {
			ntvToken.totalBidCount().then(function(result) {
				expect(result.toNumber()).to.equal(2);
				done();
			});
		});
	});

	describe("#totalBidEth", function(){
		it("totalBidEth should be 0", function(done) {
			ntvToken.totalBidEth().then(function(result) {
				expect(result.toNumber() >= 0).to.be.true;
				done();
			});
		});
	});

	describe("#maxBidEth", function(){
		it("maxBidEth should be 0", function(done) {
			ntvToken.maxBidEth().then(function(result) {
				expect(result.toNumber() >= 0).to.be.true;
				done();
			});
		});
	});

	describe("#reclaimEther", function(){
		var ntvuToken;
		var ethSaverValue;

		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, ethSaver, {from: mainAccount, gas: 6000000}).then(function(txid){
				done();
			});
		});

		// 出价
        beforeEach(function(done) {
			ethSaverValue = web3.eth.getBalance(ethSaver);

            web3.eth.sendTransaction({
				from: mainAccount, 
				to: ntvToken.address, 
				value: web3.toWei("1", "ether"),
				gas: 5000000
			});

			done();
		});
		
		it("reclaimEther should ok", function(done) {
			var val = web3.toWei("1", "ether");

			ntvToken.reclaimEther({from: mainAccount, gas: 2000000}).then(function(txid) {
				var newValue = web3.eth.getBalance(ethSaver);
	
				expect(newValue.toNumber()).to.equals(ethSaverValue.add(val).toNumber());
				done();
			});
		});
	});

	describe("#reclaimNtvuEther", function(){
		var ntvuToken;
		var ethSaverValue;

		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		// 创建时段
		beforeEach(function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, ethSaver, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
			}).then(function(txid) {
				ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
					ntvuToken = NTVUToken.at(ntvs[0]);
					done();
				});
			});
		});

		// 出价
        beforeEach(function(done) {
			ethSaverValue = web3.eth.getBalance(ethSaver);

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: secordAccount, gas: 5000000, value: web3.toWei("10", "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                done();
            });
		});
		
		it("reclaimEther should ok", function(done) {
			var val = web3.toWei("10", "ether");

			ntvToken.reclaimNtvuEther(0, {from: mainAccount, gas: 2000000}).then(function(txid) {
				var newValue = web3.eth.getBalance(ethSaver);
	
				expect(newValue.toNumber()).to.equals(ethSaverValue.add(val).toNumber());
				done();
			});
		});
	});


	describe("#status", function(){
		// 下一年
		beforeEach(function(done) {
			nextYearAsync().then(function(year){
				curYear = year;
				done();
			});
		});
		
		// 创建合约
		beforeEach(function(done) {
			NTVToken.new({from: mainAccount, gas: 6700000}).then(function(instance) {
				ntvToken = instance;
				done();
			});
		});

		it("not start status should be 0", function(done) {
			ntvToken.status().then(function(result) {
				expect(result.toNumber()).to.equal(0);
				done();
			});
		});

		it("after startup should be 1", function(done) {
			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid) {
				return ntvToken.status();
			}).then(function(result) {
				expect(result.toNumber()).to.equal(1);
				done();
			});
		});

		it("after startup should be 1", function(done) {
			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid) {
				return ntvToken.status();
			}).then(function(result) {
				expect(result.toNumber()).to.equal(1);
				done();
			});
		});

		it("after online time should be 2", function(done) {
			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(){
				return setTimeAtAsync(curYear + "-03-29 08:00:00")
			})
			.then(function(txid) {
				return ntvToken.status();
			}).then(function(result) {
				expect(result.toNumber()).to.equal(2);
				done();
			});
		});

		it("created timeRange and after online time should be 3", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 6700000});
			}).then(function(){
				return setTimeAtAsync(curYear + "-03-29 01:00:00")
			}).then(function(txid) {
				return ntvToken.status();
			}).then(function(result) {
				expect(result.toNumber()).to.equal(3);
				done();
			});
		});

		it("created timeRange and after end time should be 4", function(done) {
			var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;

			ntvToken.startup(onlineTime, secordAccount, {from: mainAccount, gas: 6000000}).then(function(txid){
				return ntvToken.createNTVU({from: mainAccount, gas: 6700000});
			}).then(function(){
				return setTimeAtAsync(curYear + "-03-29 04:00:00")
			}).then(function(txid) {
				return ntvToken.status();
			}).then(function(result) {
				expect(result.toNumber()).to.equal(4);
				done();
			});
		});

	});

});
