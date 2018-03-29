pragma solidity ^0.4.17;

library StringUtils {
    function uintToString(uint v) internal pure returns (string str) {
        uint maxlength = 100;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (v != 0) {
            uint remainder = v % 10;
            v = v / 10;
            reversed[i++] = byte(48 + remainder);
        }

        bytes memory s = new bytes(i);
        for (uint j = 0; j < i; j++) {
            s[j] = reversed[i - 1 - j];
        }

        str = string(s);
    }

    function concat(string _base, string _value) internal pure returns (string) {
        bytes memory _baseBytes = bytes(_base);
        bytes memory _valueBytes = bytes(_value);

        string memory _tmpValue = new string(_baseBytes.length + _valueBytes.length);
        bytes memory _newValue = bytes(_tmpValue);

        uint i;
        uint j;

        for(i=0; i<_baseBytes.length; i++) {
            _newValue[j++] = _baseBytes[i];
        }

        for(i=0; i<_valueBytes.length; i++) {
            _newValue[j++] = _valueBytes[i];
        }

        return string(_newValue);
    }

    function bytesToBytes32(bytes memory source) internal pure returns (bytes32 result) {
        require(source.length <= 32);

        if (source.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    function toBytes96(string memory text) internal pure returns (bytes32, bytes32, bytes32, uint8) {
        bytes memory temp = bytes(text);
        len = uint8(temp.length);
        require(len <= 96);

        uint8 i=0;
        uint8 j=0;
        uint8 k=0;

        string memory _b1 = new string(32);
        bytes memory b1 = bytes(_b1);

        string memory _b2 = new string(32);
        bytes memory b2 = bytes(_b2);

        string memory _b3 = new string(32);
        bytes memory b3 = bytes(_b3);

        uint8 len;

        for(i=0; i<len; i++) {
            k = i / 32;
            j = i % 32;

            if (k == 0) {
                b1[j] = temp[i];
            } else if(k == 1) {
                b2[j] = temp[i];
            } else if(k == 2) {
                b3[j] = temp[i];
            } 
        }

        return (bytesToBytes32(b1), bytesToBytes32(b2), bytesToBytes32(b3), len);
    }

    function fromBytes96(bytes32 b1, bytes32 b2, bytes32 b3, uint8 len) internal pure returns (string) {
        require(len <= 96);
        string memory _tmpValue = new string(len);
        bytes memory temp = bytes(_tmpValue);

        uint8 i;
        uint8 j = 0;

        for(i=0; i<32; i++) {
            if (j >= len) break;
            temp[j++] = b1[i];
        }

        for(i=0; i<32; i++) {
            if (j >= len) break;
            temp[j++] = b2[i];
        }

        for(i=0; i<32; i++) {
            if (j >= len) break;
            temp[j++] = b3[i];
        }

        return string(temp);
    }
}