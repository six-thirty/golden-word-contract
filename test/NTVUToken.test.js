var async = require('async');
var Promise = require('bluebird');
var moment = require('moment-timezone');

var NTVUToken = artifacts.require("./NTVUToken.sol");
var NTVToken = artifacts.require("./NTVToken.sol");

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

function setTimeAt(date, done) {
    var targetTime = new Date(date).getTime() / 1000;

    web3.eth.getBlock('latest', function(err, block){
        if(err) return done(err);

        var jumpTime = targetTime - block.timestamp;
        if (jumpTime < 0) {
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
        next(null, parseInt(year) + 100);
    });
}

var advanceTimeAsync = Promise.promisify(advanceTime);
var snapshotAsync = Promise.promisify(snapshot);
var revertAsync = Promise.promisify(revert);
var mineAsync = Promise.promisify(mine);
var setTimeAtAsync = Promise.promisify(setTimeAt);
var nextYearAsync = Promise.promisify(nextYear);

// days in secs
function days(numberOfDays) {
	return numberOfDays * 24 * 60 * 60;
}

function assertIsContractError(err) {
	return assert.ok(err.toString().indexOf("invalid JUMP") != -1 || err.toString().indexOf("invalid opcode") != -1, err);
}

var accountIndex=0


contract('NTVUToken', function(accounts) {
    var curYear;
    var ntvuToken;
    var mainAccount;
    var ethSaver;

    beforeEach(function(done) {
        accountIndex++;
        mainAccount = accounts[accountIndex % accounts.length];
        ethSaver = accounts[(accountIndex + 1) % accounts.length];

        done();
    });

    beforeEach(function(done) {
        nextYearAsync().then(function(year){
            curYear = year;
            done();
        });
    });

    beforeEach(function(done) {
        var ntvToken;
        
        NTVToken.new({from: mainAccount, gas: 6000000}).then(function(instance) {
            ntvToken = instance;
            var onlineTime = new Date(curYear + "-03-29 00:00:00").getTime()/1000;
            return ntvToken.startup(onlineTime, ethSaver, {from: mainAccount, gas: 5000000});
        }).then(function(txid){
            return ntvToken.createNTVU({from: mainAccount, gas: 5000000});
        }).then(function(txid) {
            ntvToken.queryNTVUs(0, 1).then(function(ntvs) {
                ntvuToken = NTVUToken.at(ntvs[0]);
                done();
            });
        });
    });

	describe("#symbol", function(){
		it("symbol should be 'FOT01'", function(done) {
			ntvuToken.symbol().then(function(text) {
				expect(text).to.equal("FOT01");
				done();
			});
		});
    });
    
    describe("#name", function(){
		it("name should be 'FOT01'", function(done) {
			ntvuToken.name().then(function(text) {
				expect(text).to.equal("FOT01");
				done();
			});
		});
    });

    describe("#bid", function(){
		it("bid should be Ok", function(done) {
            var amount = "10";

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: mainAccount, gas: 5000000, value: web3.toWei(amount, "ether")});
            }).then(function(txid) {
				return ntvuToken.maxBidAccount();
			}).then(function(address){
                expect(address).to.equal(mainAccount);
                done();
            });
		});
    });

    describe("#setText", function(){
        // FOT01 设置文本
        var amount = "10"; // FOT01起拍价10ETH

        beforeEach(function(done) {
            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: mainAccount, gas: 5000000, value: web3.toWei(amount, "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
				return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
			}).then(function(){
                return ntvuToken.end({from: mainAccount, gas: 5000000, value: web3.toWei(0, "ether")}); // 结束竞拍
            }).then(function(){
                done();
            });
        });

		it("setText should be Ok", function(done) {
			ntvuToken.setText("Hello World!", {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.text();
			}).then(function(text){
                expect(text).to.equal("Hello World!");
                done();
            });
        });

        it("CN text should be Ok", function(done) {
            var words = "你好";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.text();
			}).then(function(text){
                expect(text).to.equal(words);
                done();
            });
        });
        
        it("30 CN text should be Ok", function(done) {
            var words = "你你你你你你你你你你好好好好好好好好好好吗吗吗吗吗吗吗吗吗吗";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.text();
			}).then(function(text){
                expect(text).to.equal(words);
                done();
            });
        });
        
        it("31 CN text should fail", function(done) {
            var words = "你你你你你你你你你你好好好好好好好好好好吗吗吗吗吗吗吗吗吗吗哈";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				done("31 CN text can send to block");
			}).catch(function(e) {
                expect(e).not.null;
				done();
			});
        });

        it("init text should be Ok", function(done) {
            var words = "浪花有意千里雪，桃花无言一队春。";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.text();
			}).then(function(text){
                expect(text).to.equal(words);
                done();
            });
        });
        
        it("No text should fail", function(done) {
            var words = "";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				done("No text can not send to block");
			}).catch(function(e) {
                expect(e).not.null;
				done();
			});
        });
    });

    describe("#getTextBytes96", function(){
        // FOT01 设置文本
        var amount = "10"; // FOT01起拍价10ETH

        beforeEach(function(done) {
            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                return ntvuToken.bid({from: mainAccount, gas: 5000000, value: web3.toWei(amount, "ether")}); //竞拍，出价10ETH
            }).then(function(txid) {
                return setTimeAtAsync(curYear + "-03-28 22:01:00"); // 设置区块时间到拍卖结束
            }).then(function(){
                return ntvuToken.end({from: mainAccount, gas: 5000000, value: web3.toWei(0, "ether")}); // 结束竞拍
            }).then(function(){
                done();
            });
        });

      
		it("getTextBytes96 should be Ok", function(done) {
            var words = "Hello World!";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.getTextBytes96();
			}).then(function(result){
                expect(web3.toUtf8(result[0])).to.equal(words);
                expect(web3.toUtf8(result[1])).to.equal('');
                expect(web3.toUtf8(result[2])).to.equal('');
                expect(result[3].toNumber()).to.equal(words.length);
                done();
            });
        });
        
        it("Get CN text by getTextBytes96 should be Ok", function(done) {
            var words = "你好!";

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.getTextBytes96();
			}).then(function(result){
                expect(web3.toUtf8(result[0])).to.equal(words);
                expect(web3.toUtf8(result[1])).to.equal('');
                expect(web3.toUtf8(result[2])).to.equal('');
                expect(result[3].toNumber()).to.equal(7);
                done();
            });
        });

        it("Get 20 CN text by getTextBytes96 should be Ok", function(done) {
            var words1 = "你你你你你你你你你你!!";
            var words2 = "好好好好好好好好好好!!";
            var words3 = "123456789";

            var words = words1 + words2 + words3;

			ntvuToken.setText(words, {from: mainAccount, gas: 5000000}).then(function(txid) {
				return ntvuToken.getTextBytes96();
			}).then(function(result){
                expect(web3.toUtf8(result[0])).to.equal(words1);
                expect(web3.toUtf8(result[1])).to.equal(words2);
                expect(web3.toUtf8(result[2])).to.equal(words3);
                expect(result[3].toNumber()).to.equal(73);
                done();
            });
        });
    });
    

    describe("#fallback", function(){
		it("fallback should be Ok", function(done) {
            var amount = "10";

            setTimeAtAsync(curYear + "-03-28 08:00:00").then(function(){
                web3.eth.sendTransaction({
                    from: mainAccount, 
                    to: ntvuToken.address, 
                    value: web3.toWei(amount, "ether"),
                    gas: 5000000
                });
    
                ntvuToken.maxBidAccount().then(function(address){
                    expect(address).to.equal(mainAccount);
                    done();
                });
            });
		});
    });
});
