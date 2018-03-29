pragma solidity ^0.4.17;

import './ownership/Ownable.sol';
import './token/BasicToken.sol';

import './Base.sol';
import './Auction.sol';
import './util/StringUtils.sol';

/**
 * 链上真心话时段币
 */
contract NTVUToken is BasicToken, Ownable, Auction {
    string public name;
    string public symbol = "FOT";

    uint8 public number = 0;
    uint8 public decimals = 0;
    uint public INITIAL_SUPPLY = 1;

    uint public bidStartValue;
    uint public bidStartTime;
    uint public bidEndTime;

    uint public tvUseStartTime;
    uint public tvUseEndTime;

    bool public isPrivate = false;

    uint public maxBidValue;
    address public maxBidAccount;

    bool internal auctionEnded = false;

    string public text; // 用户配置文本
    string public auditedText; // 审核通过的文本
    string public defaultText; // 默认文本
    uint8 public auditStatus = 0; // 0:未审核；1:审核通过；2:审核不通过

    uint32 public bidCount;
    uint32 public auctorCount;

    mapping(address => bool) acutors;

    address public ethSaver; // 竞拍所得ETH保管者

    /**
     * 时段币合约构造函数
     *
     * 拍卖期间如有更高出价，前一手出价者的以太坊自动退回其钱包
     *
     * @param _number 时段币的序号，从0开始
     * @param _bidStartValue 起拍价，单位 wei
     * @param _bidStartTime 起拍/私募开始时间，单位s
     * @param _bidEndTime 起拍/私募结束时间，单位s
     * @param _tvUseStartTime 时段币文本开始播放时间
     * @param _tvUseEndTime 时段币文本结束播放时间
     * @param _isPrivate 是否为私募
     * @param _defaultText 默认文本
     * @param _ethSaver 竞拍所得保管着
     */
    function NTVUToken(uint8 _number, uint _bidStartValue, uint _bidStartTime, uint _bidEndTime, uint _tvUseStartTime, uint _tvUseEndTime, bool _isPrivate, string _defaultText, address _ethSaver) public {
        number = _number;

        if (_number + 1 < 10) {
            symbol = StringUtils.concat(symbol, StringUtils.concat("0", StringUtils.uintToString(_number + 1)));
        } else {
            symbol = StringUtils.concat(symbol, StringUtils.uintToString(_number + 1));
        }

        name = symbol;
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;

        bidStartValue = _bidStartValue;
        bidStartTime = _bidStartTime;
        bidEndTime = _bidEndTime;

        tvUseStartTime = _tvUseStartTime;
        tvUseEndTime = _tvUseEndTime;

        isPrivate = _isPrivate;

        defaultText = _defaultText;

        ethSaver = _ethSaver;
    }

    /**
     * 竞拍出价
     *
     * 拍卖期间如有更高出价，前一手出价者的以太坊自动退回其钱包
     */
    function bid() public payable returns (bool) {
        require(now >= bidStartTime); // 竞拍开始时间到后才能竞拍
        require(now < bidEndTime); // 竞拍截止时间到后不能再竞拍
        require(msg.value >= bidStartValue); // 拍卖金额需要大于起拍价
        require(msg.value >= maxBidValue + 0.05 ether); // 最低0.05ETH加价
        require(!isPrivate || (isPrivate && maxBidAccount == address(0))); // 竞拍或者私募第一次出价

        // 如果上次有人出价，将上次出价的ETH退还给他
        if (maxBidAccount != address(0)) {
            maxBidAccount.transfer(maxBidValue);
        } 
        
        maxBidAccount = msg.sender;
        maxBidValue = msg.value;
        AuctionBid(maxBidAccount, maxBidValue); // 发出有人出价事件

        // 统计出价次数
        bidCount++;

        // 统计出价人数
        bool bided = acutors[msg.sender];
        if (!bided) {
            auctorCount++;
            acutors[msg.sender] = true;
        }
    }

    /**
     * 竞拍结束
     *
     * 拍卖结束后，系统确认交易，出价最高者获得该时段Token。
     */
    function end() public returns (bool) {
        require(!auctionEnded); // 已经结束竞拍了不能再结束
        require((now >= bidEndTime) || (isPrivate && maxBidAccount != address(0))); // 普通竞拍拍卖结束后才可以结束竞拍，私募只要出过价就可以结束竞拍
   
        // 如果有人出价，将时段代币转给出价最高的人
        if (maxBidAccount != address(0)) {
            address _from = owner;
            address _to = maxBidAccount;
            uint _value = INITIAL_SUPPLY;

            // 将时段币转给出价最高的人
            balances[_from] = balances[_from].sub(_value);
            balances[_to] = balances[_to].add(_value);
            Transfer(_from, _to, _value); // 通知出价最高的人收到时段币了

            //将时段币中ETH转给ethSaver
            ethSaver.transfer(this.balance);
        }

        auctionEnded = true;
    }

    /**
     * 配置上链文本
     *
     * 购得时段后（包含拍卖和私募），可以设置时段文本
     * 每时段文字接受中文30字以内（含标点和空格），多出字符不显示。
     * 审核截止时间是，每个时段播出前30分钟
     */
    function setText(string _text) public {
        require(INITIAL_SUPPLY == balances[msg.sender]); // 拥有时段币的人可以设置文本
        require(bytes(_text).length > 0 && bytes(_text).length <= 90); // 汉字使用UTF8编码，1个汉字最多占用3个字节，所以最多写90个字节的字
        require(now < tvUseStartTime - 30 minutes); // 开播前30分钟不能再设置文本

        text = _text;
    }

    function getTextBytes96() public view returns(bytes32, bytes32, bytes32, uint8) {
        return StringUtils.toBytes96(text);
    }

    /**
     * 审核文本
     */
    function auditText(uint8 _status, string _text) external onlyOwner {
        require((now >= tvUseStartTime - 30 minutes) && (now < tvUseEndTime)); // 时段播出前30分钟为审核时间，截止到时段播出结束时间
        auditStatus = _status;

        if (_status == 2) { // 审核失败，更新审核文本
            auditedText = _text;
        } else if (_status == 1) { // 审核通过使用用户设置的文本
            auditedText = text; 
        }
    }

    /**
     * 获取显示文本
     */
    function getShowText() public view returns(string) {
        if (auditStatus == 1 || auditStatus == 2) { // 审核过了
            return auditedText;
        } else { // 没有审核，显示默认文本
            return defaultText;
        }
    }

    function getShowTextBytes96() public view returns(bytes32, bytes32, bytes32, uint8) {
        return StringUtils.toBytes96(getShowText());
    }

    /**
     * 转账代币
     *
     * 获得时段后，时段播出前，不可以转卖。时段播出后，可以作为纪念币转卖
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(now >= tvUseEndTime); // 时段播出后，可以转卖。

        super.transfer(_to, _value);
    }

    /**
     * 获取时段币状态信息
     *
     */
    function getInfo() public view returns(
        string _symbol,
        string _name,
        uint _bidStartValue, 
        uint _bidStartTime, 
        uint _bidEndTime, 
        uint _tvUseStartTime,
        uint _tvUseEndTime,
        bool _isPrivate
        ) {
        _symbol = symbol;
        _name = name;

        _bidStartValue = bidStartValue;
        _bidStartTime = bidStartTime;
        _bidEndTime = bidEndTime;

        _tvUseStartTime = tvUseStartTime;
        _tvUseEndTime = tvUseEndTime;

        _isPrivate = isPrivate;
    }

    /**
     * 获取时段币可变状态信息
     *
     */
    function getMutalbeInfo() public view returns(
        uint _maxBidValue,
        address _maxBidAccount,
        bool _auctionEnded,
        string _text,
        uint8 _auditStatus,
        uint8 _number,
        string _auditedText,
        uint32 _bidCount,
        uint32 _auctorCount
        ) {
        _maxBidValue = maxBidValue;
        _maxBidAccount = maxBidAccount;

        _auctionEnded = auctionEnded;

        _text = text;
        _auditStatus = auditStatus;

        _number = number;
        _auditedText = auditedText;

        _bidCount = bidCount;
        _auctorCount = auctorCount;
    }

    /**
     * 提取以太坊到ethSaver
     */
    function reclaimEther() external onlyOwner {
        require((now > bidEndTime) || (isPrivate && maxBidAccount != address(0))); // 普通竞拍拍卖结束后或者私募完成后，可以提币到ethSaver。
        ethSaver.transfer(this.balance);
    }

    /**
     * 默认给合约转以太坊就是出价
     */
    function() payable public {
        bid(); // 出价
    }
}