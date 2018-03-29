pragma solidity ^0.4.17;

import './NTVUToken.sol';

/**
 * 链上真心话合约
 */
contract NTVToken is Ownable {
    using SafeMath for uint256;

    uint8 public MAX_TIME_RANGE_COUNT = 66; // 最多发行66个时段代币

    bool public isRunning; // 是否启动运行

    uint public onlineTime; // 上线时间，第一时段上电视的时间
    uint8 public totalTimeRange; // 当前已经释放的总的时段数
    mapping(uint => address) internal timeRanges; // 每个时段的合约地址，编号从0开始

    string public defaultText = "浪花有意千里雪，桃花无言一队春。"; // 忘记审核使用的默认文本

    mapping(uint8 => Base.NTVUConfig) internal dayConfigs; // 每天时段配置
    mapping(uint8 => Base.NTVUConfig) internal specialConfigs; // 特殊时段配置

    address public ethSaver; // 竞拍所得ETH保管者

    event OnTV(address indexed ntvu, address indexed winer, string text); // 文本上电视

    /**
     * 佛系电视合约构造函数
     */
    function NTVToken() public {}

    /**
     * 启动区块链电视
     *
     * @param _onlineTime 区块链电视上线时间，必须为整点，例如 2018-03-26 00:00:00
     * @param _ethSaver 竞拍所得ETH保管者
     */
    function startup(uint256 _onlineTime, address _ethSaver) public onlyOwner {
        require(!isRunning); // 只能上线一次，上线后不能停止
        require((_onlineTime - 57600) % 1 days == 0); // 上线时间只能是整天时间，57600为北京时间的'1970/1/2 0:0:0'
        require(_onlineTime >= now); // 上线时间需要大于当前时间
        require(_ethSaver != address(0));

        onlineTime = _onlineTime;
        ethSaver = _ethSaver;

        isRunning = true;

        // ---------------------------
        // 每天的时段配置，共6个时段
        //
        // 通用规则：
        // 1、首拍后，每天18:30-22:00为竞拍时间
        // ---------------------------
        uint8[6] memory tvUseStartTimes = [0, 10, 12, 18, 20, 22]; // 电视使用开始时段
        uint8[6] memory tvUseEndTimes = [2, 12, 14, 20, 22, 24]; // 电视使用结束时段

        for (uint8 i=0; i<6; i++) {
            dayConfigs[i].bidStartValue = 0.1 ether; // 正常起拍价0.1ETH
            dayConfigs[i].bidStartTime = 18 hours + 30 minutes - 1 days; // 一天前晚上 18:30起拍
            dayConfigs[i].bidEndTime = 22 hours - 1 days; // 一天前晚上 22:00 结束拍卖

            dayConfigs[i].tvUseStartTime = uint(tvUseStartTimes[i]) * 1 hours;
            dayConfigs[i].tvUseEndTime = uint(tvUseEndTimes[i]) * 1 hours;

            dayConfigs[i].isPrivate = false; // 正常都是竞拍，非私募
        }

        // ---------------------------
        // 特殊时段配置
        // ---------------------------

        // 首拍，第1天的6个时段都是首拍，拍卖时间从两天前的18:30到一天前的22:00
        for(uint8 p=0; p<6; p++) {
            specialConfigs[p].special = true;
            
            specialConfigs[p].bidStartValue = 0.1 ether; // 起拍价0.1ETH
            specialConfigs[p].bidStartTime = 18 hours + 30 minutes - 2 days; // 两天前的18:30
            specialConfigs[p].bidEndTime = 22 hours - 1 days; // 一天前的22:00
            specialConfigs[p].isPrivate = false; // 非私募
        }
    }

    /**
     * 获取区块的时间戳，单位s
     */
    function time() constant internal returns (uint) {
        return block.timestamp;
    }

    /**
     * 获取某个时间是上线第几天，第1天返回1，上线之前返回0
     * 
     * @param timestamp 时间戳
     */
    function dayFor(uint timestamp) constant public returns (uint) {
        return timestamp < onlineTime
            ? 0
            : (timestamp.sub(onlineTime) / 1 days) + 1;
    }

    /**
     * 获取当前时间是今天的第几个时段，第一个时段返回1，没有匹配的返回0
     *
     * @param timestamp 时间戳
     */
    function numberFor(uint timestamp) constant public returns (uint8) {
        if (timestamp >= onlineTime) {
            uint current = timestamp.sub(onlineTime) % 1 days;

            for(uint8 i=0; i<6; i++) {
                if (dayConfigs[i].tvUseStartTime<=current && current<dayConfigs[i].tvUseEndTime) {
                    return (i + 1);
                }
            }
        }

        return 0;
    }

    /**
     * 创建时段币
     */
    function createNTVU() public onlyOwner {
        require(isRunning);
        require(totalTimeRange < MAX_TIME_RANGE_COUNT);

        uint8 number = totalTimeRange++;
        uint8 day = number / 6;
        uint8 num = number % 6;

        Base.NTVUConfig memory cfg = dayConfigs[num]; // 读取每天时段的默认配置

        // 如果有特殊配置则覆盖
        Base.NTVUConfig memory expCfg = specialConfigs[number];
        if (expCfg.special) {
            cfg.bidStartValue = expCfg.bidStartValue;
            cfg.bidStartTime = expCfg.bidStartTime;
            cfg.bidEndTime = expCfg.bidEndTime;
            cfg.isPrivate = expCfg.isPrivate;
        }

        // 根据上线时间计算具体的时段时间
        uint bidStartTime = uint(int(onlineTime) + day * 24 hours + cfg.bidStartTime);
        uint bidEndTime = uint(int(onlineTime) + day * 24 hours + cfg.bidEndTime);
        uint tvUseStartTime = onlineTime + day * 24 hours + cfg.tvUseStartTime;
        uint tvUseEndTime = onlineTime + day * 24 hours + cfg.tvUseEndTime;

        timeRanges[number] = new NTVUToken(number, cfg.bidStartValue, bidStartTime, bidEndTime, tvUseStartTime, tvUseEndTime, cfg.isPrivate, defaultText, ethSaver);
    }

    /**
     * 查询所有时段
     */
    function queryNTVUs(uint startIndex, uint count) public view returns(address[]){
        startIndex = (startIndex < totalTimeRange)? startIndex : totalTimeRange;
        count = (startIndex + count < totalTimeRange) ? count : (totalTimeRange - startIndex);

        address[] memory result = new address[](count);
        for(uint i=0; i<count; i++) {
            result[i] = timeRanges[startIndex + i];
        }

        return result;
    }

    /**
     * 查询当前正在播放的时段
     */
    function playingNTVU() public view returns(address){
        uint day = dayFor(time());
        uint8 num = numberFor(time());

        if (day>0 && (num>0 && num<=6)) {
            day = day - 1;
            num = num - 1;

            return timeRanges[day * 6 + uint(num)];
        } else {
            return address(0);
        }
    }

    /**
     * 审核文本
     */
    function auditNTVUText(uint8 index, uint8 status, string _text) public onlyOwner {
        require(isRunning); // 合约启动后才能审核
        require(index >= 0 && index < totalTimeRange); //只能审核已经上线的时段
        require(status==1 || (status==2 && bytes(_text).length>0 && bytes(_text).length <= 90)); // 审核不通，需要配置文本

        address ntvu = timeRanges[index];
        assert(ntvu != address(0));

        NTVUToken ntvuToken = NTVUToken(ntvu);
        ntvuToken.auditText(status, _text);

        var (b1, b2, b3, len) = ntvuToken.getShowTextBytes96();
        var auditedText = StringUtils.fromBytes96(b1, b2, b3, len);
        OnTV(ntvuToken, ntvuToken.maxBidAccount(), auditedText); // 审核后的文本记录到日志中
    }

    /**
     * 获取电视播放文本
     */
    function getText() public view returns(string){
        address playing = playingNTVU();

        if (playing != address(0)) {
            NTVUToken ntvuToken = NTVUToken(playing);

            var (b1, b2, b3, len) = ntvuToken.getShowTextBytes96();
            return StringUtils.fromBytes96(b1, b2, b3, len);
        } else {
            return ""; // 当前不是播放时段，返回空文本
        }
    }

    /**
     * 获取竞拍状态
     */
    function status() public view returns(uint8) {
        if (!isRunning) {
            return 0; // 未启动拍卖
        } else if (time() < onlineTime) {
            return 1; // 未到首播时间
        } else {
            if (totalTimeRange == 0) {
                return 2; // 没有创建播放时段
            } else {
                if (time() < NTVUToken(timeRanges[totalTimeRange - 1]).tvUseEndTime()) {
                    return 3; // 整个竞拍活动进行中
                } else {
                    return 4; // 整个竞拍活动已结束
                }
            }
        }
    }
    
    /**
     * 获取总的竞拍人数
     */
    function totalAuctorCount() public view returns(uint32) {
        uint32 total = 0;

        for(uint8 i=0; i<totalTimeRange; i++) {
            total += NTVUToken(timeRanges[i]).auctorCount();
        }

        return total;
    }

    /**
     * 获取总的竞拍次数
     */
    function totalBidCount() public view returns(uint32) {
        uint32 total = 0;

        for(uint8 i=0; i<totalTimeRange; i++) {
            total += NTVUToken(timeRanges[i]).bidCount();
        }

        return total;
    }

    /**
     * 获取总的出价ETH
     */
    function totalBidEth() public view returns(uint) {
        uint total = 0;

        for(uint8 i=0; i<totalTimeRange; i++) {
            total += NTVUToken(timeRanges[i]).balance;
        }

        total += this.balance;
        total += ethSaver.balance;

        return total;
    }

    /**
     * 获取历史出价最高的ETH
     */
    function maxBidEth() public view returns(uint) {
        uint maxETH = 0;

        for(uint8 i=0; i<totalTimeRange; i++) {
            uint val = NTVUToken(timeRanges[i]).maxBidValue();
            maxETH =  (val > maxETH) ? val : maxETH;
        }

        return maxETH;
    }

    /**
     * 提取当前合约的ETH到ethSaver
     */
    function reclaimEther() public onlyOwner {
        require(isRunning);

        ethSaver.transfer(this.balance);
    }

    /**
     * 提取时段币的ETH到ethSaver
     */
    function reclaimNtvuEther(uint8 index) public onlyOwner {
        require(isRunning);
        require(index >= 0 && index < totalTimeRange); //只能审核已经上线的时段

        NTVUToken(timeRanges[index]).reclaimEther();
    }

    /**
     * 接收ETH
     */
    function() payable external {}
}