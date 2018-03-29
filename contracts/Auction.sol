pragma solidity ^0.4.18;

/**
 * @title 竞拍接口
 */
contract Auction {
    function bid() public payable returns (bool);
    function end() public returns (bool);

    event AuctionBid(address indexed from, uint256 value);
}
