var moment = require('moment-timezone')

var utils = {};

/**
 * 转换结果
 * 
 * @param {*} result 
 * @param {*} exts 
 */
utils.toNTVU = function(result, exts) {
    var info = {
        symbol: result[0],
        name: result[1],

        bidStartValue: result[2],
        bidStartTime: result[3],
        bidEndTime: result[4],

        tvUseStartTime: result[5],
        tvUseEndTime: result[6],

        isPrivate: result[7]
    }

    if (exts) {
        info.maxBidValue = exts[0];
        info.maxBidAccount = exts[1];
        info.auctionEnded = exts[2];
        info.text = exts[3];
        info.auditStatus = exts[4];
        info.number = exts[5];
    }

    return info;
}

/**
 * 将区块链时间转换为日期
 * 
 * @param {*} result 
 * @param {*} exts 
 */
utils.toDate = function(time) {
    var date = new Date(time.toNumber() * 1000);
    return moment(date).format("YYYY-MM-DD HH:mm:ss")
}

module.exports = utils;